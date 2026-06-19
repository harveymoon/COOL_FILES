// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use axum::body::Body;
use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Path, Query, Request, State};
use axum::http::{header, HeaderMap, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;
use tauri::Emitter;
use tokio::sync::broadcast::error::RecvError;
use tokio::time::{interval, Duration};

use super::auth;
use super::types::{ApiState, GoBody, TokenQuery, APP_VERSION};

/// Event the frontend (`use-desk-deck-bridge.ts`) listens for. Kebab-case to
/// match the app's other Tauri events (`app-launch-args`, `dir-change`).
const COMMAND_EVENT: &str = "desk-deck-command";

const HEARTBEAT_SECS: u64 = 20;

pub(super) fn build_router(state: ApiState) -> Router {
    Router::new()
        .route("/api/status", get(status_handler))
        .route("/api/state", get(state_handler))
        .route("/api/nav/{verb}", post(nav_handler))
        .route("/api/layout/{mode}", post(layout_handler))
        .route("/api/toggle/hidden", post(toggle_hidden_handler))
        .route("/api/go", post(go_handler))
        .route("/api/mkdir", post(mkdir_handler))
        .route("/events", get(events_handler))
        .layer(middleware::from_fn(cors_middleware))
        .with_state(state)
}

pub(super) fn json_error(status: StatusCode, code: &str, message: &str) -> Response {
    (
        status,
        Json(json!({ "error": code, "message": message })),
    )
        .into_response()
}

fn no_content() -> Response {
    StatusCode::NO_CONTENT.into_response()
}

// --- CORS -----------------------------------------------------------------
// The Desk_Deck plugin makes server-to-server calls (no CORS needed), but a
// permissive policy costs nothing and makes ad-hoc debugging from a browser /
// the app's own webview trivial. Auth is the token, not the origin.

fn apply_cors(headers: &mut HeaderMap) {
    headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*".parse().unwrap());
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        "Authorization, Content-Type".parse().unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        "GET, POST, OPTIONS".parse().unwrap(),
    );
}

async fn cors_middleware(request: Request, next: Next) -> Response {
    if request.method() == Method::OPTIONS {
        let mut response = Response::new(Body::empty());
        *response.status_mut() = StatusCode::NO_CONTENT;
        apply_cors(response.headers_mut());
        return response;
    }

    let mut response = next.run(request).await;
    apply_cors(response.headers_mut());
    response
}

// --- Handlers -------------------------------------------------------------

/// First call the plugin makes; must be fast and never require auth.
async fn status_handler(State(state): State<ApiState>) -> Response {
    Json(json!({
        "ok": true,
        "version": APP_VERSION,
        "port": state.port,
        "features": ["nav", "layout", "places", "hidden", "mkdir", "events"],
    }))
    .into_response()
}

/// The whole panel in one read: current path, layout, selection, places.
async fn state_handler(State(state): State<ApiState>, headers: HeaderMap) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    let latest = state
        .latest
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_else(|_| json!({}));

    Json(latest).into_response()
}

/// Emit a command to the navigator frontend over the Tauri event bus.
fn emit_command(state: &ApiState, verb: &str, value: Option<serde_json::Value>) -> Response {
    let payload = match value {
        Some(value) => json!({ "verb": verb, "value": value }),
        None => json!({ "verb": verb }),
    };

    match state.app.emit(COMMAND_EVENT, payload) {
        Ok(()) => no_content(),
        Err(err) => json_error(
            StatusCode::INTERNAL_SERVER_ERROR,
            "emit_failed",
            &err.to_string(),
        ),
    }
}

async fn nav_handler(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(verb): Path<String>,
) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    match verb.as_str() {
        "back" | "forward" | "up" | "home" | "reload" => emit_command(&state, &verb, None),
        _ => json_error(StatusCode::BAD_REQUEST, "unknown_verb", "Unknown nav verb"),
    }
}

async fn layout_handler(
    State(state): State<ApiState>,
    headers: HeaderMap,
    Path(mode): Path<String>,
) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    match mode.as_str() {
        "list" | "grid" | "columns" => emit_command(&state, "layout", Some(json!(mode))),
        _ => json_error(StatusCode::BAD_REQUEST, "unknown_layout", "Unknown layout mode"),
    }
}

async fn toggle_hidden_handler(State(state): State<ApiState>, headers: HeaderMap) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    emit_command(&state, "toggleHidden", None)
}

async fn go_handler(State(state): State<ApiState>, headers: HeaderMap, body: String) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    match serde_json::from_str::<GoBody>(&body) {
        Ok(parsed) if !parsed.path.trim().is_empty() => {
            emit_command(&state, "go", Some(json!(parsed.path)))
        }
        _ => json_error(
            StatusCode::BAD_REQUEST,
            "invalid_body",
            "Expected JSON body { \"path\": \"...\" }",
        ),
    }
}

async fn mkdir_handler(State(state): State<ApiState>, headers: HeaderMap) -> Response {
    if let Err(response) = auth::check(&state, &headers, None) {
        return response;
    }

    emit_command(&state, "mkdir", None)
}

// --- WebSocket ------------------------------------------------------------

async fn events_handler(
    State(state): State<ApiState>,
    Query(query): Query<TokenQuery>,
    upgrade: WebSocketUpgrade,
) -> Response {
    if auth::check(&state, &HeaderMap::new(), query.t.as_deref()).is_err() {
        return json_error(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Invalid or missing token",
        );
    }

    upgrade.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: ApiState) {
    // Echo the full current state on connect so the plugin needs no warmup GET.
    let initial = {
        let latest = state
            .latest
            .lock()
            .map(|guard| guard.clone())
            .unwrap_or_else(|_| json!({}));
        json!({ "type": "state", "state": latest }).to_string()
    };

    if socket.send(Message::Text(initial.into())).await.is_err() {
        return;
    }

    let mut receiver = state.tx.subscribe();
    let mut heartbeat = interval(Duration::from_secs(HEARTBEAT_SECS));
    heartbeat.tick().await; // consume the immediate first tick

    loop {
        tokio::select! {
            message = receiver.recv() => {
                match message {
                    Ok(text) => {
                        if socket.send(Message::Text(text.into())).await.is_err() {
                            break;
                        }
                    }
                    Err(RecvError::Lagged(_)) => continue,
                    Err(RecvError::Closed) => break,
                }
            }
            _ = heartbeat.tick() => {
                let beat = json!({ "type": "heartbeat" }).to_string();
                if socket.send(Message::Text(beat.into())).await.is_err() {
                    break;
                }
            }
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {} // ignore client-sent frames
                    Some(Err(_)) => break,
                }
            }
        }
    }
}
