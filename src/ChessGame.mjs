// ChessGame.js - Chess rules engine + bot AI
//
// Board is an 8x8 array (row 0 = rank 8 / black's back rank).
// Pieces are plain objects: { type, color }.
// Castling rights, en-passant target, halfmove clock and repetition
// counts are tracked in the game state (not on the pieces), which keeps
// make/unmake fast for the search.

const PIECE_VALUES = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 0 };
const MATE_SCORE = 100000;

const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const KING_DIRS = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

const SAN_LETTER = { king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N', pawn: '' };
const FEN_LETTER = { king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p' };
const FEN_TYPE = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
const FILES = 'abcdefgh';

// Piece-square tables, written from white's perspective (row 0 = rank 8).
const PST = (() => {
  const pawn = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0]
  ];
  const knight = [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50]
  ];
  const bishop = [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20]
  ];
  const rook = [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0]
  ];
  const queen = [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20]
  ];
  const king = [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20]
  ];
  return { pawn, knight, bishop, rook, queen, king };
})();

// The midgame king table above rewards hiding on the back rank. In the endgame
// the king is a fighting piece and belongs in the centre, so the two are
// blended by how much material is left on the board (see evaluate).
const KING_EG = [
  [-50, -40, -30, -20, -20, -30, -40, -50],
  [-30, -20, -10, 0, 0, -10, -20, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 30, 40, 40, 30, -10, -30],
  [-30, -10, 20, 30, 30, 20, -10, -30],
  [-30, -30, 0, 0, 0, 0, -30, -30],
  [-50, -30, -30, -30, -30, -30, -30, -50]
];

// Game phase: 24 at the opening, 0 once only kings and pawns remain.
const PHASE_WEIGHT = { pawn: 0, knight: 1, bishop: 1, rook: 2, queen: 4, king: 0 };
const TOTAL_PHASE = 24;

const DOUBLED_PAWN = -12;
const ISOLATED_PAWN = -14;
const BISHOP_PAIR = 32;
const ROOK_OPEN_FILE = 18;
const ROOK_SEMI_OPEN_FILE = 9;
const SHIELD_MISSING = -12;
// Indexed by how far a passed pawn has advanced from its starting rank.
const PASSED_PAWN = [0, 10, 18, 34, 62, 105, 160];

// Scratch buffers reused by evaluate() so the search does not allocate per leaf.
const _wPawnsOnFile = new Int8Array(8);
const _bPawnsOnFile = new Int8Array(8);
const _wPawnMinRow = new Int8Array(8);
const _wPawnMaxRow = new Int8Array(8);
const _bPawnMinRow = new Int8Array(8);
const _bPawnMaxRow = new Int8Array(8);

// Difficulty profiles. Strength comes from search depth; weakness comes from an
// explicit mistake rate rather than from randomising among near-equal moves,
// which just makes a bot look aimless at every rating.
//
// mistakeCap bounds how much a mistake may cost, in centipawns. Human error is
// bounded by strength: a 1200 drops a pawn, they do not miss a mate in one or
// give away a queen, so weaker profiles get a wider cap than stronger ones.
const BOT_PROFILES = [
  { rating: 400, maxDepth: 1, timeMs: 150, quiescence: false, mistakeRate: 0.60, mistakeSpread: 99, mistakeCap: 1000 },
  { rating: 800, maxDepth: 2, timeMs: 400, quiescence: true, mistakeRate: 0.35, mistakeSpread: 5, mistakeCap: 400 },
  { rating: 1200, maxDepth: 3, timeMs: 700, quiescence: true, mistakeRate: 0.22, mistakeSpread: 3, mistakeCap: 180 },
  { rating: 1600, maxDepth: 4, timeMs: 1100, quiescence: true, mistakeRate: 0.10, mistakeSpread: 3, mistakeCap: 100 },
  { rating: 2000, maxDepth: 5, timeMs: 1600, quiescence: true, mistakeRate: 0.04, mistakeSpread: 2, mistakeCap: 50 },
  { rating: 2400, maxDepth: 6, timeMs: 2400, quiescence: true, mistakeRate: 0, mistakeSpread: 0, mistakeCap: 0 }
];

function botProfile(rating) {
  let chosen = BOT_PROFILES[0];
  for (const profile of BOT_PROFILES) {
    if (rating >= profile.rating) chosen = profile;
  }
  return chosen;
}

function encodeMove(move) {
  return move.from[0] * 512 + move.from[1] * 64 + move.to[0] * 8 + move.to[1];
}

const PIECE_SYMBOLS = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
};

function otherColor(color) {
  return color === 'white' ? 'black' : 'white';
}

class ChessGame {
  constructor(existing = null) {
    if (existing) {
      this.board = existing.board.map(row => row.map(p => (p ? { type: p.type, color: p.color } : null)));
      this.currentTurn = existing.currentTurn;
      this.castling = {
        white: { kingside: existing.castling.white.kingside, queenside: existing.castling.white.queenside },
        black: { kingside: existing.castling.black.kingside, queenside: existing.castling.black.queenside }
      };
      this.enPassant = existing.enPassant ? [...existing.enPassant] : null;
      this.halfmoveClock = existing.halfmoveClock;
      this.moveHistory = [...existing.moveHistory];
      this.capturedPieces = { white: [...existing.capturedPieces.white], black: [...existing.capturedPieces.black] };
      this.positionCounts = new Map(existing.positionCounts);
      this.timeControl = existing.timeControl;
      this.gameMode = existing.gameMode;
      this.gameId = existing.gameId;
      this.botLevel = existing.botLevel;
    } else {
      this.board = this.initializeBoard();
      this.currentTurn = 'white';
      this.castling = {
        white: { kingside: true, queenside: true },
        black: { kingside: true, queenside: true }
      };
      this.enPassant = null;
      this.halfmoveClock = 0;
      this.moveHistory = [];
      this.capturedPieces = { white: [], black: [] };
      this.positionCounts = new Map();
      this.positionCounts.set(this.positionKey(), 1);
      this.timeControl = 10 * 60 * 1000;
      this.gameMode = 'local';
      this.gameId = null;
      this.botLevel = 1200;
    }

    // Per-search scratch state, reset at the start of every search.
    this.killers = [];
    this.searchDeadline = Infinity;
    this.searchAborted = false;
    this.nodes = 0;
  }

  initializeBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(null));
    const order = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    for (let col = 0; col < 8; col++) {
      board[0][col] = { type: order[col], color: 'black' };
      board[1][col] = { type: 'pawn', color: 'black' };
      board[6][col] = { type: 'pawn', color: 'white' };
      board[7][col] = { type: order[col], color: 'white' };
    }
    return board;
  }

  // ---------- Attack detection (independent of move generation) ----------

  isSquareAttacked(row, col, byColor) {
    const board = this.board;

    // Pawn attacks (diagonals only - a pawn's forward push is NOT an attack)
    const pawnRow = byColor === 'white' ? row + 1 : row - 1;
    if (pawnRow >= 0 && pawnRow < 8) {
      for (const dc of [-1, 1]) {
        const c = col + dc;
        if (c >= 0 && c < 8) {
          const p = board[pawnRow][c];
          if (p && p.type === 'pawn' && p.color === byColor) return true;
        }
      }
    }

    // Knight attacks
    for (const [dr, dc] of KNIGHT_JUMPS) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const p = board[r][c];
        if (p && p.type === 'knight' && p.color === byColor) return true;
      }
    }

    // King attacks
    for (const [dr, dc] of KING_DIRS) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < 8 && c >= 0 && c < 8) {
        const p = board[r][c];
        if (p && p.type === 'king' && p.color === byColor) return true;
      }
    }

    // Sliding attacks: rooks/queens
    for (const [dr, dc] of ROOK_DIRS) {
      for (let i = 1; i < 8; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
        const p = board[r][c];
        if (p) {
          if (p.color === byColor && (p.type === 'rook' || p.type === 'queen')) return true;
          break;
        }
      }
    }

    // Sliding attacks: bishops/queens
    for (const [dr, dc] of BISHOP_DIRS) {
      for (let i = 1; i < 8; i++) {
        const r = row + dr * i, c = col + dc * i;
        if (r < 0 || r >= 8 || c < 0 || c >= 8) break;
        const p = board[r][c];
        if (p) {
          if (p.color === byColor && (p.type === 'bishop' || p.type === 'queen')) return true;
          break;
        }
      }
    }

    return false;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type === 'king' && p.color === color) return [r, c];
      }
    }
    return null;
  }

  isInCheck(color) {
    const king = this.findKing(color);
    if (!king) return false;
    return this.isSquareAttacked(king[0], king[1], otherColor(color));
  }

  // ---------- Move generation ----------

  // Returns pseudo-legal moves (castling is generated fully legal).
  // Move shape: { from:[r,c], to:[r,c], piece, captured, enPassant, double, castle, promotion }
  generatePseudoMoves(color, capturesOnly = false) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== color) continue;
        switch (piece.type) {
          case 'pawn': this.genPawnMoves(r, c, piece, moves, capturesOnly); break;
          case 'knight': this.genStepMoves(r, c, piece, KNIGHT_JUMPS, moves, capturesOnly); break;
          case 'bishop': this.genSlidingMoves(r, c, piece, BISHOP_DIRS, moves, capturesOnly); break;
          case 'rook': this.genSlidingMoves(r, c, piece, ROOK_DIRS, moves, capturesOnly); break;
          case 'queen': this.genSlidingMoves(r, c, piece, KING_DIRS, moves, capturesOnly); break;
          case 'king':
            this.genStepMoves(r, c, piece, KING_DIRS, moves, capturesOnly);
            if (!capturesOnly) this.genCastlingMoves(r, c, piece, moves);
            break;
          default: break;
        }
      }
    }
    return moves;
  }

  genPawnMoves(r, c, piece, moves, capturesOnly) {
    const dir = piece.color === 'white' ? -1 : 1;
    const startRow = piece.color === 'white' ? 6 : 1;
    const lastRow = piece.color === 'white' ? 0 : 7;
    const oneAhead = r + dir;
    if (oneAhead < 0 || oneAhead > 7) return;

    // Pushes
    if (!capturesOnly && !this.board[oneAhead][c]) {
      moves.push({ from: [r, c], to: [oneAhead, c], piece, promotion: oneAhead === lastRow });
      const twoAhead = r + 2 * dir;
      if (r === startRow && !this.board[twoAhead][c]) {
        moves.push({ from: [r, c], to: [twoAhead, c], piece, double: true });
      }
    }

    // Captures + en passant
    for (const dc of [-1, 1]) {
      const nc = c + dc;
      if (nc < 0 || nc > 7) continue;
      const target = this.board[oneAhead][nc];
      if (target && target.color !== piece.color) {
        moves.push({ from: [r, c], to: [oneAhead, nc], piece, captured: target, promotion: oneAhead === lastRow });
      } else if (!target && this.enPassant && this.enPassant[0] === oneAhead && this.enPassant[1] === nc) {
        moves.push({ from: [r, c], to: [oneAhead, nc], piece, enPassant: true, captured: this.board[r][nc] });
      }
    }
  }

  genStepMoves(r, c, piece, offsets, moves, capturesOnly) {
    for (const [dr, dc] of offsets) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr > 7 || nc < 0 || nc > 7) continue;
      const target = this.board[nr][nc];
      if (target) {
        if (target.color !== piece.color) moves.push({ from: [r, c], to: [nr, nc], piece, captured: target });
      } else if (!capturesOnly) {
        moves.push({ from: [r, c], to: [nr, nc], piece });
      }
    }
  }

  genSlidingMoves(r, c, piece, dirs, moves, capturesOnly) {
    for (const [dr, dc] of dirs) {
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr < 0 || nr > 7 || nc < 0 || nc > 7) break;
        const target = this.board[nr][nc];
        if (target) {
          if (target.color !== piece.color) moves.push({ from: [r, c], to: [nr, nc], piece, captured: target });
          break;
        }
        if (!capturesOnly) moves.push({ from: [r, c], to: [nr, nc], piece });
      }
    }
  }

  genCastlingMoves(r, c, piece, moves) {
    const rights = this.castling[piece.color];
    const homeRow = piece.color === 'white' ? 7 : 0;
    if (r !== homeRow || c !== 4) return;
    if (!rights.kingside && !rights.queenside) return;
    const enemy = otherColor(piece.color);
    if (this.isSquareAttacked(r, 4, enemy)) return; // can't castle out of check

    // Kingside: f and g empty, rook on h, king path (f, g) not attacked
    if (rights.kingside &&
        !this.board[r][5] && !this.board[r][6] &&
        this.board[r][7] && this.board[r][7].type === 'rook' && this.board[r][7].color === piece.color &&
        !this.isSquareAttacked(r, 5, enemy) && !this.isSquareAttacked(r, 6, enemy)) {
      moves.push({ from: [r, 4], to: [r, 6], piece, castle: 'kingside' });
    }

    // Queenside: b, c, d empty, rook on a, king path (d, c) not attacked
    if (rights.queenside &&
        !this.board[r][1] && !this.board[r][2] && !this.board[r][3] &&
        this.board[r][0] && this.board[r][0].type === 'rook' && this.board[r][0].color === piece.color &&
        !this.isSquareAttacked(r, 3, enemy) && !this.isSquareAttacked(r, 2, enemy)) {
      moves.push({ from: [r, 4], to: [r, 2], piece, castle: 'queenside' });
    }
  }

  // ---------- Make / unmake (fast, used by search and legality checks) ----------

  applyMove(move, promoType = 'queen') {
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const piece = this.board[fr][fc];
    const undo = {
      move,
      piece,
      captured: null,
      capturedSquare: null,
      prevCastling: {
        white: { ...this.castling.white },
        black: { ...this.castling.black }
      },
      prevEnPassant: this.enPassant,
      prevHalfmove: this.halfmoveClock
    };

    // Remove captured piece
    if (move.enPassant) {
      undo.captured = this.board[fr][tc];
      undo.capturedSquare = [fr, tc];
      this.board[fr][tc] = null;
    } else if (this.board[tr][tc]) {
      undo.captured = this.board[tr][tc];
      undo.capturedSquare = [tr, tc];
    }

    // Move (or promote) the piece
    this.board[tr][tc] = move.promotion ? { type: promoType, color: piece.color } : piece;
    this.board[fr][fc] = null;

    // Castling: move the rook too
    if (move.castle === 'kingside') {
      this.board[tr][5] = this.board[tr][7];
      this.board[tr][7] = null;
    } else if (move.castle === 'queenside') {
      this.board[tr][3] = this.board[tr][0];
      this.board[tr][0] = null;
    }

    // Update castling rights
    if (piece.type === 'king') {
      this.castling[piece.color].kingside = false;
      this.castling[piece.color].queenside = false;
    }
    if (piece.type === 'rook') {
      const homeRow = piece.color === 'white' ? 7 : 0;
      if (fr === homeRow && fc === 0) this.castling[piece.color].queenside = false;
      if (fr === homeRow && fc === 7) this.castling[piece.color].kingside = false;
    }
    if (undo.captured && undo.captured.type === 'rook') {
      const [cr, cc] = undo.capturedSquare;
      const capColor = undo.captured.color;
      const capHome = capColor === 'white' ? 7 : 0;
      if (cr === capHome && cc === 0) this.castling[capColor].queenside = false;
      if (cr === capHome && cc === 7) this.castling[capColor].kingside = false;
    }

    // En passant target square
    this.enPassant = move.double ? [(fr + tr) / 2, fc] : null;

    // Halfmove clock
    this.halfmoveClock = (piece.type === 'pawn' || undo.captured) ? 0 : this.halfmoveClock + 1;

    this.currentTurn = otherColor(this.currentTurn);
    return undo;
  }

  undoMove(undo) {
    const { move, piece, captured, capturedSquare } = undo;
    const [fr, fc] = move.from;
    const [tr, tc] = move.to;

    this.board[fr][fc] = piece;
    this.board[tr][tc] = null;
    if (captured) this.board[capturedSquare[0]][capturedSquare[1]] = captured;

    if (move.castle === 'kingside') {
      this.board[fr][7] = this.board[fr][5];
      this.board[fr][5] = null;
    } else if (move.castle === 'queenside') {
      this.board[fr][0] = this.board[fr][3];
      this.board[fr][3] = null;
    }

    this.castling = undo.prevCastling;
    this.enPassant = undo.prevEnPassant;
    this.halfmoveClock = undo.prevHalfmove;
    this.currentTurn = otherColor(this.currentTurn);
  }

  // ---------- Legal moves ----------

  getAllLegalMoves(color = this.currentTurn) {
    const legal = [];
    for (const move of this.generatePseudoMoves(color)) {
      const undo = this.applyMove(move);
      if (!this.isInCheck(color)) legal.push(move);
      this.undoMove(undo);
    }
    return legal;
  }

  // Legal destination squares for the piece on (row, col) - used by the UI.
  getLegalMovesFrom(row, col) {
    const piece = this.board[row][col];
    if (!piece || piece.color !== this.currentTurn) return [];
    return this.getAllLegalMoves()
      .filter(m => m.from[0] === row && m.from[1] === col)
      .map(m => ({ to: m.to, capture: !!m.captured, promotion: !!m.promotion }));
  }

  // ---------- Public move entry point ----------

  makeMove(fromRow, fromCol, toRow, toCol, promoType = 'queen') {
    const legalMoves = this.getAllLegalMoves();
    const move = legalMoves.find(m =>
      m.from[0] === fromRow && m.from[1] === fromCol && m.to[0] === toRow && m.to[1] === toCol);
    if (!move) return false;

    const san = this.buildSan(move, legalMoves, promoType);
    const undo = this.applyMove(move, promoType);

    if (undo.captured) {
      this.capturedPieces[undo.captured.color].push({ type: undo.captured.type, color: undo.captured.color });
    }

    // Repetition tracking
    const key = this.positionKey();
    this.positionCounts.set(key, (this.positionCounts.get(key) || 0) + 1);

    // Check / mate suffix
    let suffix = '';
    if (this.isInCheck(this.currentTurn)) {
      suffix = this.getAllLegalMoves().length === 0 ? '#' : '+';
    }

    this.moveHistory.push({
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece: { type: move.piece.type, color: move.piece.color },
      captured: undo.captured ? { type: undo.captured.type, color: undo.captured.color } : null,
      promotion: move.promotion ? promoType : null,
      castle: move.castle || null,
      san: san + suffix
    });

    return true;
  }

  buildSan(move, legalMoves, promoType) {
    if (move.castle === 'kingside') return 'O-O';
    if (move.castle === 'queenside') return 'O-O-O';

    const [fr, fc] = move.from;
    const [tr, tc] = move.to;
    const dest = FILES[tc] + (8 - tr);
    const isCapture = !!move.captured;

    if (move.piece.type === 'pawn') {
      let san = isCapture ? FILES[fc] + 'x' + dest : dest;
      if (move.promotion) san += '=' + SAN_LETTER[promoType].toUpperCase();
      return san;
    }

    // Disambiguation between identical pieces that can reach the same square
    const rivals = legalMoves.filter(m =>
      m.piece.type === move.piece.type &&
      m.to[0] === tr && m.to[1] === tc &&
      (m.from[0] !== fr || m.from[1] !== fc));
    let disambig = '';
    if (rivals.length > 0) {
      const sameFile = rivals.some(m => m.from[1] === fc);
      const sameRank = rivals.some(m => m.from[0] === fr);
      if (!sameFile) disambig = FILES[fc];
      else if (!sameRank) disambig = String(8 - fr);
      else disambig = FILES[fc] + (8 - fr);
    }

    return SAN_LETTER[move.piece.type] + disambig + (isCapture ? 'x' : '') + dest;
  }

  // ---------- Game state / results ----------

  positionKey() {
    let key = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        key += p ? (p.color === 'white' ? FEN_LETTER[p.type].toUpperCase() : FEN_LETTER[p.type]) : '-';
      }
    }
    key += '|' + this.currentTurn[0];
    key += '|' + this.castlingString();
    key += '|' + (this.enPassant ? this.enPassant.join(',') : '-');
    return key;
  }

  castlingString() {
    const s = (this.castling.white.kingside ? 'K' : '') + (this.castling.white.queenside ? 'Q' : '') +
      (this.castling.black.kingside ? 'k' : '') + (this.castling.black.queenside ? 'q' : '');
    return s || '-';
  }

  // ---------- FEN ----------

  toFen() {
    let placement = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) { empty++; continue; }
        if (empty) { placement += empty; empty = 0; }
        const letter = FEN_LETTER[p.type];
        placement += p.color === 'white' ? letter.toUpperCase() : letter;
      }
      if (empty) placement += empty;
      if (r < 7) placement += '/';
    }
    const ep = this.enPassant ? FILES[this.enPassant[1]] + (8 - this.enPassant[0]) : '-';
    const fullmove = Math.floor(this.moveHistory.length / 2) + 1;
    return `${placement} ${this.currentTurn === 'white' ? 'w' : 'b'} ${this.castlingString()} ${ep} ${this.halfmoveClock} ${fullmove}`;
  }

  static fromFen(fen) {
    const game = new ChessGame();
    const [placement, turn, castling, ep, halfmove] = fen.trim().split(/\s+/);

    game.board = Array(8).fill().map(() => Array(8).fill(null));
    placement.split('/').forEach((rankStr, r) => {
      let c = 0;
      for (const ch of rankStr) {
        if (/\d/.test(ch)) {
          c += parseInt(ch, 10);
        } else {
          game.board[r][c] = {
            type: FEN_TYPE[ch.toLowerCase()],
            color: ch === ch.toUpperCase() ? 'white' : 'black'
          };
          c++;
        }
      }
    });

    game.currentTurn = turn === 'w' ? 'white' : 'black';
    game.castling = {
      white: { kingside: castling.includes('K'), queenside: castling.includes('Q') },
      black: { kingside: castling.includes('k'), queenside: castling.includes('q') }
    };
    game.enPassant = ep && ep !== '-' ? [8 - parseInt(ep[1], 10), FILES.indexOf(ep[0])] : null;
    game.halfmoveClock = halfmove ? parseInt(halfmove, 10) : 0;
    game.moveHistory = [];
    game.capturedPieces = { white: [], black: [] };
    game.positionCounts = new Map();
    game.positionCounts.set(game.positionKey(), 1);
    return game;
  }

  // Counts leaf nodes at the given depth. Standard correctness check for
  // move generation - promotions count once per promotion piece.
  perft(depth) {
    if (depth === 0) return 1;
    const color = this.currentTurn;
    let nodes = 0;
    for (const move of this.generatePseudoMoves(color)) {
      const promoTypes = move.promotion ? ['queen', 'rook', 'bishop', 'knight'] : ['queen'];
      for (const promoType of promoTypes) {
        const undo = this.applyMove(move, promoType);
        if (!this.isInCheck(color)) nodes += this.perft(depth - 1);
        this.undoMove(undo);
      }
    }
    return nodes;
  }

  hasInsufficientMaterial() {
    const minors = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.type === 'king') continue;
        if (p.type === 'pawn' || p.type === 'rook' || p.type === 'queen') return false;
        minors.push({ ...p, squareColor: (r + c) % 2 });
      }
    }
    if (minors.length <= 1) return true; // K vs K, or K+minor vs K
    if (minors.length === 2 && minors[0].type === 'bishop' && minors[1].type === 'bishop' &&
        minors[0].color !== minors[1].color && minors[0].squareColor === minors[1].squareColor) {
      return true; // opposite-color kings, same-color bishops
    }
    return false;
  }

  getGameStatus() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      if (this.isInCheck(this.currentTurn)) {
        return { over: true, winner: otherColor(this.currentTurn), reason: 'checkmate' };
      }
      return { over: true, winner: null, reason: 'stalemate' };
    }
    if (this.hasInsufficientMaterial()) return { over: true, winner: null, reason: 'insufficient material' };
    if (this.halfmoveClock >= 100) return { over: true, winner: null, reason: '50-move rule' };
    if ((this.positionCounts.get(this.positionKey()) || 0) >= 3) {
      return { over: true, winner: null, reason: 'threefold repetition' };
    }
    return { over: false, winner: null, reason: null };
  }

  isCheckmate(color) {
    if (color !== this.currentTurn) return false;
    return this.isInCheck(color) && this.getAllLegalMoves(color).length === 0;
  }

  // ---------- Evaluation ----------

  // Score in centipawns from the side to move's point of view. Material and
  // piece placement are blended between a midgame and an endgame reading of the
  // position, then adjusted for pawn structure and piece activity.
  evaluate() {
    _wPawnsOnFile.fill(0); _bPawnsOnFile.fill(0);
    _wPawnMinRow.fill(8); _wPawnMaxRow.fill(-1);
    _bPawnMinRow.fill(8); _bPawnMaxRow.fill(-1);

    let mg = 0, eg = 0, phase = 0;
    let whiteBishops = 0, blackBishops = 0;
    let whiteKing = null, blackKing = null;
    const whiteRookFiles = [], blackRookFiles = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p) continue;
        const isWhite = p.color === 'white';
        const pr = isWhite ? r : 7 - r; // read the tables from this colour's side
        phase += PHASE_WEIGHT[p.type];

        const material = PIECE_VALUES[p.type];
        let mgValue, egValue;
        if (p.type === 'king') {
          mgValue = material + PST.king[pr][c];
          egValue = material + KING_EG[pr][c];
        } else {
          const placement = PST[p.type][pr][c];
          mgValue = material + placement;
          egValue = material + placement;
        }
        if (isWhite) { mg += mgValue; eg += egValue; } else { mg -= mgValue; eg -= egValue; }

        switch (p.type) {
          case 'pawn':
            if (isWhite) {
              _wPawnsOnFile[c]++;
              if (r < _wPawnMinRow[c]) _wPawnMinRow[c] = r;
              if (r > _wPawnMaxRow[c]) _wPawnMaxRow[c] = r;
            } else {
              _bPawnsOnFile[c]++;
              if (r < _bPawnMinRow[c]) _bPawnMinRow[c] = r;
              if (r > _bPawnMaxRow[c]) _bPawnMaxRow[c] = r;
            }
            break;
          case 'bishop': if (isWhite) whiteBishops++; else blackBishops++; break;
          case 'rook': (isWhite ? whiteRookFiles : blackRookFiles).push(c); break;
          case 'king': if (isWhite) whiteKing = [r, c]; else blackKing = [r, c]; break;
          default: break;
        }
      }
    }

    const mgWeight = Math.min(phase, TOTAL_PHASE) / TOTAL_PHASE;
    const egWeight = 1 - mgWeight;
    let score = mg * mgWeight + eg * egWeight;

    // Pawn structure
    for (let f = 0; f < 8; f++) {
      if (_wPawnsOnFile[f] > 1) score += DOUBLED_PAWN * (_wPawnsOnFile[f] - 1);
      if (_bPawnsOnFile[f] > 1) score -= DOUBLED_PAWN * (_bPawnsOnFile[f] - 1);

      const leftW = f > 0 ? _wPawnsOnFile[f - 1] : 0;
      const rightW = f < 7 ? _wPawnsOnFile[f + 1] : 0;
      if (_wPawnsOnFile[f] > 0 && leftW === 0 && rightW === 0) score += ISOLATED_PAWN;

      const leftB = f > 0 ? _bPawnsOnFile[f - 1] : 0;
      const rightB = f < 7 ? _bPawnsOnFile[f + 1] : 0;
      if (_bPawnsOnFile[f] > 0 && leftB === 0 && rightB === 0) score -= ISOLATED_PAWN;

      // Passed pawns: only the most advanced pawn on a file can be passed.
      if (_wPawnsOnFile[f] > 0) {
        const row = _wPawnMinRow[f];
        let blocked = false;
        for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1) && !blocked; g++) {
          if (_bPawnsOnFile[g] > 0 && _bPawnMinRow[g] < row) blocked = true;
        }
        if (!blocked) score += PASSED_PAWN[Math.max(0, Math.min(6, 6 - row))] * (1 + egWeight);
      }
      if (_bPawnsOnFile[f] > 0) {
        const row = _bPawnMaxRow[f];
        let blocked = false;
        for (let g = Math.max(0, f - 1); g <= Math.min(7, f + 1) && !blocked; g++) {
          if (_wPawnsOnFile[g] > 0 && _wPawnMaxRow[g] > row) blocked = true;
        }
        if (!blocked) score -= PASSED_PAWN[Math.max(0, Math.min(6, row - 1))] * (1 + egWeight);
      }
    }

    // Bishop pair
    if (whiteBishops >= 2) score += BISHOP_PAIR;
    if (blackBishops >= 2) score -= BISHOP_PAIR;

    // Rooks like files without pawns in the way
    for (const f of whiteRookFiles) {
      if (_wPawnsOnFile[f] === 0) score += _bPawnsOnFile[f] === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE;
    }
    for (const f of blackRookFiles) {
      if (_bPawnsOnFile[f] === 0) score -= _wPawnsOnFile[f] === 0 ? ROOK_OPEN_FILE : ROOK_SEMI_OPEN_FILE;
    }

    // Pawn shield, only while there is still enough material to attack with
    if (mgWeight > 0.3) {
      if (whiteKing) score += this.pawnShield(whiteKing, 'white', _wPawnsOnFile) * mgWeight;
      if (blackKing) score -= this.pawnShield(blackKing, 'black', _bPawnsOnFile) * mgWeight;
    }

    return this.currentTurn === 'white' ? score : -score;
  }

  // Penalty for each missing pawn on the three files around a castled king.
  pawnShield([row, col], color, pawnsOnFile) {
    const homeRow = color === 'white' ? 7 : 0;
    if (Math.abs(row - homeRow) > 1) return 0; // king has left home, shield is moot
    if (col >= 2 && col <= 5) return 0; // only rate a king tucked on a flank
    let missing = 0;
    for (let f = Math.max(0, col - 1); f <= Math.min(7, col + 1); f++) {
      if (pawnsOnFile[f] === 0) missing++;
    }
    return SHIELD_MISSING * missing;
  }

  // ---------- Search (negamax + alpha-beta + quiescence) ----------

  // Better-looking moves are searched first so alpha-beta can prune more. The
  // ordering is what makes the deeper levels affordable at all.
  orderMoves(moves, ply = 0) {
    const killers = this.killers[ply];
    for (const move of moves) {
      let score = 0;
      if (move.captured) {
        // MVV-LVA: most valuable victim, least valuable attacker
        score = 100000 + 10 * PIECE_VALUES[move.captured.type] - PIECE_VALUES[move.piece.type];
      } else if (killers) {
        const code = encodeMove(move);
        if (code === killers[0]) score = 90000;
        else if (code === killers[1]) score = 89000;
      }
      if (move.promotion) score += 80000;
      move.order = score;
    }
    return moves.sort((a, b) => b.order - a.order);
  }

  // Quiet moves that caused a cutoff are tried early at the same depth again.
  recordKiller(move, ply) {
    const code = encodeMove(move);
    const killers = this.killers[ply] || (this.killers[ply] = [0, 0]);
    if (killers[0] !== code) {
      killers[1] = killers[0];
      killers[0] = code;
    }
  }

  outOfTime() {
    if (this.searchAborted) return true;
    // Checking the clock is not free, so only sample it every so often.
    if ((++this.nodes & 1023) === 0 && Date.now() >= this.searchDeadline) {
      this.searchAborted = true;
    }
    return this.searchAborted;
  }

  negamax(depth, alpha, beta, ply, useQuiescence) {
    if (this.outOfTime()) return 0;
    if (depth === 0) {
      return useQuiescence ? this.quiescence(alpha, beta) : this.evaluate();
    }

    const color = this.currentTurn;
    const moves = this.orderMoves(this.generatePseudoMoves(color), ply);
    let legalCount = 0;
    let best = -Infinity;

    for (const move of moves) {
      const undo = this.applyMove(move);
      if (this.isInCheck(color)) {
        this.undoMove(undo);
        continue;
      }
      legalCount++;
      const score = -this.negamax(depth - 1, -beta, -alpha, ply + 1, useQuiescence);
      this.undoMove(undo);
      if (this.searchAborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!move.captured) this.recordKiller(move, ply);
        break;
      }
    }

    if (legalCount === 0) {
      // Scoring mate by ply makes the search prefer the quickest mate, and the
      // slowest defeat, instead of treating all mates alike.
      return this.isInCheck(color) ? -(MATE_SCORE - ply) : 0;
    }
    return best;
  }

  // Keeps searching captures past the depth limit so the evaluation is never
  // taken in the middle of an exchange. Without this a shallow search happily
  // grabs a defended pawn and never sees the recapture.
  quiescence(alpha, beta) {
    if (this.outOfTime()) return 0;
    const standPat = this.evaluate();
    if (standPat >= beta) return standPat;
    if (standPat > alpha) alpha = standPat;

    const color = this.currentTurn;
    const captures = this.orderMoves(this.generatePseudoMoves(color, true));
    for (const move of captures) {
      const undo = this.applyMove(move);
      if (this.isInCheck(color)) {
        this.undoMove(undo);
        continue;
      }
      const score = -this.quiescence(-beta, -alpha);
      this.undoMove(undo);
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // ---------- Bot ----------

  setBotLevel(level) { this.botLevel = level; }
  getBotLevel() { return this.botLevel || 1200; }

  // Ranks every legal move by iterative deepening, deepest completed search
  // wins. Root moves get a full window so their scores are exact, which is what
  // lets the difficulty model reason about the second- and third-best move.
  searchRoot(profile) {
    let ranked = this.getAllLegalMoves().map(move => ({ move, score: 0 }));
    // Nothing to search: the game is already over, or the move is forced.
    if (ranked.length <= 1) return ranked;

    this.searchDeadline = Date.now() + profile.timeMs;
    this.searchAborted = false;
    this.nodes = 0;
    this.killers = [];
    this.searchDepthReached = 0;

    for (let depth = 1; depth <= profile.maxDepth; depth++) {
      const results = [];
      for (const entry of ranked) {
        const undo = this.applyMove(entry.move);
        const score = -this.negamax(depth - 1, -Infinity, Infinity, 1, profile.quiescence);
        this.undoMove(undo);
        if (this.searchAborted) break;
        results.push({ move: entry.move, score });
      }
      // A partial iteration tells us nothing reliable, so discard it and keep
      // the ranking from the last depth that finished.
      if (this.searchAborted || results.length < ranked.length) break;

      results.sort((a, b) => b.score - a.score);
      ranked = results;
      this.searchDepthReached = depth;

      // A forced mate is as good as it gets; no deeper search will improve it.
      if (Math.abs(ranked[0].score) >= MATE_SCORE - 100) break;
      if (Date.now() >= this.searchDeadline) break;
    }

    return ranked;
  }

  // Returns [fromRow, fromCol, toRow, toCol] or null.
  getBotMove() {
    const profile = botProfile(this.getBotLevel());
    const ranked = this.searchRoot(profile);
    if (ranked.length === 0) return null;

    // Weaker bots do not play randomly among near-equal moves - that reads as
    // aimless at every rating. They play the best move they see most of the
    // time and occasionally settle for their second or third choice, which is
    // how a human of that strength actually goes wrong.
    let chosen = ranked[0];
    if (ranked.length > 1 && profile.mistakeRate > 0 && Math.random() < profile.mistakeRate) {
      // Only consider alternatives that are wrong by an amount this rating
      // would plausibly overlook, so a slip never throws away a mate or a queen.
      const floor = ranked[0].score - profile.mistakeCap;
      const alternatives = ranked
        .slice(1, 1 + profile.mistakeSpread)
        .filter(entry => entry.score >= floor);
      if (alternatives.length > 0) {
        chosen = alternatives[Math.floor(Math.random() * alternatives.length)];
      }
    }

    return [...chosen.move.from, ...chosen.move.to];
  }

  // ---------- Misc API used by the UI ----------

  getBoard() { return this.board; }
  getCurrentTurn() { return this.currentTurn; }

  getPieceSymbol(piece) { return PIECE_SYMBOLS[piece.color][piece.type]; }

  getBoardString() {
    return this.board.map(row =>
      row.map(p => (p ? PIECE_SYMBOLS[p.color][p.type] : '.')).join(' ')
    ).join('\n');
  }

  // The base time per side. The running countdown lives in the UI, which is
  // what actually observes elapsed wall time.
  setTimeControl(ms) { this.timeControl = ms; }
  getTimeControl() { return this.timeControl; }

  setGameMode(mode) { this.gameMode = mode; }
  getGameMode() { return this.gameMode; }
  setGameId(id = null) { this.gameId = id || Math.random().toString(36).substring(2, 15); }
  getGameId() { return this.gameId; }

  serialize() {
    return {
      board: this.board,
      currentTurn: this.currentTurn,
      castling: this.castling,
      enPassant: this.enPassant,
      halfmoveClock: this.halfmoveClock,
      moveHistory: this.moveHistory,
      capturedPieces: this.capturedPieces,
      positionCounts: [...this.positionCounts.entries()],
      timeControl: this.timeControl,
      gameMode: this.gameMode,
      gameId: this.gameId,
      botLevel: this.botLevel
    };
  }

  static deserialize(data) {
    const game = new ChessGame();
    game.board = data.board.map(row => row.map(p => (p ? { type: p.type, color: p.color } : null)));
    game.currentTurn = data.currentTurn;
    game.castling = data.castling;
    game.enPassant = data.enPassant;
    game.halfmoveClock = data.halfmoveClock || 0;
    game.moveHistory = data.moveHistory || [];
    game.capturedPieces = data.capturedPieces || { white: [], black: [] };
    game.positionCounts = new Map(data.positionCounts || []);
    game.timeControl = data.timeControl;
    game.gameMode = data.gameMode;
    game.gameId = data.gameId;
    game.botLevel = data.botLevel;
    return game;
  }
}

export { PIECE_SYMBOLS, PIECE_VALUES };
export default ChessGame;
