// Online play server.
//
// One Node process serves the built React app and a small REST API. Game rooms
// live in memory, which is why this needs a host that keeps a process running
// (Render, Railway, Fly.io) rather than serverless functions, whose memory does
// not survive between requests.
//
// The server is the referee: it owns the position, validates every move with
// the same engine the UI uses, and owns the clocks. Nothing a client sends is
// trusted beyond "this token wants to play this move".

import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import ChessGame from '../src/ChessGame.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, '..', 'build');

const PORT = process.env.PORT || 4000;

// How long a poll request is held open before returning empty-handed.
const POLL_HOLD_MS = 25000;
// Rooms are dropped after this much inactivity so memory cannot grow forever.
const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
// An opponent is shown as disconnected after this long without polling.
const PRESENCE_TIMEOUT_MS = 15000;

const MIN_MINUTES = 1;
const MAX_MINUTES = 60;

// ---------------------------------------------------------------------------
// Room store
// ---------------------------------------------------------------------------

const rooms = new Map();

// Ambiguous characters (0/O, 1/I/L) are left out so a code can be read aloud.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function makeCode(length = 5) {
  let code;
  do {
    code = Array.from(crypto.randomBytes(length))
      .map(byte => CODE_ALPHABET[byte % CODE_ALPHABET.length])
      .join('');
  } while (rooms.has(code));
  return code;
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createRoom(minutes) {
  const code = makeCode();
  const timeControlMs = minutes * 60 * 1000;
  const game = new ChessGame();
  game.setGameMode('online');
  game.setTimeControl(timeControlMs);

  const room = {
    code,
    game,
    timeControlMs,
    // Each player: { token, lastSeen, polls }
    players: { white: null, black: null },
    clocks: { white: timeControlMs, black: timeControlMs },
    // Null until both seats are filled; the clock does not run before that.
    turnStartedAt: null,
    status: null,
    version: 1,
    waiters: [],
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
  rooms.set(code, room);
  return room;
}

// ---------------------------------------------------------------------------
// Change notification: a poll request parks here until something happens.
// ---------------------------------------------------------------------------

function bumpVersion(room) {
  room.version++;
  room.lastActivity = Date.now();
  const waiters = room.waiters;
  room.waiters = [];
  for (const waiter of waiters) {
    clearTimeout(waiter.timer);
    waiter.resolve();
  }
}

function waitForChange(room, since) {
  if (room.version > since) return Promise.resolve();
  return new Promise(resolve => {
    const waiter = { resolve };
    waiter.timer = setTimeout(() => {
      room.waiters = room.waiters.filter(w => w !== waiter);
      resolve();
    }, POLL_HOLD_MS);
    room.waiters.push(waiter);
  });
}

// ---------------------------------------------------------------------------
// Clocks. The server is the only authority on time: a client that pauses its
// JavaScript still loses on time.
// ---------------------------------------------------------------------------

function bothSeated(room) {
  return !!(room.players.white && room.players.black);
}

function liveClocks(room) {
  const clocks = { ...room.clocks };
  if (!room.status && room.turnStartedAt) {
    const turn = room.game.getCurrentTurn();
    clocks[turn] = Math.max(0, clocks[turn] - (Date.now() - room.turnStartedAt));
  }
  return clocks;
}

// Charges the side to move for the time it just used and restarts the clock.
function chargeClock(room) {
  if (!room.turnStartedAt) return;
  const turn = room.game.getCurrentTurn();
  room.clocks[turn] = Math.max(0, room.clocks[turn] - (Date.now() - room.turnStartedAt));
  room.turnStartedAt = Date.now();
}

function checkFlag(room) {
  if (room.status || !room.turnStartedAt) return false;
  const clocks = liveClocks(room);
  const turn = room.game.getCurrentTurn();
  if (clocks[turn] > 0) return false;
  room.clocks[turn] = 0;
  room.turnStartedAt = null;
  room.status = { over: true, winner: turn === 'white' ? 'black' : 'white', reason: 'timeout' };
  return true;
}

// ---------------------------------------------------------------------------
// Wire format
// ---------------------------------------------------------------------------

// A player parked in a long poll sends nothing for up to POLL_HOLD_MS, which is
// longer than the presence timeout. Counting open polls keeps them present
// while they wait, so only a genuinely gone client is flagged.
function isPresent(player) {
  if (!player) return false;
  if (player.polls > 0) return true;
  return Date.now() - player.lastSeen < PRESENCE_TIMEOUT_MS;
}

function snapshot(room, color = null) {
  const presence = {
    white: isPresent(room.players.white),
    black: isPresent(room.players.black)
  };
  return {
    code: room.code,
    version: room.version,
    serialized: room.game.serialize(),
    clocks: liveClocks(room),
    status: room.status,
    seats: { white: !!room.players.white, black: !!room.players.black },
    presence,
    started: bothSeated(room),
    timeControlMs: room.timeControlMs,
    yourColor: color
  };
}

function seatOf(room, token) {
  // An empty seat's token reads as undefined, and so does a request that sent
  // no token, so the two would compare equal. Reject non-tokens up front or a
  // caller with no credentials is handed whichever seat happens to be free.
  if (typeof token !== 'string' || token.length === 0) return null;
  if (room.players.white?.token === token) return 'white';
  if (room.players.black?.token === token) return 'black';
  return null;
}

function touch(room, color) {
  if (color && room.players[color]) room.players[color].lastSeen = Date.now();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

const api = express.Router();

api.post('/rooms', (req, res) => {
  const minutes = Number(req.body?.minutes);
  if (!Number.isFinite(minutes) || minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
    return res.status(400).json({ error: 'minutes must be between 1 and 60' });
  }
  const room = createRoom(minutes);
  const token = makeToken();
  // The player who creates the room takes white.
  room.players.white = { token, lastSeen: Date.now(), polls: 0 };
  res.json({ code: room.code, token, color: 'white', state: snapshot(room, 'white') });
});

api.post('/rooms/:code/join', (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Game not found. Check the code.' });

  // Rejoining with a token already seated is how reconnection works.
  const existing = seatOf(room, req.body?.token);
  if (existing) {
    touch(room, existing);
    return res.json({ code: room.code, token: req.body.token, color: existing, state: snapshot(room, existing) });
  }

  const free = !room.players.white ? 'white' : !room.players.black ? 'black' : null;
  if (!free) return res.status(409).json({ error: 'This game already has two players.' });

  const token = makeToken();
  room.players[free] = { token, lastSeen: Date.now(), polls: 0 };

  // Both seats filled: the game is live and white's clock starts.
  if (bothSeated(room) && !room.turnStartedAt && !room.status) {
    room.turnStartedAt = Date.now();
  }
  bumpVersion(room);
  res.json({ code: room.code, token, color: free, state: snapshot(room, free) });
});

api.get('/rooms/:code', async (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Game not found.' });

  const color = seatOf(room, req.query.token);
  const player = color ? room.players[color] : null;

  // Mark this player as actively polling for as long as the request is open.
  if (player) {
    player.polls = (player.polls || 0) + 1;
    player.lastSeen = Date.now();
  }
  let released = false;
  const release = () => {
    if (released || !player) return;
    released = true;
    player.polls = Math.max(0, player.polls - 1);
    player.lastSeen = Date.now();
  };
  // Fires if the client navigates away while the poll is still parked.
  req.on('close', release);

  try {
    const since = Number(req.query.since) || 0;
    if (checkFlag(room)) bumpVersion(room);

    if (room.version <= since) {
      await waitForChange(room, since);
      if (checkFlag(room)) bumpVersion(room);
    }
    if (!res.writableEnded) res.json({ state: snapshot(room, color) });
  } finally {
    release();
  }
});

api.post('/rooms/:code/move', (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Game not found.' });

  const color = seatOf(room, req.body?.token);
  if (!color) return res.status(403).json({ error: 'You are not a player in this game.' });
  if (room.status) return res.status(409).json({ error: 'This game is already over.' });
  if (!bothSeated(room)) return res.status(409).json({ error: 'Waiting for an opponent.' });
  if (checkFlag(room)) {
    bumpVersion(room);
    return res.status(409).json({ error: 'Time is up.' });
  }
  if (room.game.getCurrentTurn() !== color) {
    return res.status(409).json({ error: 'Not your turn.' });
  }

  const { from, to, promotion } = req.body || {};
  if (!isSquare(from) || !isSquare(to)) {
    return res.status(400).json({ error: 'Malformed move.' });
  }
  const promoType = ['queen', 'rook', 'bishop', 'knight'].includes(promotion) ? promotion : 'queen';

  // The engine is the authority. An illegal move is simply rejected.
  const ok = room.game.makeMove(from[0], from[1], to[0], to[1], promoType);
  if (!ok) return res.status(400).json({ error: 'Illegal move.' });

  chargeClock(room);

  const status = room.game.getGameStatus();
  if (status.over) {
    room.status = status;
    room.turnStartedAt = null;
  }

  bumpVersion(room);
  res.json({ state: snapshot(room, color) });
});

api.post('/rooms/:code/resign', (req, res) => {
  const room = rooms.get(String(req.params.code || '').toUpperCase());
  if (!room) return res.status(404).json({ error: 'Game not found.' });

  const color = seatOf(room, req.body?.token);
  if (!color) return res.status(403).json({ error: 'You are not a player in this game.' });
  if (room.status) return res.json({ state: snapshot(room, color) });

  room.status = { over: true, winner: color === 'white' ? 'black' : 'white', reason: 'resignation' };
  room.turnStartedAt = null;
  bumpVersion(room);
  res.json({ state: snapshot(room, color) });
});

api.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) });
});

app.use('/api', api);

function isSquare(value) {
  return Array.isArray(value) && value.length === 2 &&
    value.every(n => Number.isInteger(n) && n >= 0 && n <= 7);
}

// ---------------------------------------------------------------------------
// Static app. In production the built React bundle is served from this same
// process, so there is one URL and no CORS to configure.
// ---------------------------------------------------------------------------

app.use(express.static(BUILD_DIR));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Unknown endpoint.' });
  res.sendFile(path.join(BUILD_DIR, 'index.html'), err => {
    if (err) res.status(404).send('App not built. Run "npm run build" first.');
  });
});

// ---------------------------------------------------------------------------
// Housekeeping: flag players who run out of time even when nobody is moving,
// and drop rooms nobody has touched in a long while.
// ---------------------------------------------------------------------------

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (checkFlag(room)) bumpVersion(room);
    if (now - room.lastActivity > ROOM_TTL_MS) {
      for (const waiter of room.waiters) {
        clearTimeout(waiter.timer);
        waiter.resolve();
      }
      rooms.delete(code);
    }
  }
}, 1000).unref();

app.listen(PORT, () => {
  console.log(`Chess server listening on port ${PORT}`);
});
