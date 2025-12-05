// ChessGame.js - Simplified chess logic

class Piece {
  constructor(color, type) {
    this.color = color;
    this.type = type;
  }

  getSymbol() {
    const symbols = {
      white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
      black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
    };
    return symbols[this.color][this.type];
  }

  getPossibleMoves(board, row, col) {
    return [];
  }
}

class King extends Piece {
  constructor(color) {
    super(color, 'king');
    this.hasMoved = false;
  }

  getPossibleMoves(board, row, col) {
    const moves = [];
    const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

    for (const [dr, dc] of directions) {
      const newRow = row + dr, newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const target = board[newRow][newCol];
        if (!target || target.color !== this.color) moves.push([newRow, newCol]);
      }
    }

    // Castling
    if (!this.hasMoved) {
      if (!board[row][5] && !board[row][6] && board[row][7]?.type === 'rook' && board[row][7]?.color === this.color && !board[row][7].hasMoved) {
        moves.push([row, 6]); // Kingside
      }
      if (!board[row][1] && !board[row][2] && !board[row][3] && board[row][0]?.type === 'rook' && board[row][0]?.color === this.color && !board[row][0].hasMoved) {
        moves.push([row, 2]); // Queenside
      }
    }
    return moves;
  }
}

class Queen extends Piece {
  constructor(color) { super(color, 'queen'); }
  getPossibleMoves(board, row, col) { return getSlidingMoves(board, row, col, this.color, [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]); }
}

class Rook extends Piece {
  constructor(color) { super(color, 'rook'); }
  getPossibleMoves(board, row, col) { return getSlidingMoves(board, row, col, this.color, [[-1,0],[1,0],[0,-1],[0,1]]); }
}

class Bishop extends Piece {
  constructor(color) { super(color, 'bishop'); }
  getPossibleMoves(board, row, col) { return getSlidingMoves(board, row, col, this.color, [[-1,-1],[-1,1],[1,-1],[1,1]]); }
}

class Knight extends Piece {
  constructor(color) { super(color, 'knight'); }

  getPossibleMoves(board, row, col) {
    const moves = [];
    const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];

    for (const [dr, dc] of knightMoves) {
      const newRow = row + dr, newCol = col + dc;
      if (newRow >= 0 && newRow < 8 && newCol >= 0 && newCol < 8) {
        const target = board[newRow][newCol];
        if (!target || target.color !== this.color) moves.push([newRow, newCol]);
      }
    }
    return moves;
  }
}

class Pawn extends Piece {
  constructor(color) {
    super(color, 'pawn');
    this.hasMoved = false;
    this.game = null;
  }

  getPossibleMoves(board, row, col) {
    const moves = [];
    const direction = this.color === 'white' ? -1 : 1;
    const startRow = this.color === 'white' ? 6 : 1;

    // Forward moves
    if (!board[row + direction][col]) {
      moves.push([row + direction, col]);
      if (row === startRow && !board[row + 2 * direction][col]) {
        moves.push([row + 2 * direction, col]);
      }
    }

    // Captures
    for (const dc of [-1, 1]) {
      const newCol = col + dc;
      if (newCol >= 0 && newCol < 8) {
        const target = board[row + direction][newCol];
        if (target && target.color !== this.color) {
          moves.push([row + direction, newCol]);
        }
      }
    }

    // En-passant
    if (row === (this.color === 'white' ? 3 : 4)) {
      for (const dc of [-1, 1]) {
        const newCol = col + dc;
        if (newCol >= 0 && newCol < 8) {
          const lastMove = this.game.moveHistory[this.game.moveHistory.length - 1];
          if (lastMove && lastMove.piece.type === 'pawn' &&
              Math.abs(lastMove.from[0] - lastMove.to[0]) === 2 &&
              lastMove.to[0] === row && lastMove.to[1] === newCol) {
            moves.push([row + direction, newCol]);
          }
        }
      }
    }
    return moves;
  }
}

// Helper function for sliding pieces
function getSlidingMoves(board, row, col, color, directions) {
  const moves = [];
  for (const [dr, dc] of directions) {
    for (let i = 1; i < 8; i++) {
      const newRow = row + dr * i, newCol = col + dc * i;
      if (newRow < 0 || newRow >= 8 || newCol < 0 || newCol >= 8) break;
      const target = board[newRow][newCol];
      if (!target) moves.push([newRow, newCol]);
      else {
        if (target.color !== color) moves.push([newRow, newCol]);
        break;
      }
    }
  }
  return moves;
}

class ChessGame {
  constructor(existingGame = null) {
    if (existingGame) {
      this.board = existingGame.board.map(row => row.map(piece => piece ? Object.assign(Object.create(Object.getPrototypeOf(piece)), piece) : null));
      this.currentTurn = existingGame.currentTurn;
      this.moveHistory = [...existingGame.moveHistory];
      this.capturedPieces = { white: [...existingGame.capturedPieces.white], black: [...existingGame.capturedPieces.black] };
      this.whiteTime = existingGame.whiteTime;
      this.blackTime = existingGame.blackTime;
      this.timeControl = existingGame.timeControl;
      this.gameMode = existingGame.gameMode;
      this.gameId = existingGame.gameId;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (this.board[row][col]?.type === 'pawn') this.board[row][col].game = this;
        }
      }
    } else {
      this.board = this.initializeBoard();
      this.currentTurn = 'white';
      this.moveHistory = [];
      this.capturedPieces = { white: [], black: [] };
      this.whiteTime = 10 * 60 * 1000;
      this.blackTime = 10 * 60 * 1000;
      this.timeControl = 10 * 60 * 1000;
      this.gameMode = 'local';
      this.gameId = null;
    }

    this.pieceSquareTables = this.initializePieceSquareTables();
    this.openingBook = this.initializeOpeningBook();
    this.transpositionTable = new Map(); // Transposition table for caching evaluations
  }

  initializePieceSquareTables() {
    const mirror = table => table.slice().reverse();
    const pawnTable = [
      [0,0,0,0,0,0,0,0],
      [50,50,50,50,50,50,50,50],
      [10,10,20,30,30,20,10,10],
      [5,5,10,25,25,10,5,5],
      [0,0,0,20,20,0,0,0],
      [5,-5,-10,0,0,-10,-5,5],
      [5,10,10,-20,-20,10,10,5],
      [0,0,0,0,0,0,0,0]
    ];
    const knightTable = [
      [-50,-40,-30,-30,-30,-30,-40,-50],
      [-40,-20,0,0,0,0,-20,-40],
      [-30,0,10,15,15,10,0,-30],
      [-30,5,15,20,20,15,5,-30],
      [-30,0,15,20,20,15,0,-30],
      [-30,5,10,15,15,10,5,-30],
      [-40,-20,0,5,5,0,-20,-40],
      [-50,-40,-30,-30,-30,-30,-40,-50]
    ];
    const bishopTable = [
      [-20,-10,-10,-10,-10,-10,-10,-20],
      [-10,0,0,0,0,0,0,-10],
      [-10,0,5,10,10,5,0,-10],
      [-10,5,5,10,10,5,5,-10],
      [-10,0,10,10,10,10,0,-10],
      [-10,10,10,10,10,10,10,-10],
      [-10,5,0,0,0,0,5,-10],
      [-20,-10,-10,-10,-10,-10,-10,-20]
    ];
    const rookTable = [
      [0,0,0,0,0,0,0,0],
      [5,10,10,10,10,10,10,5],
      [-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],
      [-5,0,0,0,0,0,0,-5],
      [0,0,0,5,5,0,0,0]
    ];
    const queenTable = [
      [-20,-10,-10,-5,-5,-10,-10,-20],
      [-10,0,0,0,0,0,0,-10],
      [-10,0,5,5,5,5,0,-10],
      [-5,0,5,5,5,5,0,-5],
      [0,0,5,5,5,5,0,-5],
      [-10,5,5,5,5,5,0,-10],
      [-10,0,5,0,0,0,0,-10],
      [-20,-10,-10,-5,-5,-10,-10,-20]
    ];
    const kingTable = [
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-30,-40,-40,-50,-50,-40,-40,-30],
      [-20,-30,-30,-40,-40,-30,-30,-20],
      [-10,-20,-20,-20,-20,-20,-20,-10],
      [20,20,0,0,0,0,20,20],
      [20,30,10,0,0,10,30,20]
    ];

    return {
      pawn: { white: pawnTable, black: mirror(pawnTable) },
      knight: { white: knightTable, black: mirror(knightTable) },
      bishop: { white: bishopTable, black: mirror(bishopTable) },
      rook: { white: rookTable, black: mirror(rookTable) },
      queen: { white: queenTable, black: mirror(queenTable) },
      king: { white: kingTable, black: mirror(kingTable) }
    };
  }

  initializeOpeningBook() {
    return {
      'start': ['e2e4', 'd2d4', 'g1f3', 'b1c3'],
      'e2e4': ['e7e5', 'c7c5', 'e7e6'],
      'd2d4': ['d7d5', 'g8f6', 'd7d6']
    };
  }

  initializeBoard() {
    const board = Array(8).fill().map(() => Array(8).fill(null));
    const pieceOrder = [Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook];

    for (let col = 0; col < 8; col++) {
      board[1][col] = new Pawn('black');
      board[6][col] = new Pawn('white');
      board[0][col] = new pieceOrder[col]('black');
      board[7][col] = new pieceOrder[col]('white');
    }

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col]?.type === 'pawn') board[row][col].game = this;
      }
    }
    return board;
  }

  makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    if (!piece || piece.color !== this.currentTurn) return false;

    const possibleMoves = piece.getPossibleMoves(this.board, fromRow, fromCol);
    if (!possibleMoves.some(([r, c]) => r === toRow && c === toCol)) return false;
    if (this.wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol)) return false;

    // Handle special moves
    let castlingRookMove = null;
    if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
      castlingRookMove = toCol === 6 ? { from: [fromRow, 7], to: [fromRow, 5] } : { from: [fromRow, 0], to: [fromRow, 3] };
    }

    const captured = this.board[toRow][toCol];
    if (captured) this.capturedPieces[captured.color].push(captured);

    // En-passant capture
    if (piece.type === 'pawn' && Math.abs(fromCol - toCol) === 1 && !captured) {
      const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
      const capturedPawn = this.board[capturedPawnRow][toCol];
      if (capturedPawn?.type === 'pawn' && capturedPawn.color !== piece.color) {
        this.capturedPieces[capturedPawn.color].push(capturedPawn);
        this.board[capturedPawnRow][toCol] = null;
      }
    }

    // Move piece
    const promotedPiece = piece.type === 'pawn' && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7)) ? new Queen(piece.color) : null;
    this.board[toRow][toCol] = promotedPiece || piece;
    this.board[fromRow][fromCol] = null;

    // Handle castling
    if (castlingRookMove) {
      const rook = this.board[castlingRookMove.from[0]][castlingRookMove.from[1]];
      this.board[castlingRookMove.to[0]][castlingRookMove.to[1]] = rook;
      this.board[castlingRookMove.from[0]][castlingRookMove.from[1]] = null;
      rook.hasMoved = true;
    }

    piece.hasMoved = true;
    this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';

    this.moveHistory.push({
      from: [fromRow, fromCol],
      to: [toRow, toCol],
      piece: piece,
      captured: captured,
      promoted: promotedPiece,
      castling: castlingRookMove
    });

    return true;
  }

  getBoard() { return this.board; }
  getCurrentTurn() { return this.currentTurn; }

  getBoardString() {
    let str = '';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        str += piece ? piece.getSymbol() : '.';
        if (col < 7) str += ' ';
      }
      if (row < 7) str += '\n';
    }
    return str;
  }

  wouldLeaveKingInCheck(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    const captured = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    let enPassantCaptured = null;
    if (piece.type === 'pawn' && Math.abs(fromCol - toCol) === 1 && !captured) {
      const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1;
      enPassantCaptured = this.board[capturedPawnRow][toCol];
      if (enPassantCaptured?.type === 'pawn' && enPassantCaptured.color !== piece.color) {
        this.board[capturedPawnRow][toCol] = null;
      }
    }

    let kingRow, kingCol;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.type === 'king' && p.color === this.currentTurn) {
          kingRow = r; kingCol = c;
          break;
        }
      }
      if (kingRow !== undefined) break;
    }

    const inCheck = this.isSquareUnderAttack(kingRow, kingCol, this.currentTurn === 'white' ? 'black' : 'white');

    if (enPassantCaptured) this.board[enPassantCaptured.row || (piece.color === 'white' ? toRow + 1 : toRow - 1)][toCol] = enPassantCaptured;
    this.board[fromRow][fromCol] = piece;
    this.board[toRow][toCol] = captured;

    return inCheck;
  }

  isSquareUnderAttack(row, col, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece?.color === byColor) {
          const moves = piece.getPossibleMoves(this.board, r, c);
          if (moves.some(([mr, mc]) => mr === row && mc === col)) return true;
        }
      }
    }
    return false;
  }

  isInCheck(color) {
    let kingRow, kingCol;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p?.type === 'king' && p.color === color) {
          kingRow = r; kingCol = c;
          break;
        }
      }
      if (kingRow !== undefined) break;
    }
    return this.isSquareUnderAttack(kingRow, kingCol, color === 'white' ? 'black' : 'white');
  }

  isCheckmate(color) {
    if (!this.isInCheck(color)) return false;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece?.color === color) {
          const moves = piece.getPossibleMoves(this.board, r, c);
          for (const [mr, mc] of moves) {
            if (!this.wouldLeaveKingInCheck(r, c, mr, mc)) return false;
          }
        }
      }
    }
    return true;
  }

  setBotLevel(level) { this.botLevel = level; }
  getBotLevel() { return this.botLevel || 1200; }

  getBotMove() {
    const level = this.getBotLevel();
    if (level <= 400) {
      // easy: random
      return this.getRandomMove();
    } else if (level <= 1400) {
      // medium: greedy
      const weights = {
        material: 1, mobility: 0.5, center: 1, kingSafety: 1,
        pawnStructure: 0.5, passedPawn: 0.5, space: 0.5, outposts: 0.5,
        initiative: 1, bishopPair: 0.5, rookActivity: 1,
        isolatedPawns: -0.5, backwardPawns: -0.3, hangingPenalty: -2
      };
      return this.getSmartMove(weights, 5, 2);
    } else {
      // hard: minimax
      const depth = 4;
      const legalMoves = this.getAllLegalMoves();
      if (legalMoves.length === 0) return null;
      let bestMove = legalMoves[0];
      let bestEval = -Infinity;
      for (const move of legalMoves) {
        const tempGame = new ChessGame(this);
        tempGame.makeMove(move[0], move[1], move[2], move[3]);
        const evaluation = -tempGame.minimax(depth - 1, -Infinity, Infinity, false);
        if (evaluation > bestEval) {
          bestEval = evaluation;
          bestMove = move;
        }
      }
      return bestMove;
    }
  }

  iterativeDeepening(weights, maxDepth, timeLimit, topMoves, randomCount) {
    const startTime = Date.now();
    let bestMove = null;
    let currentDepth = 1;

    while (currentDepth <= maxDepth) {
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime >= timeLimit) break;

      // Filhaal hum depth ko greedy eval ke sath use nahi kar rahe,
      // lekin difficulty ke hisaab se topMoves & randomness use kar rahe hain.
      const move = this.getSmartMove(weights, topMoves, randomCount);

      if (move) {
        bestMove = move;
      }

      currentDepth++;
    }

    // Safety net: agar kisi reason se bestMove null ho jaye
    if (!bestMove) {
      bestMove = this.getRandomMove();
    }

    return bestMove;
  }

  getSmartMove(weights, topMoves, randomCount) {
    const allMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece?.color === this.currentTurn) {
          const moves = piece.getPossibleMoves(this.board, r, c);
          for (const [mr, mc] of moves) {
            if (!this.wouldLeaveKingInCheck(r, c, mr, mc)) {
              const score = this.evaluateMove(r, c, mr, mc, piece, weights);
              allMoves.push({ from: [r, c], to: [mr, mc], score });
            }
          }
        }
      }
    }

    if (allMoves.length === 0) return null;
    allMoves.sort((a, b) => b.score - a.score);
    const candidates = allMoves.slice(0, Math.min(topMoves, allMoves.length));
    const selected = candidates[Math.floor(Math.random() * Math.min(randomCount, candidates.length))];
    return [...selected.from, ...selected.to];
  }

  evaluateMove(r, c, mr, mc, piece, weights) {
    let score = 0;
    const target = this.board[mr][mc];

    // Material
    if (target) score += this.getPieceValue(target.type) * 10 * weights.material;

    // Mobility
    const moves = piece.getPossibleMoves(this.board, r, c);
    score += moves.length * weights.mobility;

    // Center control
    if ((mr >= 2 && mr <= 5) && (mc >= 2 && mc <= 5)) score += weights.center;

    // King safety
    if (piece.type === 'king') score += weights.kingSafety;

    // Pawn structure and passed pawns
    if (piece.type === 'pawn') {
      score += weights.pawnStructure;
      // Passed pawn
      let isPassed = true;
      const direction = piece.color === 'white' ? -1 : 1;
      for (let row = mr + direction; row >= 0 && row < 8; row += direction) {
        for (let col = mc - 1; col <= mc + 1; col++) {
          if (col >= 0 && col < 8) {
            const blockingPiece = this.board[row][col];
            if (blockingPiece?.type === 'pawn' && blockingPiece.color !== piece.color) {
              isPassed = false;
              break;
            }
          }
        }
        if (!isPassed) break;
      }
      if (isPassed) score += weights.passedPawn;
    }

    // Space advantage
    if ((mr >= 1 && mr <= 6) && (mc >= 1 && mc <= 6)) score += weights.space;

    // Outposts
    if ((piece.type === 'knight' || piece.type === 'bishop') && (mr >= 2 && mr <= 5) && (mc >= 2 && mc <= 5)) {
      const pawnRow = piece.color === 'white' ? mr - 1 : mr + 1;
      if (pawnRow >= 0 && pawnRow < 8) {
        if (this.board[pawnRow][mc]?.type === 'pawn' && this.board[pawnRow][mc].color === piece.color) {
          score += weights.outposts;
        }
      }
    }

    // Initiative
    score += weights.initiative;

    // Bishop pair
    if (piece.type === 'bishop') {
      let bishopCount = 0;
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          if (this.board[row][col]?.type === 'bishop' && this.board[row][col].color === piece.color) bishopCount++;
        }
      }
      if (bishopCount === 2) score += weights.bishopPair;
    }

    // Rook activity
    if (piece.type === 'rook') score += weights.rookActivity;

    // Isolated pawns penalty
    if (piece.type === 'pawn') {
      let hasNeighbor = false;
      for (let col = mc - 1; col <= mc + 1; col += 2) {
        if (col >= 0 && col < 8) {
          for (let row = 0; row < 8; row++) {
            if (this.board[row][col]?.type === 'pawn' && this.board[row][col].color === piece.color) {
              hasNeighbor = true;
              break;
            }
          }
        }
      }
      if (!hasNeighbor) score += weights.isolatedPawns;
    }

    // Backward pawns penalty
    if (piece.type === 'pawn') {
      const direction = piece.color === 'white' ? -1 : 1;
      const frontRow = mr + direction;
      if (frontRow >= 0 && frontRow < 8) {
        let isBackward = true;
        for (let col = mc - 1; col <= mc + 1; col++) {
          if (col >= 0 && col < 8) {
            if (this.board[frontRow][col]?.type === 'pawn' && this.board[frontRow][col].color === piece.color) {
              isBackward = false;
              break;
            }
          }
        }
        if (isBackward) score += weights.backwardPawns;
      }
    }

    // Hanging penalty
    if (this.isSquareUnderAttack(mr, mc, this.currentTurn === 'white' ? 'black' : 'white')) {
      score += weights.hangingPenalty;
    }

    return score;
  }

  getRandomMove() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === this.currentTurn) pieces.push([r, c]);
      }
    }

    for (let i = pieces.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    }

    for (const [r, c] of pieces) {
      const piece = this.board[r][c];
      const moves = piece.getPossibleMoves(this.board, r, c);
      for (let i = moves.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [moves[i], moves[j]] = [moves[j], moves[i]];
      }
      for (const [mr, mc] of moves) {
        if (!this.wouldLeaveKingInCheck(r, c, mr, mc)) return [r, c, mr, mc];
      }
    }
    return null;
  }

  getPieceValue(pieceType) {
    const values = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 };
    return values[pieceType] || 0;
  }

  evaluatePieceSquareTables() {
    let score = 0;
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) score += this.pieceSquareTables[piece.type][piece.color][row][col];
      }
    }
    return score;
  }

  minimax(depth, alpha, beta, maximizingPlayer) {
    if (depth === 0) return this.quiescenceSearch(alpha, beta, maximizingPlayer);

    // Null move pruning
    if (!maximizingPlayer && depth >= 3 && !this.isInCheck(this.currentTurn) && !this.isEndgame()) {
      const nullMoveGame = new ChessGame(this);
      nullMoveGame.currentTurn = nullMoveGame.currentTurn === 'white' ? 'black' : 'white';
      const nullEval = -nullMoveGame.minimax(depth - 3, -beta, -beta + 1, true);
      if (nullEval >= beta) {
        return beta;
      }
    }

    const legalMoves = this.getAllLegalMoves();

    // Sort moves for better alpha-beta pruning
    const sortedMoves = this.orderMoves(legalMoves);

    if (maximizingPlayer) {
      let maxEval = -Infinity;
      for (const move of sortedMoves) {
        const tempGame = new ChessGame(this);
        tempGame.makeMove(move[0], move[1], move[2], move[3]);
        const evaluation = tempGame.minimax(depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of sortedMoves) {
        const tempGame = new ChessGame(this);
        tempGame.makeMove(move[0], move[1], move[2], move[3]);
        const evaluation = tempGame.minimax(depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  quiescenceSearch(alpha, beta, maximizingPlayer) {
    // Stand pat: evaluate current position
    let standPat = this.evaluatePositionForMinimax();

    if (maximizingPlayer) {
      if (standPat >= beta) return beta;
      alpha = Math.max(alpha, standPat);
    } else {
      if (standPat <= alpha) return alpha;
      beta = Math.min(beta, standPat);
    }

    // Get capture moves and checks
    const captureMoves = this.getCaptureMoves();

    // Sort captures by MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
    const sortedCaptures = this.orderCaptures(captureMoves);

    if (maximizingPlayer) {
      for (const move of sortedCaptures) {
        const tempGame = new ChessGame(this);
        tempGame.makeMove(move[0], move[1], move[2], move[3]);
        const evaluation = tempGame.quiescenceSearch(alpha, beta, false);
        if (evaluation >= beta) return beta;
        alpha = Math.max(alpha, evaluation);
      }
      return alpha;
    } else {
      for (const move of sortedCaptures) {
        const tempGame = new ChessGame(this);
        tempGame.makeMove(move[0], move[1], move[2], move[3]);
        const evaluation = tempGame.quiescenceSearch(alpha, beta, true);
        if (evaluation <= alpha) return alpha;
        beta = Math.min(beta, evaluation);
      }
      return beta;
    }
  }

  getCaptureMoves() {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece?.color === this.currentTurn) {
          const pieceMoves = piece.getPossibleMoves(this.board, r, c);
          for (const [mr, mc] of pieceMoves) {
            const target = this.board[mr][mc];
            // Include captures and checks
            if (target || this.wouldBeCheckAfterMove(r, c, mr, mc)) {
              if (!this.wouldLeaveKingInCheck(r, c, mr, mc)) {
                moves.push([r, c, mr, mc]);
              }
            }
          }
        }
      }
    }
    return moves;
  }

  wouldBeCheckAfterMove(fromRow, fromCol, toRow, toCol) {
    const piece = this.board[fromRow][fromCol];
    const captured = this.board[toRow][toCol];
    this.board[toRow][toCol] = piece;
    this.board[fromRow][fromCol] = null;

    const opponentColor = this.currentTurn === 'white' ? 'black' : 'white';
    const inCheck = this.isInCheck(opponentColor);

    this.board[fromRow][fromCol] = piece;
    this.board[toRow][toCol] = captured;

    return inCheck;
  }

  orderCaptures(moves) {
    return moves.sort((a, b) => {
      const [aFromRow, aFromCol, aToRow, aToCol] = a;
      const [bFromRow, bFromCol, bToRow, bToCol] = b;

      const aAttacker = this.board[aFromRow][aFromCol];
      const aVictim = this.board[aToRow][aToCol];
      const bAttacker = this.board[bFromRow][bFromCol];
      const bVictim = this.board[bToRow][bToCol];

      // MVV-LVA: Most Valuable Victim - Least Valuable Attacker
      const aScore = (aVictim ? this.getPieceValue(aVictim.type) * 10 : 0) - this.getPieceValue(aAttacker.type);
      const bScore = (bVictim ? this.getPieceValue(bVictim.type) * 10 : 0) - this.getPieceValue(bAttacker.type);

      return bScore - aScore; // Higher scores first
    });
  }

  orderMoves(moves) {
    return moves.sort((a, b) => {
      const scoreA = this.scoreMove(a);
      const scoreB = this.scoreMove(b);
      return scoreB - scoreA; // Higher scores first
    });
  }

  scoreMove(move) {
    let score = 0;
    const [fromRow, fromCol, toRow, toCol] = move;
    const piece = this.board[fromRow][fromCol];
    const target = this.board[toRow][toCol];

    // Prioritize captures, especially winning ones
    if (target) {
      const attackerValue = this.getPieceValue(piece.type);
      const victimValue = this.getPieceValue(target.type);
      score += 10 + victimValue - attackerValue; // Winning captures get higher priority
    }

    // Prioritize center moves
    if ((toRow >= 2 && toRow <= 5) && (toCol >= 2 && toCol <= 5)) {
      score += 3;
    }

    // Prioritize pawn promotions
    if (piece.type === 'pawn' && ((piece.color === 'white' && toRow === 0) || (piece.color === 'black' && toRow === 7))) {
      score += 8;
    }

    // Prioritize checks
    const tempGame = new ChessGame(this);
    tempGame.makeMove(fromRow, fromCol, toRow, toCol);
    if (tempGame.isInCheck(tempGame.currentTurn === 'white' ? 'black' : 'white')) {
      score += 5;
    }

    // Prioritize piece development in opening
    if (this.moveHistory.length < 10) {
      if (piece.type === 'knight' || piece.type === 'bishop') {
        score += 2;
      }
    }

    return score;
  }

  getAllLegalMoves() {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece?.color === this.currentTurn) {
          const pieceMoves = piece.getPossibleMoves(this.board, r, c);
          for (const [mr, mc] of pieceMoves) {
            if (!this.wouldLeaveKingInCheck(r, c, mr, mc)) moves.push([r, c, mr, mc]);
          }
        }
      }
    }
    return moves;
  }

  isEndgame() {
    // Count major pieces (queens and rooks)
    let whiteMajorPieces = 0;
    let blackMajorPieces = 0;
    let whiteMinorPieces = 0;
    let blackMinorPieces = 0;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) {
          if (piece.type === 'queen' || piece.type === 'rook') {
            if (piece.color === 'white') whiteMajorPieces++;
            else blackMajorPieces++;
          } else if (piece.type === 'bishop' || piece.type === 'knight') {
            if (piece.color === 'white') whiteMinorPieces++;
            else blackMinorPieces++;
          }
        }
      }
    }

    // Endgame if both sides have few major pieces
    return (whiteMajorPieces + blackMajorPieces <= 2) ||
           (whiteMajorPieces === 0 && blackMajorPieces === 0 && whiteMinorPieces + blackMinorPieces <= 3);
  }

  evaluatePositionForMinimax() {
    let score = 0;
    const isEndgame = this.isEndgame();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece) {
          let pieceValue = this.getPieceValue(piece.type);

          // Adjust piece values in endgame
          if (isEndgame) {
            if (piece.type === 'pawn') pieceValue += 0.5; // Pawns become more valuable
            else if (piece.type === 'king') pieceValue += 1.0; // King becomes more active
            else if (piece.type === 'rook') pieceValue += 0.5; // Rooks gain value
          }

          score += piece.color === 'white' ? pieceValue : -pieceValue;
        }
      }
    }

    score += this.evaluatePieceSquareTables();

    // Add endgame-specific evaluation
    if (isEndgame) {
      score += this.evaluateEndgame();
    }

    return this.currentTurn === 'white' ? score : -score;
  }

  evaluateEndgame() {
    let score = 0;

    // King centralization in endgame
    let whiteKingRow = -1, whiteKingCol = -1;
    let blackKingRow = -1, blackKingCol = -1;

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece?.type === 'king') {
          if (piece.color === 'white') {
            whiteKingRow = row;
            whiteKingCol = col;
          } else {
            blackKingRow = row;
            blackKingCol = col;
          }
        }
      }
    }

    // King should be more central in endgame
    if (whiteKingRow !== -1) {
      const whiteKingCentrality = 4 - Math.abs(whiteKingRow - 3.5) - Math.abs(whiteKingCol - 3.5);
      score += whiteKingCentrality * 0.1;
    }
    if (blackKingRow !== -1) {
      const blackKingCentrality = 4 - Math.abs(blackKingRow - 3.5) - Math.abs(blackKingCol - 3.5);
      score -= blackKingCentrality * 0.1;
    }

    // Pawn advancement bonus
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = this.board[row][col];
        if (piece?.type === 'pawn') {
          const advancement = piece.color === 'white' ? row : (7 - row);
          const advancementBonus = advancement * 0.05;
          score += piece.color === 'white' ? advancementBonus : -advancementBonus;
        }
      }
    }

    return score;
  }

  updateTime(deltaMs) {
    if (this.currentTurn === 'white') this.whiteTime = Math.max(0, this.whiteTime - deltaMs);
    else this.blackTime = Math.max(0, this.blackTime - deltaMs);
  }

  getTimeRemaining(color) { return color === 'white' ? this.whiteTime : this.blackTime; }
  isTimeUp() { return (this.currentTurn === 'white' && this.whiteTime <= 0) || (this.currentTurn === 'black' && this.blackTime <= 0); }
  setGameMode(mode) { this.gameMode = mode; }
  getGameMode() { return this.gameMode; }
  setGameId(id = null) { this.gameId = id || Math.random().toString(36).substring(2, 15); }
  getGameId() { return this.gameId; }

  serialize() {
    return {
      board: this.board.map(row => row.map(piece => piece ? {
        color: piece.color, type: piece.type, hasMoved: piece.hasMoved
      } : null)),
      currentTurn: this.currentTurn,
      moveHistory: this.moveHistory,
      capturedPieces: this.capturedPieces,
      whiteTime: this.whiteTime,
      blackTime: this.blackTime,
      timeControl: this.timeControl,
      gameMode: this.gameMode,
      gameId: this.gameId
    };
  }

  static deserialize(data) {
    const game = new ChessGame();
    game.board = data.board.map(row => row.map(pieceData => {
      if (!pieceData) return null;
      let PieceClass;
      switch (pieceData.type) {
        case 'king': PieceClass = King; break;
        case 'queen': PieceClass = Queen; break;
        case 'rook': PieceClass = Rook; break;
        case 'bishop': PieceClass = Bishop; break;
        case 'knight': PieceClass = Knight; break;
        case 'pawn': PieceClass = Pawn; break;
        default: return null;
      }
      const piece = new PieceClass(pieceData.color);
      if (pieceData.hasMoved !== undefined) piece.hasMoved = pieceData.hasMoved;
      return piece;
    }));
    game.currentTurn = data.currentTurn;
    game.moveHistory = data.moveHistory;
    game.capturedPieces = data.capturedPieces;
    game.whiteTime = data.whiteTime;
    game.blackTime = data.blackTime;
    game.timeControl = data.timeControl;
    game.gameMode = data.gameMode;
    game.gameId = data.gameId;

    // Set game reference for pawns
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (game.board[row][col]?.type === 'pawn') game.board[row][col].game = game;
      }
    }

    return game;
  }
}

export { Pawn };
export default ChessGame;
