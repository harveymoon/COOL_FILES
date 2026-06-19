// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use std::net::SocketAddr;
use std::sync::{Arc, Mutex};

use base64::Engine;
use serde_json::json;
use tauri::{AppHandle, Manager};
use tokio::sync::broadcast;

use super::handlers::build_router;
use super::types::{ApiState, API_STATE, PORT_CANDIDATES, TOKEN_FILE};

fn generate_token() -> String {
    let mut bytes = [0u8; 32];
    getrandom::getrandom(&mut bytes).expect("failed to generate Desk_Deck API token");
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Load the per-install token from `%APPDATA%/com.cool-files.app/api_token.txt`,
/// generating and persisting one on first run.
fn load_or_create_token(app: &AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("Failed to resolve config dir: {err}"))?;
    std::fs::create_dir_all(&dir).map_err(|err| format!("Failed to create config dir: {err}"))?;

    let token_path = dir.join(TOKEN_FILE);

    if let Ok(existing) = std::fs::read_to_string(&token_path) {
        let trimmed = existing.trim().to_string();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }

    let token = generate_token();
    std::fs::write(&token_path, &token).map_err(|err| format!("Failed to write token: {err}"))?;
    Ok(token)
}

/// Spawn the local-only Desk_Deck API server. Failures are logged, not fatal —
/// the rest of the app works fine without the integration.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        if let Err(err) = run(app).await {
            log::warn!("[desk_deck] failed to start local API: {err}");
        }
    });
}

async fn run(app: AppHandle) -> Result<(), String> {
    let token = load_or_create_token(&app)?;
    let (tx, _rx) = broadcast::channel::<String>(64);
    let latest = Arc::new(Mutex::new(json!({
        "current": null,
        "currentName": null,
        "layout": null,
        "showHidden": false,
        "selectionCount": 0,
        "places": [],
    })));

    let mut bound = None;
    for port in PORT_CANDIDATES {
        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        if let Ok(listener) = tokio::net::TcpListener::bind(addr).await {
            bound = Some((listener, port));
            break;
        }
    }

    let (listener, port) = bound.ok_or_else(|| {
        format!(
            "no available port in {}-{}",
            PORT_CANDIDATES[0],
            PORT_CANDIDATES[PORT_CANDIDATES.len() - 1]
        )
    })?;

    let state = ApiState {
        token: Arc::new(token),
        port,
        latest,
        tx,
        app: app.clone(),
    };

    if let Ok(mut guard) = API_STATE.lock() {
        *guard = Some(state.clone());
    }

    let router = build_router(state);
    log::info!("[desk_deck] local API listening on http://127.0.0.1:{port}");

    axum::serve(listener, router)
        .await
        .map_err(|err| format!("server error: {err}"))?;

    Ok(())
}

/// Called by the navigator frontend whenever path / layout / selection / places
/// change. Caches the latest blob (served by `GET /api/state`) and fans it out
/// to WebSocket subscribers.
#[tauri::command]
pub fn desk_deck_publish_state(state: serde_json::Value) {
    let Ok(guard) = API_STATE.lock() else {
        return;
    };

    if let Some(api) = guard.as_ref() {
        if let Ok(mut latest) = api.latest.lock() {
            *latest = state.clone();
        }

        let envelope = json!({ "type": "state", "state": state }).to_string();
        let _ = api.tx.send(envelope);
    }
}
