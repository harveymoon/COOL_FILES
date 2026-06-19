# Cool Files — Desk_Deck integration plan

This document is the **outside half** of a Desk_Deck integration (see
`C:/CODE/Desk_Deck/INTEGRATING_YOUR_APP.md`). It specifies the small, local-only
API surface Sigma should expose so that a thin Desk_Deck wrapper plugin
(`server/providers/sigma.py`, ~150 lines) can push a file-manager remote to a
Pixel tablet.

> Status: **implemented and verified** on the Sigma side (Rust module
> `src-tauri/src/desk_deck/` + frontend bridge `src/composables/use-desk-deck-bridge.ts`).
> All endpoints below were tested end-to-end with curl/Node: `/api/status`,
> 401 gating, authed `/api/state`, `POST` commands driving the live navigator,
> and `WS /events` pushing state on change. The Desk_Deck-side wrapper plugin
> (out of scope for this repo) is the remaining piece.

---

## Why this is cheap to build

Sigma already runs the exact stack a Desk_Deck surface needs:

- **`axum` 0.8 + `axum-server` + `tokio` + `rustls`** are already dependencies
  (`src-tauri/Cargo.toml`), and the **`src-tauri/src/lan_share/` module is a
  complete, working axum server** (router, handlers, TLS, lifecycle in
  `commands.rs` / `server.rs` / `handlers.rs`). The Desk_Deck server is a second,
  smaller router built the same way.
- The frontend is **already driven from Rust via Tauri events** — `lib.rs`
  emits `app-launch-args` and the Vue side listens. We reuse that exact pattern
  as the inbound command bridge.
- The navigation actions the tablet needs **already exist** as composable
  methods on the file browser (`goBack`, `goForward`, `navigateToParent`,
  `navigateToHome`, `refresh`, `navigateToPath`, layout setter,
  `toggleHiddenFiles`, `openNewItemDialog`). The bridge just calls them.

So the integration is: **one new Rust module + one new Vue composable + one new
Tauri command.** No new navigation logic, no new server infrastructure.

---

## Transport choice

**HTTP + WebSocket, file-on-disk token** — the `cool_browser` shape.

File-manager state is mostly *project state* (slow, structured: current path,
layout mode, drive list, pinned paths) → serve over **HTTP GET**. The only thing
that changes is the current path / selection, and that is **event-driven, not
high-rate**, so a single **WS push** channel is enough — no polling tax, no
socket flooding. Commands are one-shot → **HTTP POST**.

---

## The one screen the tablet renders

Designed so the whole panel is a single `GET /api/state`:

```
┌─────────────────────────────────────────────┐
│  C:\Users\Harvey\Documents      (3 selected) │   ← header from state.current + state.selectionCount
├─────────────────────────────────────────────┤
│  [◀ back] [▶ fwd] [▲ up] [⌂ home] [⟳ reload] │   ← POST /api/nav/<verb>
│  [≣ list] [▦ grid] [▥ columns]   [• hidden]  │   ← POST /api/layout/<mode>, POST /api/toggle/hidden
├─────────────────────────────────────────────┤
│  Pinned & drives (tap to jump):              │   ← state.places[], POST /api/go {path}
│   📌 Projects   C:\CODE                       │
│   💽 C:\        💽 D:\        🌐 \\moonnas      │
└─────────────────────────────────────────────┘
```

---

## API contract

Base URL: `http://127.0.0.1:7446` — **bound to `127.0.0.1` only** (never
`0.0.0.0`; lan_share is the LAN-facing piece, this is not). Port `7446` = "SIGM"
on a phone keypad; hardcoded, not advertised via mDNS.

Auth: `Authorization: Bearer <token>` **or** `?t=<token>` (needed for WS).
Token at `%APPDATA%\com.cool-files.app\api_token.txt`, generated on
first run (32-byte URL-safe random). **`/api/status` skips auth**; everything
else returns `401` on a bad token. CORS: `Access-Control-Allow-Origin: *`,
`Access-Control-Allow-Headers: Authorization, Content-Type`.

### `GET /api/status` — availability (no auth, must be ~1ms)
```json
{ "ok": true, "version": "2.1.1",
  "features": ["nav", "layout", "places", "hidden", "mkdir", "events"] }
```

### `GET /api/state` — the whole panel in one read
```json
{
  "current": "C:\\Users\\Harvey\\Documents",
  "currentName": "Documents",
  "layout": "list",
  "showHidden": false,
  "selectionCount": 3,
  "canGoBack": true,
  "canGoForward": false,
  "places": [
    { "id": "pin:0", "name": "Projects", "path": "C:\\CODE", "kind": "pin" },
    { "id": "drive:C", "name": "C:\\", "path": "C:\\", "kind": "drive" },
    { "id": "drive:net0", "name": "moonnas", "path": "\\\\moonnas", "kind": "network" }
  ]
}
```
`places` is the union of the user's sidebar `pinnedPaths` and (if
`autoShowDrives`) discovered drives — i.e. exactly the bottom-left sidebar pane.

### Commands (POST, empty body unless noted)
| Endpoint                      | Effect                                   | Returns |
|-------------------------------|------------------------------------------|---------|
| `POST /api/nav/back`          | history back                             | `204`   |
| `POST /api/nav/forward`       | history forward                          | `204`   |
| `POST /api/nav/up`            | parent directory                         | `204`   |
| `POST /api/nav/home`          | home page                                | `204`   |
| `POST /api/nav/reload`        | refresh current dir                      | `204`   |
| `POST /api/layout/list`       | layout = list                            | `204`   |
| `POST /api/layout/grid`       | layout = grid                            | `204`   |
| `POST /api/layout/columns`    | layout = columns                         | `204`   |
| `POST /api/toggle/hidden`     | toggle show-hidden                       | `204`   |
| `POST /api/go`                | body `{ "path": "C:\\CODE" }` → navigate | `204`   |
| `POST /api/mkdir`             | open new-folder dialog in current dir    | `204`   |

Errors are always JSON: `{ "error": "stable_code", "message": "..." }`.
`503` = "API up but no navigator window focused yet" (treat as feature
unavailable, not a crash). `401` = bad token (plugin re-reads token file).

### `WS /events` — state push
Connect with `ws://127.0.0.1:7446/events?t=<token>`. On connect, Sigma echoes the
**full current state** so the plugin needs no warmup GET. Thereafter it pushes a
JSON envelope whenever path / layout / selection / places change, plus a
heartbeat every 20s:
```json
{ "type": "state",     "state": { ...same shape as GET /api/state... } }
{ "type": "heartbeat", "t": 1730000000 }
```

---

## Internal wiring (Sigma side)

```
 Tablet ⇄ Desk_Deck server ⇄ HTTP/WS ⇄  desk_deck axum router (Rust, 127.0.0.1:7446)
                                              │  emit "desk-deck-command"    ▲ desk_deck_publish_state(...)
                                              ▼                               │
                                    use-desk-deck-bridge.ts  ⇄  navigator composables / store
```

1. **New Rust module `src-tauri/src/desk_deck/`** (mirror `lan_share/`):
   `mod.rs`, `server.rs` (bind `127.0.0.1:7446`, token gen/load), `handlers.rs`
   (the routes above), `state.rs` (`Mutex<LatestState>` cache + WS broadcast
   `tokio::sync::broadcast`), `auth.rs` (bearer/`?t=` check).
   - Inbound: each command handler validates the token, then
     `app.emit("desk-deck-command", { verb, value })` and returns `204`.
   - Outbound: `GET /api/state` returns the cached blob; WS subscribers receive
     every new blob.
   - Register `desk_deck::start`/`desk_deck::stop` and the
     `desk_deck_publish_state` command in `lib.rs` alongside the existing
     `lan_share::*` handlers; start the server from `setup_handler`.

2. **New Vue composable `src/composables/use-desk-deck-bridge.ts`:**
   - `listen('desk-deck-command', ...)` → switch on `verb`, call the matching
     existing file-browser method (`goBack` / `goForward` / `navigateToParent` /
     `navigateToHome` / `refresh` / `navigateToPath(payload.path)` / set layout /
     `toggleHiddenFiles` / `openNewItemDialog`).
   - `watch` current path + layout + selection + sidebar places →
     `invoke('desk_deck_publish_state', { state })` (debounced). Mounted once,
     near the navigator root.

3. **One new Tauri command `desk_deck_publish_state(state)`** — writes the blob
   into the `Mutex` cache and broadcasts to WS subscribers.

No schema migration, no settings change is *required*; an optional
`integrations.deskDeck.enabled` user setting can gate `desk_deck::start` if the
user wants to keep the port closed.

---

## Lifecycle

- **Bind on app start** (local, cheap), keep the port stable, do **not** advertise
  via mDNS — the plugin hardcodes `7446`.
- **Survive reconnects** on both HTTP and WS; the tablet/plugin disconnect and
  reconnect freely (Desk_Deck restarts, tablet sleep). The broadcast channel and
  state cache make reconnect free — newest subscriber just gets the cached blob.
- **Never auto-launch.** Desk_Deck binds Sigma only if it's already running.
- Stop the router on main-window `Destroyed` (same place `lan_share::stop` is
  already called in `lib.rs`).

---

## End-to-end test before writing the plugin

```bash
# Status (no auth)
curl http://127.0.0.1:7446/api/status

TOKEN=$(cat "$APPDATA/com.cool-files.app/api_token.txt")

# One-read panel
curl -H "Authorization: Bearer $TOKEN" http://127.0.0.1:7446/api/state

# Commands
curl -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:7446/api/nav/up
curl -X POST -H "Authorization: Bearer $TOKEN" http://127.0.0.1:7446/api/layout/columns
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
     -d '{"path":"C:\\CODE"}' http://127.0.0.1:7446/api/go

# Live state
websocat "ws://127.0.0.1:7446/events?t=$TOKEN"
```

If those four work, the Desk_Deck plugin will work.

---

## Desk_Deck-side deliverables (out of scope for this repo)

For reference, the wrapper plugin that consumes this API lives in the Desk_Deck
repo, not here:

- `server/providers/sigma.py` — register actions (`sigma_nav_back`,
  `sigma_layout`, `sigma_go`, …), proxy `/api/sigma/...` for the tablet,
  subscribe to `/events`, push widget updates.
- `web/shared/widgets-sigma.js` — at most one custom widget (the places list);
  nav + layout buttons use generic button widgets.
- `configs/sigma.yaml` — layout that binds when `Cool Files.exe` is
  focused on Windows.

---

## Open decisions (confirm before implementing)

1. **Always-on vs. opt-in port.** Recommend always-on local bind, with an
   optional `integrations.deskDeck.enabled` settings toggle to disable.
2. **Which window's state wins** when split-view has two panes — recommend "the
   focused pane" (Sigma already tracks active pane); `state.current` follows it.
3. **Port collision fallback.** lan_share already has a port-probe pattern
   (`network.rs`); reuse it to fall back to `7447`/`7448` and report the chosen
   port in `/api/status` if `7446` is taken.
</content>
</invoke>
