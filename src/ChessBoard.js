import React from 'react';

export default function ChessBoard({ board, onSquareClick, selectedSquare, game }) {
  const isSquareSelected = (row, col) => {
    return selectedSquare && selectedSquare[0] === row && selectedSquare[1] === col;
  };

  const isKingInCheck = (row, col) => {
    if (!game) return false;
    const piece = board[row][col];
    if (!piece || piece.type !== 'king') return false;
    return game.isInCheck(piece.color);
  };

  const getSquareColor = (row, col) => {
    const isLight = (row + col) % 2 === 0;
    return isLight ? '#f0d9b5' : '#b58863';
  };

  return (
    <div style={{ maxWidth: 600, margin: '20px auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', width: '560px', height: '560px', border: '2px solid #333' }}>
        {board.map((row, rowIndex) =>
          row.map((piece, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              onClick={() => onSquareClick(rowIndex, colIndex)}
              style={{
                width: '70px',
                height: '70px',
                backgroundColor: isKingInCheck(rowIndex, colIndex) ? '#ff0000' : (isSquareSelected(rowIndex, colIndex) ? '#ffff00' : getSquareColor(rowIndex, colIndex)),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '40px',
                cursor: 'pointer',
                border: '1px solid #333'
              }}
            >
              {piece ? piece.getSymbol() : ''}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
