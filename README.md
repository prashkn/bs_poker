# BS Poker

Multiplayer BS Poker web app. Go backend, React (Vite + TypeScript) frontend.

## Backend

Requires Go 1.24+.

```
cd server
go mod download
go run .
```

Listens on `http://localhost:8080`.

## Frontend

Requires Node.js.

```
cd client
npm install
npm run dev
```

Vite serves on `http://localhost:5173` by default.

Start the backend first, then the frontend, and open the Vite URL in two browser tabs to play.

## Architecture

See [WRITEUP.md](./WRITEUP.md) to understand what decisions were made and why — WebSocket pub/sub, event dispatch, FSM game flow, reconnection handling, and more.
