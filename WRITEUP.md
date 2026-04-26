# BS Poker — Architecture & Engineering Write-Up

Building this thing the right way was actually harder than I thought! So below is a tour of the non-obvious patterns in this repo. Focused on *why* I'm doing things a particular way.

---

## 1. Transport Split: REST for Lifecycle, WebSocket for Realtime

We deliberately separate two traffic patterns onto two transports:

- **REST** (`POST /api/rooms`, `POST /api/rooms/{id}/join`, `GET /api/rooms/{id}`) handles *room lifecycle* — create, join, existence check. These are request/response, idempotent-ish, and benefit from standard HTTP status codes (404 room not found, 401 bad password, etc.).
- **WebSocket** (`GET /ws/{roomID}?player_id=...`) handles *realtime gameplay and chat* — turns, claims, BS calls, chat broadcasts.

The client hits REST first to obtain a `player_id`, persists it in `sessionStorage`, then opens a WS connection keyed on `(roomID, playerID)`. This keeps the WS handshake stateless (no "create room" commands over WS) and avoids inventing an ad-hoc request/reply layer on top of WebSocket frames.

---

## 2. Message Envelope + Event Dispatch Pattern

Every WS frame is a JSON envelope with a constant shape:

```json
{ "event": "<event_name>", "payload": { ... } }
```

### Server-side routing

On the server, parsing is split from dispatch (`server/game/messages.go`, `server/handler_ws_events.go`):

1. `ParseMessage` decodes into a `RawMessage{ Event, Payload json.RawMessage }`. The payload stays as raw bytes — we don't decode until we know which handler owns it.
2. `dispatchEvent` looks up the event in a `map[MessageEvent]eventHandler` registry.
3. The handler unmarshals the payload into its own typed struct (`chatPayload`, etc.) and executes.

This is the classic **handler registry / command dispatcher** pattern. Adding a new event is one map entry plus one handler function — no switch statement to grow, no parsing logic to duplicate. The `json.RawMessage` delay-decode also means a malformed payload only blows up the handler that cares, not the whole read loop.

### Client-side routing

The client mirrors this: a single `ws.onmessage` entry point parses the envelope, then re-emits on a **typed pub/sub emitter** (`TypedEmitter<ServerEventMap>` in `client/src/hooks/useWebSocket.ts`). Components subscribe to only the events they care about.

---

## 3. Splitting the WS Firehose: Typed Pub/Sub + Reducer Fan-Out

The WebSocket is a single firehose carrying ~15 distinct server events. We split it in two layers:

### Layer A — `TypedEmitter` (pub/sub)

A lightweight, type-parameterized event emitter. `emitter.on("chat_received", handler)` is fully type-checked against `ServerEventMap`, so the payload type is inferred from the event name. This is effectively a **tagged-union dispatcher** on the client: one socket in, N independently-subscribed streams out.

### Layer B — `useGameState` reducer

Game-state events (`game_started`, `turn`, `claim_made`, `bs_result`, etc.) are fanned into a single `useReducer` store. Ephemeral events like `chat_received` bypass the reducer entirely and are consumed directly by the `Chat` component. We deliberately don't force chat through the game store because it has different lifetime, ordering, and persistence semantics — mixing them would bloat the reducer's state surface for no reason.

The `HANDLED_EVENTS` tuple is declared `as const satisfies readonly ServerEvent[]`, which gives us a compile-time guarantee that every event the reducer claims to handle actually exists in the server contract. The `default` branch asserts `_exhaustive: never`, so adding a new handled event without a case is a type error.

---

## 4. Single Source of Truth for the Wire Contract

`client/src/types.ts` defines `ServerEventMap` and `ClientEventMap` as TypeScript maps from event name → payload shape. This is the **discriminated union / sum type** pattern applied to a wire protocol:

- `SendFn` is generic over `K extends ClientEvent`, so `send("claim", { made_hand })` is type-checked against the server's expected payload.
- `useServerEvent<K>(event, handler)` types the handler's payload automatically.

The server-side equivalent is the `MessageEvent` string-enum in `server/game/messages.go` plus constructor functions (`NewChatReceivedMessage`, `NewPlayerJoinedMessage`, ...) that centralize serialization. Any wire-level change lands in exactly two places (one per language) and ripples through the type system.

---

## 5. WebSocket Concurrency: Read/Write Pumps

Each WS connection runs two goroutines (`server/handler_socket_room.go`):

- **`readPump`** — blocks on `conn.ReadMessage()`, parses, and calls `dispatchEvent`. Runs on the original HTTP handler goroutine (blocking) so the HTTP request lifecycle owns connection teardown.
- **`writePump`** — drains a per-connection `sendCh chan []byte` and writes frames. Decouples producers (any handler broadcasting to this player) from the actual socket write, which could be slow.

Broadcasts use a **non-blocking select send**:

```go
select {
case player.SendCh <- msg:
default:
    log.Printf("send channel full for player %s, dropping message", player.ID)
}
```

A slow or stuck client cannot back-pressure the broadcaster — the message is dropped with a warning rather than wedging the room. `SendCh` is buffered at 256 to absorb normal bursts.

---

## 6. Graceful Connection Swap (Reconnection)

The trickiest piece of concurrency in the codebase. When a player reconnects with the same `player_id`:

1. Under `player.Mu`, we snapshot the old `*websocket.Conn` and then `oldConn.Close()`. This causes the old `readPump`'s blocking `ReadMessage` to return with an error, so it exits cleanly via its own `defer`.
2. We install a **fresh** `sendCh` and `done` channel, and a new `conn`, under the same lock.
3. The new pumps are passed these fresh channels **as parameters** — they do not read `player.SendCh` from the struct. This means an old pump's defer can't close or send on the new channels even if it's still winding down.
4. `handlePlayerDisconnect` only nils `player.Conn` and broadcasts `player_left` **if `player.Conn` still points at the connection that is shutting down**. If a newer connection has already swapped in, the stale disconnect is silent. This prevents a phantom "X left" broadcast when the user only blipped.

This is a minimal implementation of **connection handoff** / **zombie-pump avoidance** — each pump owns its own state via closure, and identity is checked before cleanup mutates shared state.

---

## 7. Finite State Machine for Game Flow

`server/game/state.go` models the game as an explicit **FSM with a transition graph**:

```
NewRound -> Claim -> Claim -> ... -> BSCall -> BSResult -> RoundEnd -> NewRound
                                                                    -> GameOver
```

The graph is a `map[Transition][]edge` where each edge is `{From, To}`. `MoveTo` only fires if the current state matches an allowed `From`. This gives us:

- **Impossible states are unrepresentable at runtime** — you can't `BSResult` from `NewRound` because no such edge exists.
- **Self-documenting protocol** — reading the graph tells you the whole game loop.
- **Cheap test surface** (`state_test.go`) — happy path and game-over path are each a linear walk.

The service layer (`MakeClaim`, `CallBS`) guards every mutation with `sm.CanMoveTo(...)` → returns `ErrWrongState` on misuse. The client cannot drive the server into an inconsistent state by firing events out of order.

---

## 8. Service Layer + Interface-Driven Dependency Injection

`server/service/room_registry_service.go` defines `RoomRegistryService` as a Go interface, with a private struct implementation. Handlers receive the interface, not the concrete type:

```go
mux.HandleFunc("POST /api/rooms", handleCreateRoom(server.roomRegistryService))
```

This gives us:

- **Testability** — handlers can be exercised with a mock registry.
- **Encapsulation** — callers never reach into the rooms map directly; all access goes through mutex-guarded methods.
- **No God struct** — the `server` struct in `server.go` is a two-field composition root, not a tangle of globals.

Package-level mutex guards the registry map; per-room `Mu` guards room internals. This is a conventional **two-level locking** strategy (coarse at the lookup, fine at the room), which keeps room operations from serializing on a global lock.

---

## 9. Background Reaper for Empty Rooms

`main.go` spawns `server.roomRegistryService.CleanupEmptyRooms(30 * time.Minute)` on startup. Inside, a `time.Ticker` fires every interval and sweeps rooms older than 24h with zero players. This is the standard **janitor / reaper goroutine** pattern — keeps memory bounded without needing a DB TTL.

---

## 10. Error Handling Conventions

- **Sentinel errors** (`ErrRoomNotFound`, `ErrNotHost`, `ErrClaimNotStronger`, ...) live alongside the service that produces them. Callers compare with `errors.Is`-friendly equality and translate to either HTTP status codes or WS `error_message` events.
- **Panic recovery** at the WS handler boundary (`defer recover()` in `handleWebSocket`) — a panic in a handler logs and dies on that connection without killing the process.
- **Defensive broadcast** — `broadcastToRoom` skips players with `nil` conn (disconnected but still in the room) rather than crashing.
- **Unknown events are logged, not fatal** — `dispatchEvent` logs a warning and drops the frame. Forward compatibility: a newer client firing an event the server doesn't know yet won't sever the connection.

---

## 11. Client State & Hook Architecture

### Context-based composition root

`RoomProvider` is the single place that instantiates the WS connection (`useWebSocket`) and the game reducer (`useGameState`), then exposes them through `RoomContext`. Downstream hooks (`useRoom`, `usePlayers`, `useChat`, `useGame`) are thin **facade views** over the context — each exposes only the slice its consumers need.

This is the React equivalent of the server's interface-driven DI: the provider is the composition root, and components depend on narrow hook contracts rather than the full context value. Swapping `useWebSocket` for a mock in tests is one-line.

### Handler ref pattern in `useServerEvent`

```ts
const ref = useRef(handler);
ref.current = handler;
useEffect(() => emitter.on(event, (p) => ref.current(p)), [event, emitter]);
```

The subscription is registered once; the handler can close over fresh component state without re-subscribing each render. This is the idiomatic way to bridge **stable subscriptions** with **fresh closures**, avoiding both stale-closure bugs and subscription churn.

### Server-authoritative state + local echo

The server owns the game state. The client's reducer is a projection. One exception: the user's own chat messages are echoed locally on submit (`Chat.tsx`) because the server's `chat_received` broadcast excludes the sender — a deliberate **latency-hiding echo** for the one channel where stale ordering doesn't matter.

---

## 12. React Query for REST, not WS

REST endpoints are wrapped in `@tanstack/react-query` hooks (`useCreateRoom`, `useJoinRoom`, `useGetRoom`). This is a conscious split:

- **REST calls** — managed by React Query, gets caching, retries (disabled here with `retry: false`), request status.
- **WS stream** — managed by the custom emitter/reducer. React Query is ill-suited for push-based infinite streams.

Room existence is verified with `useGetRoom` on page load; a 404 triggers a redirect home and clears the stale `player_id` from `sessionStorage`, preventing redirect loops.

---

## 13. Summary of the Patterns at a Glance

| Pattern | Where | Purpose |
|---|---|---|
| REST + WS split | `main.go`, `useWebSocket.ts` | Right transport per traffic pattern |
| Message envelope + delay-decoded payload | `game/messages.go` | Cheap, extensible routing |
| Handler registry | `handler_ws_events.go` | Add events without switch growth |
| Typed pub/sub emitter | `useWebSocket.ts` | Split WS firehose into per-event streams |
| Exhaustive reducer over tagged union | `useGameState.ts` | Compile-time safety on event handling |
| Read/write pumps + non-blocking send | `handler_socket_room.go` | Slow client can't back-pressure broadcaster |
| Connection swap with per-pump channels | `handler_socket_room.go` | Clean reconnection without zombie pumps |
| Explicit FSM with edge graph | `game/state.go` | Invalid transitions rejected centrally |
| Interface-driven service layer | `service/*.go` | Testable, encapsulated state access |
| Two-level locking (registry + room) | `service/room_registry_service.go` | Coarse lookup, fine mutation |
| Reaper goroutine | `main.go`, `CleanupEmptyRooms` | Bounded memory, no DB needed |
| Sentinel errors + panic recovery | service packages, WS handler | Typed errors in, resilient process out |
| Context facade hooks | `hooks/useRoom.tsx` | Narrow consumer contracts over shared state |
| React Query for REST only | `api/room.ts` | Right tool per comms pattern |
