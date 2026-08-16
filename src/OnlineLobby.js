import React, { useState, useEffect, useCallback } from 'react';
import { createRoom, joinRoom, recallSeat, shareUrlFor } from './onlineClient';

const TIME_CONTROLS = [
  { minutes: 3, label: '3', type: 'Blitz' },
  { minutes: 5, label: '5', type: 'Blitz' },
  { minutes: 10, label: '10', type: 'Rapid' },
  { minutes: 30, label: '30', type: 'Classical' }
];

export default function OnlineLobby({ onReady, onBack }) {
  const [minutes, setMinutes] = useState(10);
  const [codeInput, setCodeInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  // Set once a room exists and we are waiting for the other player.
  const [hosted, setHosted] = useState(null);

  const join = useCallback(async (code) => {
    setBusy(true);
    setError(null);
    try {
      const saved = recallSeat(code);
      const data = await joinRoom(code, saved?.token || null);
      onReady(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [onReady]);

  // Opening a shared link drops you straight into that game.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('g');
    if (code) {
      setCodeInput(code.toUpperCase());
      join(code.toUpperCase());
    }
  }, [join]);

  const host = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await createRoom(minutes);
      setHosted(data);
      // The host is already seated, so hand control over and let the game
      // screen show the waiting state with the board in place.
      onReady(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!hosted) return;
    try {
      await navigator.clipboard.writeText(shareUrlFor(hosted.code));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it manually.');
    }
  };

  return (
    <div className="menu-screen">
      <div className="menu-mark">♞</div>
      <h1 className="menu-title">Play Online</h1>
      <div className="menu-rule" />
      <p className="menu-subtitle">Create a game and send the link, or enter a code</p>

      {error && <div className="lobby-error">{error}</div>}

      <div className="menu-section">
        <div className="menu-section-title">Minutes per side</div>
        <div className="chip-row">
          {TIME_CONTROLS.map(tc => (
            <button
              key={tc.minutes}
              className={`chip ${minutes === tc.minutes ? 'selected' : ''}`}
              onClick={() => setMinutes(tc.minutes)}
              disabled={busy}
            >
              <span className="chip-label">{tc.label}</span>
              <span className="chip-sub">{tc.type}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="menu-cards">
        <div className="menu-card">
          <div className="menu-card-icon">♜</div>
          <h3>Create Game</h3>
          <p>You play White. Share the link with your opponent.</p>
          <button className="btn primary big" onClick={host} disabled={busy}>
            {busy ? 'Creating…' : 'Create Game'}
          </button>
          {hosted && (
            <button className="btn big" onClick={copyLink}>
              {copied ? 'Link copied' : 'Copy invite link'}
            </button>
          )}
        </div>

        <div className="menu-card">
          <div className="menu-card-icon">♟</div>
          <h3>Join Game</h3>
          <p>Enter the code your opponent sent you.</p>
          <input
            className="code-input"
            value={codeInput}
            onChange={e => setCodeInput(e.target.value.toUpperCase().slice(0, 8))}
            placeholder="ABCDE"
            spellCheck="false"
            autoCapitalize="characters"
            aria-label="Game code"
          />
          <button
            className="btn primary big"
            onClick={() => join(codeInput.trim())}
            disabled={busy || codeInput.trim().length < 4}
          >
            {busy ? 'Joining…' : 'Join Game'}
          </button>
        </div>
      </div>

      <button className="btn lobby-back" onClick={onBack} disabled={busy}>
        Back to Main Menu
      </button>
    </div>
  );
}
