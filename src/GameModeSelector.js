import React, { useState } from 'react';

export default function GameModeSelector({ onSelectMode }) {
  const [selectedBotLevel, setSelectedBotLevel] = useState(1200);

  const modes = [
    {
      id: 'local',
      title: 'Play Local',
      description: 'Play with a friend on the same device',
      icon: '👥'
    },
    {
      id: 'bot',
      title: 'Play vs Bot',
      description: 'Challenge the computer',
      icon: '🤖',
      hasDifficulty: true
    },
    {
      id: 'friend',
      title: 'Play with Friend',
      description: 'Share a link to play with someone online',
      icon: '🔗'
    },
    {
      id: 'online',
      title: 'Online Match',
      description: 'Find opponents online (coming soon)',
      icon: '🌐',
      disabled: true
    }
  ];

  const botLevels = [
    { rating: 400, name: 'Beginner (400)', description: 'Simple moves, random play style' },
    { rating: 700, name: 'Casual Player (700)', description: 'Avoids blunders, basic development' },
    { rating: 1300, name: 'Club Player (1300)', description: 'Tactical awareness, center control' },
    { rating: 1700, name: 'Intermediate (1700)', description: 'Positional play, understands structures' },
    { rating: 2100, name: 'Advanced (2100)', description: 'Strong tactical and positional ideas' },
    { rating: 2500, name: 'Master (2500+)', description: 'Engine-like precision and depth' }
  ];

  const handleBotSelect = () => {
    onSelectMode('bot', selectedBotLevel);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      backgroundColor: '#f0d9b5',
      padding: '20px'
    }}>
      <h1 style={{ color: '#333', marginBottom: '40px' }}>Chess Game</h1>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        maxWidth: '800px',
        width: '100%'
      }}>
        {modes.map(mode => (
          <div key={mode.id}>
            <button
              onClick={() => !mode.disabled && (mode.id === 'bot' ? handleBotSelect() : onSelectMode(mode.id))}
              disabled={mode.disabled}
              style={{
                padding: '30px',
                border: '2px solid #333',
                borderRadius: '10px',
                backgroundColor: mode.disabled ? '#ccc' : '#fff',
                cursor: mode.disabled ? 'not-allowed' : 'pointer',
                fontSize: '18px',
                textAlign: 'center',
                transition: 'background-color 0.3s',
                opacity: mode.disabled ? 0.6 : 1,
                width: '100%'
              }}
              onMouseOver={(e) => !mode.disabled && (e.target.style.backgroundColor = '#f0f0f0')}
              onMouseOut={(e) => !mode.disabled && (e.target.style.backgroundColor = '#fff')}
            >
              <div style={{ fontSize: '48px', marginBottom: '10px' }}>{mode.icon}</div>
              <h3 style={{ margin: '10px 0', color: '#333' }}>{mode.title}</h3>
              <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>{mode.description}</p>
            </button>
            {mode.hasDifficulty && (
              <div style={{ marginTop: '10px', textAlign: 'center' }}>
                <select
                  value={selectedBotLevel}
                  onChange={(e) => setSelectedBotLevel(parseInt(e.target.value))}
                  style={{
                    padding: '8px',
                    borderRadius: '5px',
                    border: '1px solid #333',
                    fontSize: '14px',
                    width: '100%',
                    maxWidth: '200px'
                  }}
                >
                  {botLevels.map(level => (
                    <option key={level.rating} value={level.rating}>
                      {level.rating} - {level.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
