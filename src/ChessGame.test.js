import ChessGame from './ChessGame.mjs';

// ---------------------------------------------------------------------------
// Perft: the standard correctness check for a chess move generator. If these
// node counts match the published values, move generation handles castling,
// en passant, promotion, pins and check evasion correctly.
// Positions from https://www.chessprogramming.org/Perft_Results
// ---------------------------------------------------------------------------

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KIWIPETE = 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';
const POSITION_3 = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';
const POSITION_4 = 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1';
const POSITION_5 = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

describe('perft', () => {
  test.each([
    [1, 20],
    [2, 400],
    [3, 8902],
    [4, 197281]
  ])('starting position depth %i = %i nodes', (depth, expected) => {
    expect(ChessGame.fromFen(START_FEN).perft(depth)).toBe(expected);
  });

  test.each([
    [1, 48],
    [2, 2039],
    [3, 97862]
  ])('kiwipete depth %i = %i nodes', (depth, expected) => {
    expect(ChessGame.fromFen(KIWIPETE).perft(depth)).toBe(expected);
  });

  test.each([
    [1, 14],
    [2, 191],
    [3, 2812],
    [4, 43238]
  ])('position 3 depth %i = %i nodes', (depth, expected) => {
    expect(ChessGame.fromFen(POSITION_3).perft(depth)).toBe(expected);
  });

  test.each([
    [1, 6],
    [2, 264],
    [3, 9467]
  ])('position 4 (promotions) depth %i = %i nodes', (depth, expected) => {
    expect(ChessGame.fromFen(POSITION_4).perft(depth)).toBe(expected);
  });

  test.each([
    [1, 44],
    [2, 1486],
    [3, 62379]
  ])('position 5 depth %i = %i nodes', (depth, expected) => {
    expect(ChessGame.fromFen(POSITION_5).perft(depth)).toBe(expected);
  });
});

describe('FEN round-trip', () => {
  test('starting position serializes back to the same FEN', () => {
    expect(ChessGame.fromFen(START_FEN).toFen()).toBe(START_FEN);
  });

  test('kiwipete serializes back to the same FEN', () => {
    expect(ChessGame.fromFen(KIWIPETE).toFen()).toBe(KIWIPETE);
  });

  test('a double pawn push sets the en passant target square', () => {
    const game = new ChessGame();
    game.makeMove(6, 4, 4, 4); // e2-e4
    expect(game.toFen().split(' ')[3]).toBe('e3');
  });
});

describe('checkmate and stalemate detection', () => {
  test("fool's mate is checkmate", () => {
    const game = new ChessGame();
    game.makeMove(6, 5, 5, 5); // f2-f3
    game.makeMove(1, 4, 3, 4); // e7-e5
    game.makeMove(6, 6, 4, 6); // g2-g4
    game.makeMove(0, 3, 4, 7); // Qd8-h4#

    const status = game.getGameStatus();
    expect(status.over).toBe(true);
    expect(status.reason).toBe('checkmate');
    expect(status.winner).toBe('black');
    expect(game.moveHistory[game.moveHistory.length - 1].san).toBe('Qh4#');
  });

  test('back-rank mate is detected', () => {
    const game = ChessGame.fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    game.makeMove(7, 0, 0, 0); // Ra1-a8#
    expect(game.getGameStatus()).toMatchObject({ over: true, reason: 'checkmate', winner: 'white' });
  });

  test('stalemate is a draw, not a loss', () => {
    const game = ChessGame.fromFen('7k/5Q2/8/8/8/8/8/7K b - - 0 1');
    const status = game.getGameStatus();
    expect(status.over).toBe(true);
    expect(status.reason).toBe('stalemate');
    expect(status.winner).toBeNull();
  });

  test('a king may not move into check', () => {
    // Black rook on d8 covers the whole d-file, so d1 and d2 are off limits.
    const game = ChessGame.fromFen('3r3k/8/8/8/8/8/8/4K3 w - - 0 1');
    const kingMoves = game.getLegalMovesFrom(7, 4).map(m => m.to.join(','));
    expect(kingMoves).not.toContain('7,3'); // d1
    expect(kingMoves).not.toContain('6,3'); // d2
    expect(kingMoves.sort()).toEqual(['6,4', '6,5', '7,5']); // e2, f2, f1
  });

  test('a pinned piece cannot move off the pin line', () => {
    // White knight on e2 is pinned to the king on e1 by the rook on e8.
    const game = ChessGame.fromFen('4r3/8/8/8/8/8/4N3/4K3 w - - 0 1');
    expect(game.getLegalMovesFrom(6, 4)).toHaveLength(0);
  });

  test('when in check only check-resolving moves are legal', () => {
    // Black king on e8 in check from the rook on e1.
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/4R2K b - - 0 1');
    const moves = game.getAllLegalMoves();
    expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      const undo = game.applyMove(move);
      expect(game.isInCheck('black')).toBe(false);
      game.undoMove(undo);
    }
  });
});

describe('special moves', () => {
  test('kingside castling moves both king and rook', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(game.makeMove(7, 4, 7, 6)).toBe(true);
    expect(game.board[7][6]).toMatchObject({ type: 'king', color: 'white' });
    expect(game.board[7][5]).toMatchObject({ type: 'rook', color: 'white' });
    expect(game.board[7][7]).toBeNull();
    expect(game.moveHistory[0].san).toBe('O-O');
  });

  test('castling is illegal through an attacked square', () => {
    // Black rook on f8 attacks f1, which the white king would cross.
    const game = ChessGame.fromFen('5r2/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(game.makeMove(7, 4, 7, 6)).toBe(false);
  });

  test('castling is illegal while in check', () => {
    const game = ChessGame.fromFen('4r3/8/8/8/8/8/8/4K2R w K - 0 1');
    expect(game.makeMove(7, 4, 7, 6)).toBe(false);
  });

  test('castling rights are lost once the rook moves', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/4K2R w K - 0 1');
    game.makeMove(7, 7, 7, 6); // Rh1-g1
    game.makeMove(0, 4, 0, 3); // black king moves
    game.makeMove(7, 6, 7, 7); // Rg1-h1, back home
    game.makeMove(0, 3, 0, 4);
    expect(game.castling.white.kingside).toBe(false);
    expect(game.makeMove(7, 4, 7, 6)).toBe(false);
  });

  test('en passant captures the passed pawn', () => {
    const game = ChessGame.fromFen('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    expect(game.makeMove(3, 4, 2, 3)).toBe(true); // exd6 e.p.
    expect(game.board[2][3]).toMatchObject({ type: 'pawn', color: 'white' });
    expect(game.board[3][3]).toBeNull(); // the black pawn is gone
    expect(game.capturedPieces.black).toHaveLength(1);
  });

  test('en passant expires after one move', () => {
    const game = ChessGame.fromFen('4k3/7p/8/3pP3/8/8/8/4K3 w - d6 0 1');
    game.makeMove(7, 4, 7, 5); // white plays something else
    game.makeMove(1, 7, 2, 7); // black replies
    expect(game.makeMove(3, 4, 2, 3)).toBe(false);
  });

  test('promotion to a chosen piece works', () => {
    const game = ChessGame.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(game.makeMove(1, 0, 0, 0, 'knight')).toBe(true);
    expect(game.board[0][0]).toMatchObject({ type: 'knight', color: 'white' });
    expect(game.moveHistory[0].san).toBe('a8=N');
  });

  test('promotion defaults to a queen', () => {
    const game = ChessGame.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    game.makeMove(1, 0, 0, 0);
    expect(game.board[0][0].type).toBe('queen');
  });
});

describe('draw conditions', () => {
  test('king versus king is insufficient material', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(game.getGameStatus()).toMatchObject({ over: true, reason: 'insufficient material' });
  });

  test('king and bishop versus king is insufficient material', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/3BK3 w - - 0 1');
    expect(game.getGameStatus().reason).toBe('insufficient material');
  });

  test('a single pawn is sufficient material', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.getGameStatus().over).toBe(false);
  });

  test('the 50-move rule ends the game', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 99 1');
    game.makeMove(7, 4, 7, 3); // a quiet king move takes the clock to 100
    expect(game.getGameStatus()).toMatchObject({ over: true, reason: '50-move rule' });
  });

  test('a pawn move resets the halfmove clock', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/4P3/4K3 w - - 40 1');
    game.makeMove(6, 4, 5, 4);
    expect(game.halfmoveClock).toBe(0);
  });

  test('threefold repetition ends the game', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/R3K2R w - - 0 1');
    // Shuffle both rooks back and forth until the position repeats three times.
    for (let i = 0; i < 2; i++) {
      game.makeMove(7, 0, 7, 1);
      game.makeMove(0, 4, 0, 3);
      game.makeMove(7, 1, 7, 0);
      game.makeMove(0, 3, 0, 4);
    }
    expect(game.getGameStatus()).toMatchObject({ over: true, reason: 'threefold repetition' });
  });
});

describe('algebraic notation', () => {
  test('records a standard opening correctly', () => {
    const game = new ChessGame();
    game.makeMove(6, 4, 4, 4); // e4
    game.makeMove(1, 4, 3, 4); // e5
    game.makeMove(7, 6, 5, 5); // Nf3
    game.makeMove(0, 1, 2, 2); // Nc6
    game.makeMove(7, 5, 3, 1); // Bb5
    expect(game.moveHistory.map(m => m.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  test('marks captures and checks', () => {
    const game = ChessGame.fromFen('4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1');
    game.makeMove(4, 4, 3, 3); // exd5
    expect(game.moveHistory[0].san).toBe('exd5');
  });

  test('disambiguates by file when two rooks share a rank', () => {
    // Rooks on a1 and h1 can both reach d1, so the file is needed.
    const game = ChessGame.fromFen('4k3/8/8/8/4K3/8/8/R6R w - - 0 1');
    game.makeMove(7, 0, 7, 3);
    expect(game.moveHistory[0].san).toBe('Rad1');
  });

  test('disambiguates by rank when two rooks share a file', () => {
    // Rooks on a1 and a8 can both reach a4, and they share the a-file.
    const game = ChessGame.fromFen('R7/8/8/7k/8/8/8/R3K3 w - - 0 1');
    game.makeMove(7, 0, 4, 0);
    expect(game.moveHistory[0].san).toBe('R1a4');
  });

  test('omits disambiguation when the second piece is blocked', () => {
    // The h1 rook cannot reach b1 because the king on e1 is in the way.
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/8/R3K2R w KQ - 0 1');
    game.makeMove(7, 0, 7, 1);
    expect(game.moveHistory[0].san).toBe('Rb1');
  });
});

describe('bot', () => {
  test('every level returns a legal move from the opening position', () => {
    for (const level of [400, 800, 1200, 1800, 2200]) {
      const game = new ChessGame();
      game.setBotLevel(level);
      const move = game.getBotMove();
      expect(move).toHaveLength(4);
      const legal = game.getAllLegalMoves()
        .some(m => m.from[0] === move[0] && m.from[1] === move[1] && m.to[0] === move[2] && m.to[1] === move[3]);
      expect(legal).toBe(true);
    }
  });

  test('returns null when there are no legal moves', () => {
    const game = ChessGame.fromFen('7k/5Q2/8/8/8/8/8/7K b - - 0 1'); // stalemate
    game.setBotLevel(1800);
    expect(game.getBotMove()).toBeNull();
  });

  test('a strong bot takes a free queen', () => {
    // Black queen on d5 is hanging; the white pawn on e4 can take it.
    const game = ChessGame.fromFen('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    game.setBotLevel(2200);
    expect(game.getBotMove()).toEqual([4, 4, 3, 3]);
  });

  test('a strong bot finds mate in one', () => {
    const game = ChessGame.fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    game.setBotLevel(2200);
    expect(game.getBotMove()).toEqual([7, 0, 0, 0]); // Ra8#
  });

  test('a strong bot escapes check rather than ignoring it', () => {
    const game = ChessGame.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    game.setBotLevel(1800);
    const move = game.getBotMove();
    const next = new ChessGame(game);
    next.makeMove(move[0], move[1], move[2], move[3]);
    expect(next.isInCheck('white')).toBe(false);
  });
});

describe('game state copying', () => {
  test('copying a game does not alias the board', () => {
    const game = new ChessGame();
    const copy = new ChessGame(game);
    copy.makeMove(6, 4, 4, 4);
    expect(game.board[6][4]).not.toBeNull();
    expect(game.board[4][4]).toBeNull();
    expect(game.currentTurn).toBe('white');
  });

  test('copying preserves castling rights and en passant state', () => {
    const game = ChessGame.fromFen('4k3/8/8/3pP3/8/8/8/R3K2R w KQ d6 0 1');
    const copy = new ChessGame(game);
    expect(copy.toFen()).toBe(game.toFen());
    copy.castling.white.kingside = false;
    expect(game.castling.white.kingside).toBe(true);
  });

  test('serialize and deserialize round-trips a position', () => {
    const game = new ChessGame();
    game.makeMove(6, 4, 4, 4);
    game.makeMove(1, 4, 3, 4);
    const restored = ChessGame.deserialize(JSON.parse(JSON.stringify(game.serialize())));
    expect(restored.toFen()).toBe(game.toFen());
    expect(restored.getAllLegalMoves().length).toBe(game.getAllLegalMoves().length);
  });
});
