const ChessGame = require('./src/ChessGame.js').default;

console.log('Testing ChessGame edge cases and performance...');

// Create a new chess game
const game = new ChessGame();

// Test edge cases for topMoves and randomCount
console.log('\nTesting edge cases...');

// Test with very small topMoves
game.setBotLevel(600); // Low level, small topMoves
const startTime1 = Date.now();
const move1 = game.getBotMove();
const time1 = Date.now() - startTime1;
console.log(`Low level (topMoves=1, randomCount=3): Move generated in ${time1}ms - ${move1 ? 'Yes' : 'No'}`);

// Test with medium level
game.setBotLevel(1400);
const startTime2 = Date.now();
const move2 = game.getBotMove();
const time2 = Date.now() - startTime2;
console.log(`Medium level (topMoves=5, randomCount=5): Move generated in ${time2}ms - ${move2 ? 'Yes' : 'No'}`);

// Test with high level
game.setBotLevel(2300);
const startTime3 = Date.now();
const move3 = game.getBotMove();
const time3 = Date.now() - startTime3;
console.log(`High level (topMoves=12, randomCount=12): Move generated in ${time3}ms - ${move3 ? 'Yes' : 'No'}`);

// Test with very high level (max)
game.setBotLevel(3000); // Above max, should use max values
const startTime4 = Date.now();
const move4 = game.getBotMove();
const time4 = Date.now() - startTime4;
console.log(`Very high level (topMoves=12, randomCount=12): Move generated in ${time4}ms - ${move4 ? 'Yes' : 'No'}`);

// Test multiple moves to check consistency
console.log('\nTesting consistency over multiple moves...');
let consistent = true;
const moves = [];
for (let i = 0; i < 5; i++) {
  const testMove = game.getBotMove();
  if (testMove) moves.push(testMove);
  else consistent = false;
}
console.log(`Generated ${moves.length}/5 moves consistently: ${consistent ? 'Yes' : 'No'}`);

console.log('Edge case testing completed.');
