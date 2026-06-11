# Chess Game (React)

A modern chess application built with React featuring local multiplayer, AI-powered gameplay, and shareable game sessions. The project includes a custom chess engine with complete move validation, special chess rules, and multiple AI difficulty levels powered by minimax search and evaluation algorithms.

## Features

### Game Modes

* Local Multiplayer (2 players on the same device)
* Play Against AI Bot
* Play with Friends via Shareable Game Links
* Online Match Interface (Coming Soon)

### Chess Engine

* Complete Piece Movement Logic
* Check Detection
* Checkmate Detection
* Castling Support
* En Passant Support
* Automatic Pawn Promotion
* Move Validation
* Turn Management

### AI Opponent

#### Easy

* Random legal move generation

#### Medium

* Position evaluation using weighted scoring

#### Hard

* Minimax Algorithm
* Alpha-Beta Pruning
* Quiescence Search
* Strategic Move Selection

### Additional Features

* Interactive Chess Board
* Legal Move Highlighting
* Check Warning Indicators
* Turn-Based Timer System
* Game State Management
* Shareable Match Links

## Technology Stack

* React.js
* JavaScript (ES6+)
* HTML5
* CSS3
* Custom Chess Engine
* Minimax Algorithm
* Alpha-Beta Pruning

## Project Structure

```text
.
├── public/
│   ├── index.html
│   └── favicon.ico
│
├── src/
│   ├── App.js
│   ├── ChessGame.js
│   ├── ChessBoard.js
│   ├── GameModeSelector.js
│   ├── App.css
│   ├── index.css
│   └── index.js
│
├── test_chess.js
├── test_edge_cases.js
├── package.json
└── README.md
```

## How It Works

### 1. Game Initialization

* User selects a game mode.
* The chess board is initialized with standard piece placement.
* Game state and timers are created.

### 2. Move Validation

The custom chess engine:

* Validates piece movement
* Checks legal destinations
* Prevents illegal moves
* Ensures king safety
* Applies special chess rules

### 3. AI Decision Making

Depending on difficulty level:

* Easy: Random move selection
* Medium: Position evaluation and weighted scoring
* Hard: Minimax search with Alpha-Beta pruning

### 4. Game State Monitoring

The engine continuously checks:

* Check conditions
* Checkmate conditions
* Turn changes
* Timer expiration
* Special move availability

## AI Architecture

### Position Evaluation

The bot evaluates:

* Material advantage
* Piece activity
* Board control
* Tactical opportunities

### Search Algorithm

Hard mode uses:

* Minimax Search
* Alpha-Beta Pruning
* Quiescence Search

to determine the strongest available move.

## Installation

### Clone Repository

```bash
git clone <repository-url>
```

### Install Dependencies

```bash
npm install
```

### Start Development Server

```bash
npm start
```

### Run Tests

```bash
npm test
```

### Run Engine Tests

```bash
node test_chess.js
node test_edge_cases.js
```

## Screenshots

### Home Screen

![Home](screenshots/home.png)

### Chess Board

![Board](screenshots/board.png)

### AI Gameplay

![Bot](screenshots/bot-game.png)

### Friend Mode

![Friend Mode](screenshots/friend-mode.png)

## Future Improvements

* Multiplayer Server Synchronization
* Real-Time Online Matches
* ELO Rating System
* Move History Analysis
* Game Replay System
* Chess Opening Database
* Stockfish Integration

## Author

**Anuj Srivastava**

Aspiring Full-Stack Developer | React | Python | AI | Data Science


