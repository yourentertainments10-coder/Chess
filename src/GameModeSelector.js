import React, { useState } from 'react';

export const BOT_LEVELS = [
  { rating: 400, name: 'Novice', description: 'Learning the moves' },
  { rating: 800, name: 'Casual', description: 'Spots captures, misses plans' },
  { rating: 1200, name: 'Club', description: 'Solid tactics, punishes blunders' },
  { rating: 1600, name: 'Strong', description: 'Calculates ahead, rarely slips' },
  { rating: 2000, name: 'Expert', description: 'Deep search, few weaknesses' },
  { rating: 2400, name: 'Master', description: 'Plays the best move it finds' }
];

const TIME_CONTROLS = [
  { minutes: 3, label: '3', type: 'Blitz' },
  { minutes: 5, label: '5', type: 'Blitz' },
  { minutes: 10, label: '10', type: 'Rapid' },
  { minutes: 30, label: '30', type: 'Classical' }
];

export default function GameModeSelector({ onSelectMode }) {
  const [botLevel, setBotLevel] = useState(1200);
  const [minutes, setMinutes] = useState(10);

  return (
    <div className="menu-screen">
      <div className="menu-mark">♞</div>
      <h1 className="menu-title">Gambit<em>·</em>Board</h1>
      <div className="menu-rule" />
      <p className="menu-subtitle">Play a friend across the table, or take on the engine</p>

      <div className="menu-section">
        <div className="menu-section-title">Minutes per side</div>
        <div className="chip-row">
          {TIME_CONTROLS.map(tc => (
            <button
              key={tc.minutes}
              className={`chip ${minutes === tc.minutes ? 'selected' : ''}`}
              onClick={() => setMinutes(tc.minutes)}
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
          <h3>Versus Engine</h3>
          <p>Six strengths, from novice to master</p>
          <select
            className="level-select"
            value={botLevel}
            onChange={e => setBotLevel(parseInt(e.target.value, 10))}
          >
            {BOT_LEVELS.map(l => (
              <option key={l.rating} value={l.rating}>
                {l.name} ({l.rating}) — {l.description}
              </option>
            ))}
          </select>
          <button className="btn primary big" onClick={() => onSelectMode('bot', { botLevel, minutes })}>
            Start Game
          </button>
        </div>

        <div className="menu-card">
          <div className="menu-card-icon">♟</div>
          <h3>Pass &amp; Play</h3>
          <p>Two players sharing one screen</p>
          <button className="btn primary big" onClick={() => onSelectMode('local', { minutes })}>
            Start Game
          </button>
        </div>

        <div className="menu-card">
          <div className="menu-card-icon">♛</div>
          <h3>Play Online</h3>
          <p>Send a link and play from anywhere</p>
          <button className="btn primary big" onClick={() => onSelectMode('online')}>
            Start Game
          </button>
        </div>
      </div>
    </div>
  );
}
