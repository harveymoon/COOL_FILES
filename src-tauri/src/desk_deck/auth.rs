// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;

use super::handlers::json_error;
use super::types::ApiState;

/// Accept the token via `Authorization: Bearer <token>` or a `?t=<token>` query
/// param (the latter is needed for the WebSocket, which can't set headers).
/// Everything except `/api/status` gates on this.
pub(super) fn check(
    state: &ApiState,
    headers: &HeaderMap,
    query_token: Option<&str>,
) -> Result<(), Response> {
    let provided = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .map(str::to_string)
        .or_else(|| query_token.map(str::to_string));

    match provided {
        Some(token) if token == *state.token => Ok(()),
        _ => Err(json_error(
            StatusCode::UNAUTHORIZED,
            "unauthorized",
            "Invalid or missing token",
        )),
    }
}
