# BS Poker

Multiplayer BS Poker web app. Go backend, React (Vite + TypeScript) frontend.

## Backend

Requires Go 1.24+.

```
cd server
go mod download   # first time only
go run .
```

Listens on `http://localhost:8080`.

## Frontend

Requires Node.js.

```
cd client
npm install   # first time only
npm run dev
```

Vite serves on `http://localhost:5173` by default.

Start the backend first, then the frontend, and open the Vite URL in two browser tabs to play.
