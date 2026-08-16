import React, { useState, useEffect, useRef, useCallback } from 'react';
import ChessBoard, { GLYPHS } from './ChessBoard';
import ChessGame, { PIECE_VALUES } from './ChessGame.mjs';
import GameModeSelector, { BOT_LEVELS } from './GameModeSelector';
import OnlineLobby from './OnlineLobby';
import { useOnlineRoom, shareUrlFor } from './onlineClient';
import './App.css';

const PROMOTION_PIECES = ['queen', 'rook', 'bishop', 'knight'];

function formatTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function materialPoints(pieces) {
  return pieces.reduce((sum, p) => sum + Math.round(PIECE_VALUES[p.type] / 100), 0);
}

function App() {
  const [game, setGame] = useState(null);
  const [gameMode, setGameMode] = useState(null);
  const [gameSettings, setGameSettings] = useState(null);
  const [selected, setSelected] = useState(null);
  const [legalTargets, setLegalTargets] = useState([]);
  const [pendingPromotion, setPendingPromotion] = useState(null);
  const [gameOver, setGameOver] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [clocks, setClocks] = useState({ white: 600000, black: 600000 });
  const [botThinking, setBotThinking] = useState(false);
  const [onlineSession, setOnlineSession] = useState(null);
  const [onlineClocks, setOnlineClocks] = useState(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const moveListRef = useRef(null);

  const isOnline = gameMode === 'online';
  const online = useOnlineRoom(isOnline ? onlineSession : null);

  // Opening a shared invite link should land on the board, not the main menu.
  // Switching to online mode renders the lobby, which joins from the ?g= code.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('g')) setGameMode('online');
  }, []);

  const startGame = useCallback((mode, options = {}) => {
    const newGame = new ChessGame();
    newGame.setGameMode(mode);
    const timeMs = (options.minutes || 10) * 60 * 1000;
    newGame.setTimeControl(timeMs);
    if (mode === 'bot' && options.botLevel) newGame.setBotLevel(options.botLevel);
    setGame(newGame);
    setGameMode(mode);
    setGameSettings({ mode, ...options });
    setClocks({ white: timeMs, black: timeMs });
    setSelected(null);
    setLegalTargets([]);
    setPendingPromotion(null);
    setGameOver(null);
    setFlipped(false);
    setBotThinking(false);
  }, []);

  const handleModeSelect = useCallback((mode, options = {}) => {
    if (mode === 'online') {
      setGameMode('online');
      setOnlineSession(null);
      setSelected(null);
      setLegalTargets([]);
      setPendingPromotion(null);
      return;
    }
    startGame(mode, options);
  }, [startGame]);

  const doMove = useCallback((fromRow, fromCol, toRow, toCol, promoType = 'queen') => {
    setGame(prevGame => {
      if (!prevGame) return prevGame;
      const next = new ChessGame(prevGame);
      if (!next.makeMove(fromRow, fromCol, toRow, toCol, promoType)) return prevGame;
      const status = next.getGameStatus();
      if (status.over) setGameOver(status);
      return next;
    });
    setSelected(null);
    setLegalTargets([]);
    setPendingPromotion(null);
  }, []);

  // Local clock. Deducts elapsed wall time rather than a fixed step per tick,
  // so it stays accurate if timers drift or the tab is throttled. Online games
  // use the server's clock instead.
  useEffect(() => {
    if (isOnline || !game || gameOver) return;
    const turn = game.getCurrentTurn();
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setClocks(prev => {
        const remaining = prev[turn] - elapsed;
        if (remaining <= 0) {
          setGameOver({ over: true, winner: turn === 'white' ? 'black' : 'white', reason: 'timeout' });
          return { ...prev, [turn]: 0 };
        }
        return { ...prev, [turn]: remaining };
      });
    }, 200);
    return () => clearInterval(interval);
  }, [isOnline, game, gameOver]);

  // Resync the online clock every time the server speaks.
  useEffect(() => {
    if (online.state?.clocks) setOnlineClocks(online.state.clocks);
  }, [online.state]);

  // Tick the online clock locally between server updates, otherwise it would
  // visibly jump each time a poll returns. The server stays authoritative.
  useEffect(() => {
    if (!isOnline || !online.state?.started || online.state?.status || !online.game) return;
    const turn = online.game.getCurrentTurn();
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - last;
      last = now;
      setOnlineClocks(prev => (prev ? { ...prev, [turn]: Math.max(0, prev[turn] - elapsed) } : prev));
    }, 200);
    return () => clearInterval(interval);
  }, [isOnline, online.state, online.game]);

  // Show the board from the seated player's side.
  useEffect(() => {
    if (isOnline && online.state?.yourColor) setFlipped(online.state.yourColor === 'black');
  }, [isOnline, online.state?.yourColor]);

  // Bot moves. The search blocks the main thread, so yield a frame first to let
  // the player's own move paint before the bot starts thinking.
  useEffect(() => {
    if (isOnline || !game || gameOver) return;
    if (game.getGameMode() !== 'bot' || game.getCurrentTurn() !== 'black') return;
    setBotThinking(true);
    const timer = setTimeout(() => {
      const botMove = game.getBotMove();
      setBotThinking(false);
      if (botMove) doMove(botMove[0], botMove[1], botMove[2], botMove[3], 'queen');
    }, 220);
    return () => { clearTimeout(timer); setBotThinking(false); };
  }, [isOnline, game, gameOver, doMove]);

  useEffect(() => {
    if (moveListRef.current) moveListRef.current.scrollTop = moveListRef.current.scrollHeight;
  }, [game, online.state]);

  const backToMenu = useCallback(() => {
    setGame(null);
    setGameMode(null);
    setGameOver(null);
    setSelected(null);
    setLegalTargets([]);
    setPendingPromotion(null);
    setOnlineSession(null);
    setOnlineClocks(null);
    // Drop ?g= so a refresh does not rejoin the game you just left.
    if (window.location.search.includes('g=')) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // ---- Screens that come before a board exists ----

  if (!gameMode) {
    return <GameModeSelector onSelectMode={handleModeSelect} />;
  }

  if (isOnline && !onlineSession) {
    return <OnlineLobby onReady={setOnlineSession} onBack={backToMenu} />;
  }

  const activeGame = isOnline ? online.game : game;
  const activeOver = isOnline ? online.state?.status : gameOver;
  const activeClocks = (isOnline ? onlineClocks : clocks) || { white: 0, black: 0 };

  // A vanished room is terminal, so say so plainly rather than leaving a stale
  // board on screen that no longer accepts moves.
  if (isOnline && online.gone) {
    return (
      <div className="menu-screen">
        <div className="menu-mark">♞</div>
        <h1 className="menu-title">Game Over</h1>
        <div className="menu-rule" />
        <p className="menu-subtitle">{online.error}</p>
        <button className="btn primary big" onClick={backToMenu}>Back to Main Menu</button>
      </div>
    );
  }

  if (!activeGame) {
    return (
      <div className="menu-screen">
        <div className="menu-mark">♞</div>
        <p className="menu-subtitle">{online.error || 'Connecting…'}</p>
        <button className="btn" onClick={backToMenu}>Back to Main Menu</button>
      </div>
    );
  }

  const yourColor = isOnline ? online.state?.yourColor : null;
  const waitingForOpponent = isOnline && online.state && !online.state.started;
  const turn = activeGame.getCurrentTurn();
  const yourTurn = !isOnline || (yourColor === turn && !waitingForOpponent);

  const inCheck = activeGame.isInCheck(turn);
  const checkSquare = inCheck ? activeGame.findKing(turn) : null;
  const history = activeGame.moveHistory;
  const lastMove = history.length > 0 ? history[history.length - 1] : null;
  const isBot = !isOnline && activeGame.getGameMode() === 'bot';

  // ---- Move handling ----

  const commitMove = (from, to, promoType = 'queen') => {
    if (isOnline) {
      online.sendMove(from, to, promoType);
      setSelected(null);
      setLegalTargets([]);
      setPendingPromotion(null);
    } else {
      doMove(from[0], from[1], to[0], to[1], promoType);
    }
  };

  const handleSquareClick = (row, col) => {
    if (activeOver || pendingPromotion) return;
    if (isBot && turn === 'black') return;
    if (isOnline && !yourTurn) return;

    const piece = activeGame.getBoard()[row][col];

    if (selected) {
      const target = legalTargets.find(t => t.to[0] === row && t.to[1] === col);
      if (target) {
        if (target.promotion) setPendingPromotion({ from: selected, to: [row, col] });
        else commitMove(selected, [row, col]);
        return;
      }
      if (piece && piece.color === turn && !(selected[0] === row && selected[1] === col)) {
        setSelected([row, col]);
        setLegalTargets(activeGame.getLegalMovesFrom(row, col));
        return;
      }
      setSelected(null);
      setLegalTargets([]);
    } else if (piece && piece.color === turn) {
      setSelected([row, col]);
      setLegalTargets(activeGame.getLegalMovesFrom(row, col));
    }
  };

  const handlePromotion = (pieceType) => {
    if (!pendingPromotion) return;
    commitMove(pendingPromotion.from, pendingPromotion.to, pieceType);
  };

  const handleResign = () => {
    if (activeOver) return;
    if (isOnline) {
      online.resign();
      return;
    }
    const loser = isBot ? 'white' : turn;
    setGameOver({ over: true, winner: loser === 'white' ? 'black' : 'white', reason: 'resignation' });
  };

  const rematch = () => {
    if (isOnline) {
      backToMenu();
      return;
    }
    if (gameSettings) startGame(gameSettings.mode, gameSettings);
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(shareUrlFor(online.state.code));
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    } catch {
      setCopiedInvite(false);
    }
  };

  // ---- Derived display data ----

  const movePairs = [];
  for (let i = 0; i < history.length; i += 2) {
    movePairs.push({ num: i / 2 + 1, white: history[i]?.san, black: history[i + 1]?.san });
  }

  const takenByWhite = activeGame.capturedPieces.black;
  const takenByBlack = activeGame.capturedPieces.white;
  const whitePoints = materialPoints(takenByWhite);
  const blackPoints = materialPoints(takenByBlack);

  const playerInfo = (color) => {
    if (isBot) {
      const level = activeGame.getBotLevel();
      // The difficulty name is both shorter and more useful than "Computer",
      // which matters in the player strip on a narrow phone.
      const label = BOT_LEVELS.find(l => l.rating === level)?.name || 'Bot';
      return color === 'black'
        ? { name: `${label} · ${level}`, avatar: '🤖' }
        : { name: 'You', avatar: '♟' };
    }
    if (isOnline) {
      const mine = color === yourColor;
      const seated = online.state?.seats?.[color];
      const here = online.state?.presence?.[color];
      const base = color === 'white' ? 'White' : 'Black';
      return {
        name: mine ? `You · ${base}` : seated ? base : 'Waiting…',
        avatar: color === 'white' ? '♔' : '♚',
        offline: seated && !here && !mine
      };
    }
    return color === 'black' ? { name: 'Black', avatar: '♚' } : { name: 'White', avatar: '♔' };
  };

  const renderPlayer = (color, side) => {
    const info = playerInfo(color);
    const isActive = turn === color && !activeOver && !waitingForOpponent;
    return (
      <div className={`player-bar ${side} ${isActive ? 'active' : ''}`}>
        <div className="player-avatar">{info.avatar}</div>
        <div className="player-details">
          <div className="player-name">
            {info.name}
            {isBot && color === 'black' && botThinking && <span className="thinking"> · thinking</span>}
            {info.offline && <span className="thinking"> · reconnecting</span>}
          </div>
          <div className={`clock ${isActive ? 'active' : ''} ${activeClocks[color] < 30000 ? 'low' : ''}`}>
            {formatTime(activeClocks[color])}
          </div>
        </div>
      </div>
    );
  };

  const statusText = activeOver
    ? (activeOver.winner
        ? `${activeOver.winner === 'white' ? 'White' : 'Black'} won by ${activeOver.reason}`
        : `Draw — ${activeOver.reason}`)
    : waitingForOpponent
      ? 'Waiting for your opponent to join'
      : inCheck
        ? `${turn === 'white' ? 'White' : 'Black'} is in check`
        : isOnline
          ? (yourTurn ? 'Your move' : 'Opponent to move')
          : `${turn === 'white' ? 'White' : 'Black'} to move`;

  const captureSide = (label, pieces, advantage) => (
    <div className="capture-side">
      <div className="capture-label">{label}</div>
      <div className="captured-row">
        {pieces.map((p, i) => (
          <span key={i} className={`captured-piece ${p.color}`}>{GLYPHS[p.type]}</span>
        ))}
        {advantage > 0 && <span className="material-advantage">+{advantage}</span>}
      </div>
    </div>
  );

  const headerTag = isOnline ? `Online · ${online.state?.code || ''}` : isBot ? 'vs Computer' : 'Pass & Play';

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo">♞</span>
        <span className="wordmark">Gambit<em>·</em>Board</span>
        <span className="header-tag">{headerTag}</span>
      </header>

      {isOnline && online.error && <div className="connection-banner">{online.error}</div>}

      <div className="game-layout">
        <div className="board-column">
          <div className="player-strip">
            {renderPlayer(flipped ? 'black' : 'white', 'left')}
            <span className="strip-divider">VS</span>
            {renderPlayer(flipped ? 'white' : 'black', 'right')}
          </div>

          <div className="board-wrap">
            <ChessBoard
              board={activeGame.getBoard()}
              onSquareClick={handleSquareClick}
              selectedSquare={selected}
              legalTargets={legalTargets}
              lastMove={lastMove}
              checkSquare={checkSquare}
              flipped={flipped}
            />

            {waitingForOpponent && !activeOver && (
              <div className="gameover-overlay">
                <div className="gameover-dialog">
                  <div className="promotion-title">Invite code</div>
                  <div className="invite-code">{online.state?.code}</div>
                  <div className="gameover-reason">Share this to start the game</div>
                  <div className="gameover-buttons">
                    <button className="btn primary" onClick={copyInvite}>
                      {copiedInvite ? 'Link copied' : 'Copy invite link'}
                    </button>
                    <button className="btn" onClick={backToMenu}>Cancel</button>
                  </div>
                </div>
              </div>
            )}

            {pendingPromotion && (
              <div className="promotion-overlay">
                <div className="promotion-dialog">
                  <div className="promotion-title">Promote to</div>
                  <div className="promotion-choices">
                    {PROMOTION_PIECES.map(type => (
                      <button key={type} className="promotion-btn" onClick={() => handlePromotion(type)}>
                        <span className={`piece ${turn}`}>{GLYPHS[type]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeOver && (
              <div className="gameover-overlay">
                <div className="gameover-dialog">
                  <div className="gameover-title">
                    {activeOver.winner
                      ? (isOnline
                          ? (activeOver.winner === yourColor ? 'You win' : 'You lose')
                          : `${activeOver.winner === 'white' ? 'White' : 'Black'} wins`)
                      : 'Draw'}
                  </div>
                  <div className="gameover-reason">by {activeOver.reason}</div>
                  <div className="gameover-buttons">
                    <button className="btn primary" onClick={rematch}>
                      {isOnline ? 'New Game' : 'Rematch'}
                    </button>
                    <button className="btn" onClick={backToMenu}>Main Menu</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rail">
          <div className="card status-card">
            <div className="status-line">
              <span className={`status-dot ${activeOver ? 'over' : inCheck ? 'check' : ''}`} />
              {statusText}
            </div>
            <div className="capture-track">
              {captureSide('White took', takenByWhite, whitePoints - blackPoints)}
              {captureSide('Black took', takenByBlack, blackPoints - whitePoints)}
            </div>
          </div>

          <div className="card moves-card">
            <div className="card-head">Moves</div>
            <div className="move-list" ref={moveListRef}>
              {movePairs.length === 0 && <div className="move-list-empty">No moves yet</div>}
              {movePairs.map(pair => (
                <div key={pair.num} className="move-row">
                  <span className="move-num">{pair.num}.</span>
                  <span className={`move-san ${history.length % 2 === 1 && pair.num === movePairs.length ? 'latest' : ''}`}>
                    {pair.white}
                  </span>
                  <span className={`move-san ${history.length % 2 === 0 && pair.num === movePairs.length ? 'latest' : ''}`}>
                    {pair.black || ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rail-actions">
            <button className="btn" onClick={() => setFlipped(f => !f)}>Flip Board</button>
            <button className="btn danger" onClick={handleResign} disabled={!!activeOver}>Resign</button>
            <button className="btn wide" onClick={backToMenu}>Main Menu</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
