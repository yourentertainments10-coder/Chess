const ChessGame = require('./src/ChessGame.js').default;

console.log('Testing ChessGame iterativeDeepening method...');

// Create a new chess game
const game = new ChessGame();

// Set bot level to medium for testing
game.setBotLevel(1400);

// Get a bot move
const move = game.getBotMove();

if (move && move.length === 4) {
  console.log('Bot move generated successfully:', move);
  console.log('Move format: [fromRow, fromCol, toRow, toCol]');
} else {
  console.log('Error: Invalid move generated');
}

// Test with different bot levels
console.log('\nTesting different bot levels...');
const levels = [600, 1400, 2300];
levels.forEach(level => {
  game.setBotLevel(level);
  const testMove = game.getBotMove();
  console.log(`Level ${level}: Move generated - ${testMove ? 'Yes' : 'No'}`);
});

console.log('Basic testing completed.');
