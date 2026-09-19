// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Builds a depth-bounded, size-weighted nested tree of a directory for the
// navigator's sunburst "Map" view. Sizes are always accurate (the whole subtree
// is walked); only the number of emitted rings is bounded by `max_depth`, and
// each directory keeps its largest children while the rest are bucketed into a
// single "N smaller items" node so the payload stays small on huge folders.

use std::fs;
use std::path::Path;

use serde::Serialize;
use walkdir::WalkDir;

const DEFAULT_MAX_DEPTH: u32 = 8;
const CHILDREN_CAP: usize = 80;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SizeNode {
    name: String,
    path: String,
    size: u64,
    is_dir: bool,
    /// Total number of direct children (before capping), so the UI can show
    /// how many items were bucketed into the "N smaller items" node.
    child_count: u64,
    children: Vec<SizeNode>,
}

fn normalize(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn basename(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| normalize(path))
}

/// Sum every file byte under `path` without building any nodes. Used for
/// directories at the frontier depth, whose size we still want to be accurate.
fn fast_total(path: &Path) -> u64 {
    let mut total = 0u64;

    for entry in WalkDir::new(path)
        .min_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_file() {
                total += metadata.len();
            }
        }
    }

    total
}

fn build(path: &Path, depth: u32, max_depth: u32) -> SizeNode {
    // Frontier directory: report an accurate size but emit no children.
    if depth >= max_depth {
        return SizeNode {
            name: basename(path),
            path: normalize(path),
            size: fast_total(path),
            is_dir: true,
            child_count: 0,
            children: Vec::new(),
        };
    }

    let mut children: Vec<SizeNode> = Vec::new();
    let mut total = 0u64;
    let mut child_count = 0u64;

    if let Ok(read_dir) = fs::read_dir(path) {
        for entry in read_dir.flatten() {
            let child_path = entry.path();
            let metadata = match entry.metadata() {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };

            // Don't follow symlinks (avoids cycles); show them as zero-size leaves.
            if metadata.file_type().is_symlink() {
                child_count += 1;
                children.push(SizeNode {
                    name: basename(&child_path),
                    path: normalize(&child_path),
                    size: 0,
                    is_dir: metadata.is_dir(),
                    child_count: 0,
                    children: Vec::new(),
                });
                continue;
            }

            if metadata.is_dir() {
                let node = build(&child_path, depth + 1, max_depth);
                total += node.size;
                child_count += 1;
                children.push(node);
            }
            else if metadata.is_file() {
                let size = metadata.len();
                total += size;
                child_count += 1;
                children.push(SizeNode {
                    name: basename(&child_path),
                    path: normalize(&child_path),
                    size,
                    is_dir: false,
                    child_count: 0,
                    children: Vec::new(),
                });
            }
        }
    }

    children.sort_by(|a, b| b.size.cmp(&a.size));

    if children.len() > CHILDREN_CAP {
        let rest = children.split_off(CHILDREN_CAP);
        let rest_size: u64 = rest.iter().map(|node| node.size).sum();
        let rest_count = rest.len() as u64;
        children.push(SizeNode {
            name: format!("{rest_count} smaller items"),
            path: String::new(),
            size: rest_size,
            is_dir: false,
            child_count: rest_count,
            children: Vec::new(),
        });
    }

    SizeNode {
        name: basename(path),
        path: normalize(path),
        size: total,
        is_dir: true,
        child_count,
        children,
    }
}

#[tauri::command]
pub async fn get_dir_size_tree(path: String, max_depth: Option<u32>) -> Result<SizeNode, String> {
    let max_depth = max_depth.unwrap_or(DEFAULT_MAX_DEPTH).clamp(1, 16);
    let path_buf = std::path::PathBuf::from(&path);

    if !path_buf.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    tokio::task::spawn_blocking(move || build(&path_buf, 0, max_depth))
        .await
        .map_err(|error| format!("Failed to scan directory: {error}"))
}
