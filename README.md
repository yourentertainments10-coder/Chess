# Gambit·Board

A chess game built from scratch in React — a rules-complete engine validated
against published perft results, a bot that searches ahead instead of guessing,
and online play over a shareable link.

Play against the computer at six strengths, pass a phone back and forth, or send
a friend a link and play from anywhere.

---

## Table of contents

- [Features](#features)
- [Quick start](#quick-start)
- [Deploying](#deploying)
- [How online play works](#how-online-play-works)
- [The chess engine](#the-chess-engine)
- [The bot](#the-bot)
- [Interface](#interface)
- [Project structure](#project-structure)
- [Testing](#testing)
- [Configuration](#configuration)
- [Limitations](#limitations)

---

## Features

**Three ways to play**

| Mode | What it does |
| --- | --- |
| Versus Engine | Six strengths from Novice (400) to Master (2400) |
| Pass & Play | Two players sharing one screen |
| Play Online | Create a game, send the link, play from separate devices |

**Complete chess rules** — castling with all its restrictions, en passant,
underpromotion, stalemate, threefold repetition, the fifty-move rule and
insufficient material. Move generation is verified against standard perft
positions, not just eyeballed.

**A bot that plays its rating.** Strength comes from real search depth; weakness
comes from a bounded mistake model rather than random move selection.

**Works on phones.** Portrait and landscape layouts, correct viewport handling,
44px touch targets.

---

## Quick start

Requires **Node 18 or newer**.

```bash
npm install
```

### Playing locally against the bot or a friend on one screen

```bash
npm start
```

Opens `http://localhost:3000`. Versus Engine and Pass & Play work straight away —
they run entirely in the browser and need no server.

### Playing online locally

Online play needs the API server. Run it in a second terminal:

```bash
npm run server
```

The dev server proxies `/api` to it automatically, so keep using
`http://localhost:3000`. To test two players, open the invite link in a second
browser or a private window — two tabs of the *same* browser share storage and
will both reconnect as the same player.

### Running the production build locally

```bash
npm run serve
```

Builds the app and serves it from the API server on `http://localhost:4000`.
This is exactly what runs in production.

---

## Deploying

**Render is the recommended host** and the free tier is enough. Any host that
runs a persistent Node process works the same way — Railway, Fly.io, Koyeb.

### Why not Vercel or Netlify

Game rooms live in the server's memory. Vercel and Netlify run serverless
functions, which do not keep memory between requests and may not even hit the
same instance twice, so rooms would vanish between moves. Making it work there
means adding an external store (Vercel KV, Upstash Redis). Render keeps one
process alive, so nothing extra is needed.

The bot and Pass & Play modes are pure client-side, so if you only want those
you can deploy the `build/` folder to any static host.

### Deploying to Render

1. Push this repository to GitHub.

2. Go to [render.com](https://render.com) and sign in with GitHub.

3. Click **New → Blueprint** and pick the repository. The included
   [`render.yaml`](render.yaml) fills in every setting.

   To configure it by hand instead, choose **New → Web Service** and set:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Build command | `npm install && npm run build` |
   | Start command | `node server/index.mjs` |
   | Health check path | `/api/health` |
   | Instance type | Free |

4. Click **Create**. The first build takes a few minutes.

5. Open the URL Render gives you (`https://your-app.onrender.com`). Create a
   game, copy the invite link, send it to someone.

Do **not** set a `PORT` variable. Render assigns one and the server reads
`process.env.PORT` automatically.

### The one catch on the free tier

Render's free instances sleep after roughly 15 minutes without traffic, and
waking one takes 30–60 seconds. The first person to open the link waits through
that; everything is instant afterwards. Games in memory are lost when the
instance sleeps, so a game left idle for an hour will not survive.

Upgrading to Render's cheapest paid instance removes the sleep entirely. That is
the only thing worth paying for here.

---

## How online play works

One Node process serves both the built React app and the API, so there is a
single URL and no CORS to configure.

### The server is the referee

The server owns the position and validates every move with the same engine the
UI runs. A client is never trusted beyond "this token would like to play this
move". It is checked that the game exists, the token belongs to a seated player,
it is that player's turn, the game is not over, and the move is legal. Anything
else is rejected.

This matters: with client-side validation, anyone can open devtools and send an
illegal move or move their opponent's pieces.

### Clocks are server-side

Time is charged when a move is received, based on server timestamps. A client
that pauses its JavaScript still loses on time. The browser ticks the clock
locally between updates purely so the display is smooth, and resyncs to the
server every time it hears from it.

### Sync uses long polling, not WebSockets

The client asks for any change since the version it last saw. If nothing has
changed the server holds the request open for up to 25 seconds and answers the
moment a move lands. Moves arrive as fast as they would over a socket, an idle
game costs about three requests a minute, and it works on any host that serves
plain HTTP — including ones where WebSockets are awkward or unavailable.

### Reconnecting

Each player gets a token stored in `localStorage`. Refreshing the page, losing
signal or locking a phone all recover the same seat with the game intact. If an
opponent goes quiet their name shows *reconnecting*.

### API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/rooms` | Create a game, seats you as White |
| `POST` | `/api/rooms/:code/join` | Take the free seat, or reclaim yours with a token |
| `GET` | `/api/rooms/:code?since=N` | Long poll for changes |
| `POST` | `/api/rooms/:code/move` | Submit a move for validation |
| `POST` | `/api/rooms/:code/resign` | Resign |
| `GET` | `/api/health` | Uptime and room count |

Invite codes are five characters from an alphabet with no `0/O` or `1/I/L`, so
they can be read aloud. Rooms are dropped after two hours of inactivity.

---

## The chess engine

Everything lives in [`src/ChessGame.mjs`](src/ChessGame.mjs) with no browser
dependencies, which is why the same file runs the UI and referees the server.

### Rules

All of them, including the ones that are easy to get subtly wrong:

- Full move generation for all six piece types.
- **Castling** — rejected through or out of check, and rights are dropped when
  the king or a rook moves, or when a rook is captured on its home square.
- **En passant** — a target square that expires after exactly one move.
- **Promotion** — to queen, rook, bishop or knight.
- **Pins and check evasion** — every candidate move is played and verified.
- Draws by **stalemate**, **threefold repetition**, the **fifty-move rule** and
  **insufficient material**.
- Moves are recorded in **algebraic notation** with capture, check, mate and
  disambiguation markers.

### Correctness

Move generation is verified with [perft](https://www.chessprogramming.org/Perft_Results)
against five standard positions chosen to stress castling, en passant,
promotion and pins. Node counts match the published values exactly:

| Position | Depth | Nodes |
| --- | --- | --- |
| Starting position | 4 | 197,281 |
| Kiwipete | 3 | 97,862 |
| Position 3 | 4 | 43,238 |
| Position 4 (promotions) | 3 | 9,467 |
| Position 5 | 3 | 62,379 |

If these counts match, every special case is handled correctly. This is the
standard way to validate a chess engine and it is worth writing first.

### Board representation

An 8×8 array of `{ type, color }` or `null`. Castling rights, the en-passant
target, the halfmove clock and repetition counts live on the game rather than on
the pieces, which keeps `applyMove` / `undoMove` cheap enough for the search to
reuse one board instead of cloning per node.

Positions load and save as **FEN** via `ChessGame.fromFen()` and `toFen()`.

---

## The bot

`getBotMove()` runs **iterative deepening negamax with alpha-beta pruning**,
ordering moves by MVV-LVA and killer moves, and extending captures with a
**quiescence search** so it never evaluates in the middle of a trade. Every
search has a time budget and can abort mid-iteration; only the deepest
*completed* iteration counts, so a partial search never yields a
half-considered move.

Evaluation is **tapered** between a midgame and an endgame reading of the
position, so the king shelters behind pawns while queens are on and walks to the
centre once they come off. On top of material and piece-square tables it scores
passed, doubled and isolated pawns, the bishop pair, rooks on open files, and
the pawn shield in front of a castled king.

### Difficulty

Strength comes from search depth. Weakness comes from an explicit **mistake
model** rather than randomising among near-equal moves, which reads as aimless
at every rating. A bot plays the best move it found most of the time and
occasionally takes its second or third choice.

Each profile also has a **mistake cap**: an alternative is only considered if it
is wrong by an amount that rating would plausibly overlook. A 1200 may drop a
pawn but will never miss a mate in one or hand over a queen.

| Level | Depth | Time | Errs | Worst slip |
| --- | --- | --- | --- | --- |
| 400 Novice | 1 | 0.15 s | 60% | 1000 cp |
| 800 Casual | 2 | 0.4 s | 35% | 400 cp |
| 1200 Club | 3 | 0.7 s | 22% | 180 cp |
| 1600 Strong | 4 | 1.1 s | 10% | 100 cp |
| 2000 Expert | 5 | 1.6 s | 4% | 50 cp |
| 2400 Master | 6 | 2.4 s | never | — |

Ordering is verified by self-play with alternating colours: 1200 scores at least
83% against 400, and 1600 at least 75% against 800. Separate tests pin the
tactical floor — every level finds a mate in one and takes a free queen on every
repetition, and never hangs its queen to a defended square.

These are self-play score shares, not calibrated Elo. The bot has never been
tested against rated human players.

---

## Interface

A midnight-and-brass theme. The board sits in a raised frame with the
coordinates on the frame rather than inside the squares, both players share one
strip above the board, and the moves and captures sit in a rail alongside.

- Brass move dots and capture rings on the selected piece.
- Separate shading for where the last move came from and went to.
- Check highlighting on the king.
- Clocks that measure real elapsed time, with a low-time warning.
- Captured pieces and running material advantage.
- Move list in algebraic notation.
- Promotion picker, board flip, resign, and a game-over dialog with rematch.

### Mobile

The board is sized from whichever dimension is scarce — portrait sizes it by
width, landscape keeps the rail alongside and sizes it by height. Heights use
`dvh` so the layout does not overflow behind a mobile address bar. Taps have no
grey flash and no double-tap zoom delay, form controls are 16px so iOS does not
zoom on focus, and controls meet the 44px touch target. On phones the action
buttons are ordered above the move list so they stay in thumb reach.

Verified at 320×568, 375×812, 360×740, 740×360 and 812×375, plus tablet and
desktop.

---

## Project structure

```
server/
  index.mjs            Online API, room store, clocks, static hosting
src/
  ChessGame.mjs        Rules engine, evaluation, search, FEN, perft
  App.js               Game loop, clocks, bot turns, promotion, game over
  ChessBoard.js        Board rendering, highlights, move hints
  GameModeSelector.js  Mode, difficulty and time-control picker
  OnlineLobby.js       Create and join screen
  onlineClient.js      API wrapper and long-poll sync hook
  App.css, index.css   Styling
  ChessGame.test.js    Perft and rules suite
  botStrength.test.js  Self-play strength ordering and tactical floor
render.yaml            Render blueprint
```

The engine is `.mjs` so plain Node treats it as an ES module and the server can
import it directly. Imports of it use the explicit extension so both webpack and
Jest resolve it.

---

## Testing

```bash
npm test
```

Covers 53 rules tests including all five perft positions, plus the bot's
tactical floor and self-play strength ordering.

The self-play tournament plays real games and takes a few minutes. For the fast
suites only:

```bash
npx react-scripts test --watchAll=false --testPathPattern=ChessGame
```

The online API has its own checks covering room lifecycle, move validation,
turn enforcement, token authentication, long-poll wake-up, clocks and
resignation.

---

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | Set automatically by Render; do not set it manually there |

Server constants are at the top of [`server/index.mjs`](server/index.mjs):
poll hold duration, room time-to-live, presence timeout and time-control bounds.

---

## Troubleshooting

**"Cannot reach the game server" when creating an online game.**
The API server is not running. Versus Engine and Pass & Play work without it,
but online play does not. Start it in a second terminal:

```bash
npm run server
```

Keep `npm start` running in the first terminal. The dev server forwards `/api`
to the game server on port 4000; everything else it serves itself.

If you would rather run one process, use `npm run serve`, which builds the app
and serves it and the API together on `http://localhost:4000` — the same
arrangement as production.

**An online game says it is no longer available.**
The room is gone, which happens if the server restarted or a free-tier instance
slept. Rooms are held in memory, so they do not survive either. Start a new game.

**The invite link opens the main menu instead of the game.**
The link needs the `?g=CODE` part intact. Copy it with the button rather than
retyping it, or use Join Game and enter the five-character code.

---

## Limitations

- **Rooms are in memory.** A server restart or sleep loses games in progress.
  Surviving that means adding Redis or Postgres.
- **No accounts, ratings or match history.**
- **No public matchmaking** — online play is invite-link only.
- **No draw offers or takebacks.** Resignation is the only way to end a game
  early.
- **The bot always promotes to a queen.** Underpromotion is generated for the
  player and counted in perft, but the search never chooses it.
- **Clocks have no increment.**
- On Render's free tier the first request after idling waits for the instance
  to wake.
