// Talks to the online play API and keeps a room in sync.
//
// Sync is long-polling rather than WebSockets: the request is held open by the
// server until something changes or ~25s pass. Moves arrive as fast as sockets
// would, an idle game costs about three requests a minute, and it works on any
// host that can serve plain HTTP.

import { useCallback, useEffect, useRef, useState } from 'react';
import ChessGame from './ChessGame.mjs';

const SEAT_KEY = code => `chess:seat:${code}`;

// "Request failed (500)" tells a player nothing. The two things that actually
// go wrong are the server being unreachable and the server saying no, so name
// them plainly and, for the local case, say how to fix it.
const UNREACHABLE =
  'Cannot reach the game server. If you are running this locally, start it in ' +
  'another terminal with "npm run server".';

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (err) {
    // fetch only rejects when the request never reached a server at all.
    if (err.name === 'AbortError') throw err;
    const error = new Error(UNREACHABLE);
    error.unreachable = true;
    throw error;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    // A 5xx with no JSON body is the dev proxy or the host failing to reach the
    // server, not the game rejecting anything.
    const message = payload?.error
      || (response.status >= 500 ? UNREACHABLE : `Request failed (${response.status})`);
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

// A seat is the proof that you own one side of a board. Keeping it in
// localStorage is what lets a refresh or a dropped connection rejoin the same
// game instead of losing it.
export function rememberSeat(code, token, color) {
  try {
    localStorage.setItem(SEAT_KEY(code), JSON.stringify({ token, color }));
  } catch {
    // Private browsing can refuse storage; the game still works for this tab.
  }
}

export function recallSeat(code) {
  try {
    const raw = localStorage.getItem(SEAT_KEY(code));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function createRoom(minutes) {
  const data = await request('/api/rooms', {
    method: 'POST',
    body: JSON.stringify({ minutes })
  });
  rememberSeat(data.code, data.token, data.color);
  return data;
}

export async function joinRoom(code, token = null) {
  const data = await request(`/api/rooms/${encodeURIComponent(code)}/join`, {
    method: 'POST',
    body: JSON.stringify({ token })
  });
  rememberSeat(data.code, data.token, data.color);
  return data;
}

export function shareUrlFor(code) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?g=${code}`;
}

// Rebuilds a playable game object from what the server sent.
function hydrate(state) {
  return ChessGame.deserialize(state.serialized);
}

/**
 * Keeps one room in sync. Returns the live game plus the actions a player can
 * take. Pass null to disable (used when not in online mode).
 */
export function useOnlineRoom(session) {
  const [state, setState] = useState(null);
  const [game, setGame] = useState(null);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(false);
  // Set when the room no longer exists, which is terminal - retrying cannot
  // bring it back. Happens if the server restarted or slept (free hosting keeps
  // rooms in memory) or if the room expired.
  const [gone, setGone] = useState(false);

  const versionRef = useRef(0);
  const abortRef = useRef(null);

  const applyState = useCallback(next => {
    versionRef.current = next.version;
    setState(next);
    setGame(hydrate(next));
  }, []);

  // Switching rooms (or leaving one) has to clear everything from the previous
  // room. Without this a room that ended as "gone" would immediately mark the
  // next game gone too, and a stale version would make the first poll skip
  // updates. Declared before the seeding effect so it cannot wipe fresh state.
  useEffect(() => {
    setGone(false);
    setError(null);
    versionRef.current = 0;
    if (!session?.code) {
      setState(null);
      setGame(null);
    }
  }, [session?.code]);

  // Seed from the response that created or joined the room.
  useEffect(() => {
    if (session?.state) applyState(session.state);
  }, [session?.state, applyState]);

  // Long-poll loop. Restarts itself until the room or component goes away.
  useEffect(() => {
    if (!session?.code) return undefined;
    let cancelled = false;

    const loop = async () => {
      while (!cancelled) {
        const controller = new AbortController();
        abortRef.current = controller;
        try {
          const params = new URLSearchParams({
            since: String(versionRef.current),
            token: session.token || ''
          });
          const data = await request(
            `/api/rooms/${encodeURIComponent(session.code)}?${params}`,
            { signal: controller.signal }
          );
          if (cancelled) return;
          if (data?.state) {
            applyState(data.state);
            setError(null);
          }
        } catch (err) {
          if (cancelled || err.name === 'AbortError') return;
          if (err.status === 404) {
            // The room is gone for good; polling it again is pointless.
            setGone(true);
            setError('This game is no longer available. The server may have restarted.');
            return;
          }
          setError(err.message);
          // Back off briefly so a dead server is not hammered.
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };

    loop();
    return () => {
      cancelled = true;
      abortRef.current?.abort();
    };
  }, [session?.code, session?.token, applyState]);

  const sendMove = useCallback(async (from, to, promotion = 'queen') => {
    if (!session?.code) return false;
    setPending(true);
    try {
      const data = await request(`/api/rooms/${encodeURIComponent(session.code)}/move`, {
        method: 'POST',
        body: JSON.stringify({ token: session.token, from, to, promotion })
      });
      applyState(data.state);
      setError(null);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setPending(false);
    }
  }, [session?.code, session?.token, applyState]);

  const resign = useCallback(async () => {
    if (!session?.code) return;
    try {
      const data = await request(`/api/rooms/${encodeURIComponent(session.code)}/resign`, {
        method: 'POST',
        body: JSON.stringify({ token: session.token })
      });
      applyState(data.state);
    } catch (err) {
      setError(err.message);
    }
  }, [session?.code, session?.token, applyState]);

  return { state, game, error, gone, pending, sendMove, resign };
}
