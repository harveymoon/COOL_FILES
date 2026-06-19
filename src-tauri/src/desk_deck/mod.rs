// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! Desk_Deck integration: a small, local-only HTTP/WS API on 127.0.0.1 that lets
//! a Desk_Deck wrapper plugin drive the navigator (back/forward/home/reload,
//! layout, jump-to-place) and observe its state. See `DESK_DECK_INTEGRATION.md`.

mod auth;
mod handlers;
mod server;
mod types;

// Glob re-export so the `#[tauri::command]` macro's hidden helper item is carried
// through to `generate_handler!` (a named re-export drops it).
pub use server::*;
