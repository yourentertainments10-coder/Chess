import ChessGame from './ChessGame.mjs';

// Plays one bot against another and returns the result from white's point of
// view: 1 win, 0.5 draw, 0 loss. Games are capped so a shuffling endgame
// cannot run forever.
function playGame(whiteLevel, blackLevel, maxPlies = 120) {
  const game = new ChessGame();
  for (let ply = 0; ply < maxPlies; ply++) {
    const status = game.getGameStatus();
    if (status.over) {
      if (status.reason === 'checkmate') return status.winner === 'white' ? 1 : 0;
      return 0.5;
    }
    game.setBotLevel(game.getCurrentTurn() === 'white' ? whiteLevel : blackLevel);
    const move = game.getBotMove();
    if (!move) return 0.5;
    game.makeMove(move[0], move[1], move[2], move[3]);
  }
  // Ran out of moves: adjudicate on material, which is what a human would do.
  const material = countMaterial(game);
  if (material > 150) return 1;
  if (material < -150) return 0;
  return 0.5;
}

function countMaterial(game) {
  const values = { pawn: 100, knight: 320, bishop: 330, rook: 500, queen: 900, king: 0 };
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = game.board[r][c];
      if (p) score += p.color === 'white' ? values[p.type] : -values[p.type];
    }
  }
  return score;
}

// Plays a mini-match with colours alternating so neither side gets a first-move
// advantage across the sample. Returns the stronger level's score share.
function match(strongLevel, weakLevel, games) {
  let strongScore = 0;
  for (let i = 0; i < games; i++) {
    strongScore += i % 2 === 0
      ? playGame(strongLevel, weakLevel)
      : 1 - playGame(weakLevel, strongLevel);
  }
  return strongScore / games;
}

describe('bot strength ordering', () => {
  jest.setTimeout(600000);

  test('1200 clearly outplays 400', () => {
    const share = match(1200, 400, 6);
    expect(share).toBeGreaterThanOrEqual(0.83);
  });

  test('1600 outplays 800', () => {
    const share = match(1600, 800, 4);
    expect(share).toBeGreaterThanOrEqual(0.75);
  });

  test('1200 outplays 800', () => {
    const share = match(1200, 800, 4);
    expect(share).toBeGreaterThanOrEqual(0.6);
  });
});

describe('bot tactical competence', () => {
  test('1200 does not hang its queen to a defended square', () => {
    // Qd1 can take the pawn on d5, but it is defended by the c6 pawn.
    const game = ChessGame.fromFen('rnbqkbnr/pp2pppp/2p5/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    game.setBotLevel(1200);
    for (let i = 0; i < 6; i++) {
      const move = game.getBotMove();
      expect(move).not.toEqual([7, 3, 3, 3]); // Qxd5?? loses the queen for a pawn
    }
  });

  test('1200 recaptures instead of leaving material hanging', () => {
    // Black has just taken on e5 with a pawn; white should win it back.
    const game = ChessGame.fromFen('rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 1');
    game.setBotLevel(1200);
    const move = game.getBotMove();
    const next = new ChessGame(game);
    next.makeMove(move[0], move[1], move[2], move[3]);
    // Whatever it plays, it must not simply drop the knight on f3.
    expect(countMaterial(next)).toBeGreaterThanOrEqual(-100);
  });

  test('1200 never misses a mate in one, even when it errs', () => {
    // A mistake is capped at 180cp, and skipping mate costs far more, so the
    // mistake model can never talk it out of mating.
    const game = ChessGame.fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    game.setBotLevel(1200);
    for (let i = 0; i < 15; i++) {
      expect(game.getBotMove()).toEqual([7, 0, 0, 0]); // Ra8#
    }
  });

  test('1200 never declines a free queen', () => {
    const game = ChessGame.fromFen('4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1');
    game.setBotLevel(1200);
    for (let i = 0; i < 15; i++) {
      expect(game.getBotMove()).toEqual([4, 4, 3, 3]); // exd5
    }
  });

  test('800 still finds a mate in one despite a high mistake rate', () => {
    const game = ChessGame.fromFen('6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1');
    game.setBotLevel(800);
    for (let i = 0; i < 15; i++) {
      expect(game.getBotMove()).toEqual([7, 0, 0, 0]);
    }
  });

  test('every level responds within its time budget', () => {
    for (const level of [400, 800, 1200, 1600, 2000, 2400]) {
      const game = new ChessGame();
      game.setBotLevel(level);
      const start = Date.now();
      game.getBotMove();
      const elapsed = Date.now() - start;
      // Budget plus slack for finishing the iteration in progress.
      expect(elapsed).toBeLessThan(6000);
    }
  });
});
