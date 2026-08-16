import React from 'react';
import { PIECE_SYMBOLS } from './ChessGame.mjs';

const FILES = 'abcdefgh';

// Filled glyphs for both colours; the light/dark treatment is done in CSS so
// the two sides share one silhouette.
const GLYPHS = {
  king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟'
};

export default function ChessBoard({
  board,
  onSquareClick,
  selectedSquare,
  legalTargets = [],
  lastMove = null,
  checkSquare = null,
  flipped = false
}) {
  const order = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const squares = [];

  for (const row of order) {
    for (const col of order) {
      const piece = board[row][col];
      const isLight = (row + col) % 2 === 0;
      const isSelected = selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
      const isFrom = lastMove && lastMove.from[0] === row && lastMove.from[1] === col;
      const isTo = lastMove && lastMove.to[0] === row && lastMove.to[1] === col;
      const isCheck = checkSquare && checkSquare[0] === row && checkSquare[1] === col;
      const target = legalTargets.find(t => t.to[0] === row && t.to[1] === col);

      squares.push(
        <div
          key={`${row}-${col}`}
          className={`square ${isLight ? 'light' : 'dark'}`}
          onClick={() => onSquareClick(row, col)}
        >
          {isFrom && !isSelected && <div className="overlay from" />}
          {isTo && !isSelected && <div className="overlay to" />}
          {isSelected && <div className="overlay selected" />}
          {isCheck && <div className="overlay check" />}
          {piece && <span className={`piece ${piece.color}`}>{GLYPHS[piece.type]}</span>}
          {target && (piece ? <div className="capture-hint" /> : <div className="hint" />)}
        </div>
      );
    }
  }

  return (
    <div className="board-frame">
      <div className="board">{squares}</div>

      {/* Coordinates sit on the frame rather than inside the squares */}
      {order.map((col, i) => (
        <span
          key={`f${col}`}
          className="frame-coord file"
          style={{ left: `calc(var(--frame-pad) + ${i} * (var(--board-size) / 8))` }}
        >
          {FILES[col]}
        </span>
      ))}
      {order.map((row, i) => (
        <span
          key={`r${row}`}
          className="frame-coord rank"
          style={{ top: `calc(var(--frame-pad) + ${i} * (var(--board-size) / 8))` }}
        >
          {8 - row}
        </span>
      ))}
    </div>
  );
}

export { GLYPHS, PIECE_SYMBOLS };
