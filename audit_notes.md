# Code Audit — Cool Files

Automated review 2026-06-10. Items for the dev to address when time permits.

Scope: local uncommitted changes only (everything modified since 2026-05-27 on top of the v2.1.1 tree) — the Desk_Deck local API (Rust + frontend bridge), the customizable navigator toolbar/sidebar, home-page groups/ordering, the columns layout, the Type column, lazy folder item-counts, info-panel resize, and the load-animations setting.

---

## 1. High — Toolbar widgets are deleted by drag and can never be re-added

**File:** `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue`, line 78 (`onToolbarDrop`)

```ts
const isToolbarItem = !!moved && (moved.kind === 'action' || moved.kind === 'separator');

if (addedIndex !== null && moved && isToolbarItem) {
  next.splice(addedIndex, 0, moved);
}
```

The guard that filters "foreign" drag payloads omits `kind === 'widget'`, but widgets are first-class toolbar items (`ToolbarItem` union in `src/types/user-settings.ts`) and the customize-sheet pool emits exactly `{ kind: 'widget', id }` payloads (`navigator-customize-sheet.vue`, `poolPayload`). Consequences:

- Reordering a widget within the toolbar in edit mode: the removal branch splices it out, the insert branch rejects it → the widget is silently and permanently deleted.
- Dragging a widget from the pool back onto the toolbar: insert is rejected → widgets can never be (re-)added. Once gone, Command Palette / Global Search / LAN Share / Status Center buttons are unrecoverable except via "Reset to default" in Settings → Navigator.

**Fix:** include widgets in the guard:
`const isToolbarItem = !!moved && (moved.kind === 'action' || moved.kind === 'separator' || moved.kind === 'widget');`

---

## 2. High — Settings migration 13→14 strips the four toolbar widgets for every upgrading user

**File:** `src/stores/schemas/user-settings.ts`, lines 360–389 (migration step `fromVersion === 13`)

The migration writes a `navigator.toolbar` default containing only the five action items (layoutList/Grid/Columns, splitView, infoPanel) — **without** the `commandPalette`, `globalSearch`, `lanShare`, `statusCenter` widget entries that the fresh-install default in `src/stores/storage/user-settings.ts` (lines ~126–166) includes.

At the same time, `src/modules/window-toolbar/window-toolbar.vue` was changed so those four buttons are no longer hardwired on the navigator route — they now come exclusively from `navigator.toolbar.items`. Net effect for every existing user upgrading from schema ≤13: the Command Palette, Global Search, LAN Share and Status Center buttons vanish from the navigator toolbar. Combined with issue 1, they cannot even be dragged back.

Note the migration is actively harmful: if it wrote nothing, `loadUserSettings()` would leave the (correct, widget-containing) in-memory default untouched.

**Fix:** append the widget items (and the separator) to the migrated default — `toolbar-widgets.ts` already exports `DEFAULT_TOOLBAR_WIDGET_IDS` for exactly this purpose but it is never used — or simply don't write `navigator.toolbar` in the migration at all and let the in-memory default apply.

---

## 3. Medium — Load-in animations are never applied at startup; the persisted setting has no effect

**Files:**
- `src/composables/use-load-animations.ts` (lines 30–46)
- `src/styles/stagger-animation.css` (line 7)
- `src/modules/settings/ui/categories/appearance/load-animations.vue` (only caller)

The stagger CSS was changed from always-on to gated on `[data-load-animations="on"]` on `<html>`. That attribute is only ever set by `applyToDocument()`, which is only reachable through `applyLoadAnimations()`, which is only called from the settings section component when the user moves a control (`persistAndApply`). Nothing applies the persisted `loadAnimations` setting during app initialization (`index.html` has no attribute; no call from the user-settings store `init()` or App bootstrap).

Result: even though the setting defaults to `enabled: true` and a 14→15 migration seeds it into storage, animations never play after an app restart — and `getLoadAnimationsStaggerStepMs()` always returns the hardcoded 48 ms rather than the saved value. The feature only works within the session in which the user touches the settings controls. This is also a silent regression of the pre-change behaviour where the stagger animation always played.

**Fix:** call `useLoadAnimations().applyLoadAnimations(userSettings.loadAnimations)` once settings are loaded (e.g. at the end of the user-settings store `init()`), so the document attribute, CSS duration variable, and module-level stagger step reflect the persisted values.

---

## 4. Medium — `mount_network_share` blocks an async runtime worker despite the "non-blocking" comment

**File:** `src-tauri/src/dir_reader/commands.rs`, lines 77–82

```rust
pub async fn mount_network_share(params: NetworkShareParams) -> Result<String, String> {
    // Runs `net use` (Windows) / `mount` (unix), which blocks until the host
    // responds. Async so an unreachable/slow host cannot freeze the UI thread.
    network_shares::mount_network_share(params)
}
```

Making the command `async` moves it off the main/UI thread, but the blocking `net use`/`mount` subprocess call then runs directly on a Tokio worker thread of the shared Tauri async runtime. An unreachable host can pin that worker for the full SMB timeout (tens of seconds); a few concurrent slow mounts can starve the runtime that also services the Desk_Deck HTTP/WS server, LAN share, and every other async command. The `read_dir` command three functions above does this correctly.

**Fix:** mirror the `read_dir` pattern:
```rust
tauri::async_runtime::spawn_blocking(move || network_shares::mount_network_share(params))
    .await
    .map_err(|e| format!("Failed to mount share: {e}"))?
```

---

## 5. Low — Desk_Deck API token compared with non-constant-time equality

**File:** `src-tauri/src/desk_deck/auth.rs`, line 27

`token == *state.token` is a short-circuiting string comparison, so response timing leaks how many leading bytes of a guessed token are correct. The server is bound to 127.0.0.1 and the token has 256 bits of entropy, so practical risk is low, but the standard hardening is cheap.

**Fix:** use a constant-time comparison (e.g. the `subtle` crate's `ConstantTimeEq` over the byte slices, or compare SHA-256 digests of both values).

---

## 6. Low — Permissive CORS plus unauthenticated `/api/status` lets any web page probe the app

**File:** `src-tauri/src/desk_deck/handlers.rs`, lines 56–94 (`apply_cors`, `status_handler`)

`Access-Control-Allow-Origin: *` is applied to every response, and `/api/status` requires no auth and returns the app version and port. Any website open in the user's browser can therefore fire `fetch('http://127.0.0.1:7446/api/status')` and learn that Cool Files is running (fingerprinting / targeting), and can mount in-browser token-guessing attempts against the authed endpoints. The code comment itself notes the plugin makes server-to-server calls and needs no CORS.

**Fix:** drop the CORS layer (or restrict it to a known origin) and minimize `/api/status` (e.g. `{ "ok": true }` only) since it must stay unauthenticated.

---

## 7. Low — Reordering sidebar drives in edit mode silently pins every connected drive

**File:** `src/modules/nav-sidebar/nav-sidebar.vue`, lines 276–295 (`onDrivesDrop`)

The edit list (`editDrives`) contains pinned items *plus all unpinned discovered drives*, and a drop persists the entire list as `pinnedPaths`. So a single drag to reorder one drive converts every currently-connected drive (including transient USB sticks and network mounts) into a permanent pin. When such a drive is later disconnected, `resolvePinnedItem` renders it as a generic "folder shortcut" pointing at a now-nonexistent root (e.g. `D:/`), which lingers until manually unpinned and navigates to an error if clicked.

**Fix:** persist only the drives that were already pinned (plus the moved one if the user dragged an unpinned drive), e.g. filter `order` against the previous pinned set plus `moved`, instead of saving the full edit-list order.
