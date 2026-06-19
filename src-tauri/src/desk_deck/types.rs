// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::sync::{Arc, Mutex};

use serde::Deserialize;
use tauri::AppHandle;
use tokio::sync::broadcast;

/// Ports tried in order; 7446 = "SIGM" on a phone keypad. Local-only bind.
pub(super) const PORT_CANDIDATES: [u16; 3] = [7446, 7447, 7448];
pub(super) const TOKEN_FILE: &str = "api_token.txt";
pub(super) const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

/// Shared, cloneable state handed to every axum handler and cached globally so
/// the `desk_deck_publish_state` Tauri command can push updates into it.
#[derive(Clone)]
pub(super) struct ApiState {
    pub(super) token: Arc<String>,
    pub(super) port: u16,
    pub(super) latest: Arc<Mutex<serde_json::Value>>,
    pub(super) tx: broadcast::Sender<String>,
    pub(super) app: AppHandle,
}

pub(super) static API_STATE: once_cell::sync::Lazy<Mutex<Option<ApiState>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(None));

#[derive(Deserialize)]
pub(super) struct GoBody {
    pub(super) path: String,
}

#[derive(Deserialize)]
pub(super) struct TokenQuery {
    pub(super) t: Option<String>,
}
