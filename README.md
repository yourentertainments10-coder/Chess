# Chess Game (React)

A React-based chess game with:
- Local play
- Play vs Bot (difficulty/rating levels)
- Play with a friend via shareable game link

This project includes a custom chess rules engine and a basic bot using evaluation + minimax (higher difficulties).

---

## Features

### Game modes
- **Local**: Two players on the same device.
- **Play vs Bot**: Bot strength varies by selected rating.
- **Play with Friend**: Generates a shareable URL containing a `game` id.
- **Online Match**: UI stub (disabled / coming soon).

### Chess rules (engine)
Implemented in `src/ChessGame.js`:
- Piece movement for: **King, Queen, Rook, Bishop, Knight, Pawn**
- **Check** detection
- **Checkmate** detection
- **Castling** (basic)
- **En passant**
- **Pawn promotion** (auto-promotes to **Queen**)

### Bot
Implemented in `src/ChessGame.js`:
- **Easy**: random legal move
- **Medium**: “smart” move selection using evaluation weights
- **Hard**: minimax with alpha-beta pruning + quiescence search

Bot strength is controlled by `setBotLevel(level)`.

---

## Project Structure

- `public/`
  - `index.html` (CRA template)
  - `favicon.ico`
- `src/`
  - `App.js`: App entry + game loop, bot moves, timer, game end checks, sharing
  - `ChessGame.js`: Core chess engine + bot logic + evaluation/minimax
  - `ChessBoard.js`: Visual board + square highlighting + check highlighting
  - `GameModeSelector.js`: Mode selection UI and bot level picker
  - `App.css`, `index.css`: Styling
  - `index.js`: ReactDOM bootstrap
- `test_chess.js`: Simple bot move generation test
- `test_edge_cases.js`: Bot move generation tests across difficulty levels
- `package.json`: Dependencies and scripts

---

## How to Run

### 1) Install dependencies
```bash
npm install
```

### 2) Start the dev server
```bash
npm start
```

### 3) Run tests (React CRA)
```bash
npm test
```

### 4) Run provided JS scripts (engine smoke tests)
These are simple Node-style scripts that import `src/ChessGame.js`:
```bash
node test_chess.js
node test_edge_cases.js
```

---

## Usage

1. Start the app.
2. Select a game mode:
   - **Play Local** or **Play vs Bot** or **Play with Friend**.
3. Click squares to move pieces:
   - Click a piece of the side whose turn it is.
   - Click a destination square.
4. If playing vs bot, the bot moves automatically when it is Black’s turn.
5. Timer: the app tracks a clock for both sides and ends the game on timeout.
6. If playing with a friend, use **Share Game Link**.

---

## Key Implementation Details

### Board representation
- The board is an **8x8 array** of pieces or `null`.
- Each piece is an object with:
  - `color`: `'white' | 'black'`
  - `type`: `'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'`
  - plus piece-specific state (e.g., `hasMoved` for king/rook/pawn)

### Move validation
- `ChessGame.makeMove(fromRow, fromCol, toRow, toCol)`:
  - Ensures the piece belongs to the current turn
  - Ensures destination is in `getPossibleMoves`
  - Rejects moves that would leave the moving side’s king in check via `wouldLeaveKingInCheck`
  - Applies special rules: castling, en-passant, promotion

### Bot
- `getBotMove()` chooses moves based on `botLevel`.
- Medium uses `getSmartMove()` with evaluation weights.
- Hard uses `minimax()` (with pruning) and `quiescenceSearch()`.

---

## Notes / Limitations (current engine)
- Castling is handled with simplified checks based on emptiness and rook/king move state.
- Checkmate detection relies on enumerating possible moves and verifying king safety.
- Online match is not implemented (disabled in `GameModeSelector`).
- Friend mode currently only creates a local game with the provided `gameId` (no server sync).

---

## License

Not specified in the repository. Add your preferred license text if needed.

