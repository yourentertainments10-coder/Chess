import React, { useState, useEffect } from 'react';
import ChessBoard from './ChessBoard';
import ChessGame from './ChessGame';
import GameModeSelector from './GameModeSelector';
import './App.css';

function App() {
  const [game, setGame] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  const [lastMoveTime, setLastMoveTime] = useState(Date.now());

  // Timer effect
  useEffect(() => {
    if (!game || game.getGameMode() === 'bot' && game.getCurrentTurn() === 'black') return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastMoveTime;
      const newGame = new ChessGame(game);
      newGame.updateTime(delta);

      if (newGame.isTimeUp()) {
        // Time's up - opponent wins
        alert(`Time's up! ${newGame.getCurrentTurn() === 'white' ? 'Black' : 'White'} wins!`);
        setGame(null);
        setGameMode(null);
        return;
      }

      setGame(newGame);
      setLastMoveTime(now);
    }, 100);

    return () => clearInterval(interval);
  }, [game, lastMoveTime]);

  // Bot move effect
  useEffect(() => {
    if (game && game.getGameMode() === 'bot' && game.getCurrentTurn() === 'black') {
      const timer = setTimeout(() => {
        const botMove = game.getBotMove();
        if (botMove) {
          const [fromRow, fromCol, toRow, toCol] = botMove;
          const newGame = new ChessGame(game);
          newGame.makeMove(fromRow, fromCol, toRow, toCol);
          setGame(newGame);
          setLastMoveTime(Date.now());
        }
      }, 500); // Small delay for bot move

      return () => clearTimeout(timer);
    }
  }, [game]);

  // Check for game end conditions
  useEffect(() => {
    if (game) {
      const isCheckmate = game.isCheckmate(game.getCurrentTurn());

      if (isCheckmate) {
        alert(`Checkmate! ${game.getCurrentTurn() === 'white' ? 'Black' : 'White'} wins!`);
        setGame(null);
        setGameMode(null);
      }
    }
  }, [game]);

  const handleModeSelect = (mode, botLevel = null) => {
    const newGame = new ChessGame();
    newGame.setGameMode(mode);
    if (mode === 'friend') {
      newGame.setGameId();
    }
    if (mode === 'bot' && botLevel) {
      newGame.setBotLevel(botLevel);
    }
    setGame(newGame);
    setGameMode(mode);
    setLastMoveTime(Date.now());
  };

  const handleSquareClick = (row, col) => {
    if (!game) return;

    if (selectedSquare) {
      // Try to make a move
      const success = game.makeMove(selectedSquare[0], selectedSquare[1], row, col);
      if (success) {
        setGame(new ChessGame(game)); // Force re-render
        setSelectedSquare(null);
        setLastMoveTime(Date.now());
      } else {
        setSelectedSquare(null); // Invalid move, deselect
      }
    } else {
      // Select a piece
      const piece = game.getBoard()[row][col];
      if (piece && piece.color === game.getCurrentTurn()) {
        setSelectedSquare([row, col]);
      }
    }
  };

  const resetGame = () => {
    setGame(null);
    setGameMode(null);
    setSelectedSquare(null);
  };

  const shareGame = () => {
    if (game && game.getGameId()) {
      const url = `${window.location.origin}${window.location.pathname}?game=${game.getGameId()}`;
      navigator.clipboard.writeText(url).then(() => {
        alert('Game link copied to clipboard!');
      });
    }
  };

  // Load game from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const gameId = urlParams.get('game');
    if (gameId && !game) {
      // In a real app, you'd fetch the game state from a server
      // For now, just create a new game with the ID
      const newGame = new ChessGame();
      newGame.setGameId(gameId);
      newGame.setGameMode('friend');
      setGame(newGame);
      setGameMode('friend');
      setLastMoveTime(Date.now());
    }
  }, []);

  if (!gameMode) {
    return <GameModeSelector onSelectMode={handleModeSelect} />;
  }

  const formatTime = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="App">
      <h1>Chess Game</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <strong>White: {formatTime(game.getTimeRemaining('white'))}</strong>
        </div>
        <div>
          <strong>Black: {formatTime(game.getTimeRemaining('black'))}</strong>
        </div>
      </div>
      <ChessBoard
        board={game.getBoard()}
        onSquareClick={handleSquareClick}
        selectedSquare={selectedSquare}
        game={game}
      />
      <p>Current turn: {game.getCurrentTurn()}</p>
      {game.getGameMode() === 'friend' && (
        <div style={{ marginTop: '20px' }}>
          <button onClick={shareGame}>Share Game Link</button>
        </div>
      )}
      <div style={{ marginTop: '20px' }}>
        <button onClick={resetGame}>New Game</button>
      </div>
    </div>
  );
}

export default App;
