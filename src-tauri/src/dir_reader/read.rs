// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use super::blocking_timeout::{with_blocking_timeout, BlockingTimeoutError};
use crate::utils::{
    is_hidden_path, metadata_times_unix_ms, normalize_path, path_extension_lowercase,
};
use std::fs;
use std::path::Path;

use super::types::{DirContents, DirEntry, DirItemCount, OpenedDirectoryTimes};

fn get_mime_type(extension: &Option<String>) -> Option<String> {
    extension.as_ref().map(|ext| {
        match ext.as_str() {
            "txt" | "text" => "text/plain",
            "html" | "htm" => "text/html",
            "css" => "text/css",
            "js" | "mjs" => "text/javascript",
            "json" => "application/json",
            "xml" => "application/xml",
            "pdf" => "application/pdf",
            "zip" => "application/zip",
            "tar" => "application/x-tar",
            "gz" | "gzip" => "application/gzip",
            "rar" => "application/vnd.rar",
            "7z" => "application/x-7z-compressed",
            "png" => "image/png",
            "jpg" | "jpeg" => "image/jpeg",
            "gif" => "image/gif",
            "webp" => "image/webp",
            "svg" => "image/svg+xml",
            "ico" => "image/x-icon",
            "mp3" => "audio/mpeg",
            "wav" => "audio/wav",
            "ogg" => "audio/ogg",
            "flac" => "audio/flac",
            "mp4" => "video/mp4",
            "webm" => "video/webm",
            "avi" => "video/x-msvideo",
            "mkv" => "video/x-matroska",
            "mov" => "video/quicktime",
            "doc" => "application/msword",
            "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "xls" => "application/vnd.ms-excel",
            "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt" => "application/vnd.ms-powerpoint",
            "pptx" => "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "rs" => "text/x-rust",
            "ts" | "tsx" => "text/typescript",
            "vue" => "text/x-vue",
            "py" => "text/x-python",
            "rb" => "text/x-ruby",
            "go" => "text/x-go",
            "java" => "text/x-java",
            "c" | "h" => "text/x-c",
            "cpp" | "hpp" | "cc" => "text/x-c++",
            "md" | "markdown" => "text/markdown",
            "yaml" | "yml" => "text/yaml",
            "toml" => "text/x-toml",
            "exe" => "application/x-msdownload",
            "dll" => "application/x-msdownload",
            "so" => "application/x-sharedlib",
            _ => "application/octet-stream",
        }
        .to_string()
    })
}

#[cfg(windows)]
pub(super) fn windows_system_drive_root() -> String {
    let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
    let trimmed_system_drive = system_drive.trim_end_matches('\\').trim_end_matches('/');
    normalize_path(&format!("{trimmed_system_drive}\\")).to_lowercase()
}

#[cfg(windows)]
pub(super) fn is_blacklisted_windows_system_path(path: &Path) -> bool {
    let parent_path = path
        .parent()
        .and_then(|parent| parent.to_str())
        .map(normalize_path)
        .map(|normalized_path| normalized_path.to_lowercase());

    if parent_path.as_deref() != Some(windows_system_drive_root().as_str()) {
        return false;
    }

    let entry_name = match path.file_name().and_then(|name| name.to_str()) {
        Some(name) => name.to_lowercase(),
        None => return false,
    };

    matches!(
        entry_name.as_str(),
        "hiberfil.sys"
            | "pagefile.sys"
            | "swapfile.sys"
            | "dumpstack.log.tmp"
            | "documents and settings"
    )
}

fn should_skip_path(path: &Path) -> bool {
    #[cfg(windows)]
    {
        is_blacklisted_windows_system_path(path)
    }

    #[cfg(not(windows))]
    {
        let _ = path;
        false
    }
}

fn entry_name(path: &Path, normalized_path: &str) -> Option<String> {
    if let Some(name) = path.file_name().and_then(|value| value.to_str()) {
        return Some(name.to_string());
    }

    let trimmed_path = normalized_path.trim_end_matches('/');

    if trimmed_path.is_empty() {
        return Some("/".to_string());
    }

    trimmed_path
        .rsplit('/')
        .find(|segment| !segment.is_empty())
        .map(|segment| segment.to_string())
        .or_else(|| Some(normalized_path.to_string()))
}

/// Counts the immediate children of a directory. Returns `None` if the directory
/// can't be read (e.g. permission denied). This is the expensive part of building
/// a listing on a network share — one read per subfolder — so it is made optional
/// in `read_entry` and computed separately/lazily via `get_dir_item_counts`.
fn count_dir_entries(path: &Path) -> Option<u32> {
    fs::read_dir(path)
        .ok()
        .map(|entries| entries.count() as u32)
}

fn read_entry(path: &Path, count_items: bool) -> Option<DirEntry> {
    if should_skip_path(path) {
        return None;
    }

    let metadata = match fs::metadata(path) {
        Ok(meta) => meta,
        Err(_) => return None,
    };

    let symlink_metadata = fs::symlink_metadata(path).ok();
    let is_symlink = symlink_metadata
        .map(|meta| meta.is_symlink())
        .unwrap_or(false);

    let path_string = normalize_path(path.to_str()?);
    let name = entry_name(path, &path_string)?;
    let extension = path_extension_lowercase(path);
    let is_dir = metadata.is_dir();
    let is_file = metadata.is_file();

    let (modified_time, accessed_time, created_time) = metadata_times_unix_ms(&metadata);

    let size = if is_file { metadata.len() } else { 0 };

    let item_count = if is_dir && count_items {
        count_dir_entries(path)
    } else {
        None
    };

    let mime = if is_file {
        get_mime_type(&extension)
    } else {
        None
    };

    Some(DirEntry {
        name,
        ext: extension,
        path: path_string,
        size,
        item_count,
        modified_time,
        accessed_time,
        created_time,
        mime,
        is_file,
        is_dir,
        is_symlink,
        is_hidden: is_hidden_path(path),
    })
}

#[cfg(windows)]
fn resolve_windows_shortcut_target(path: &Path) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::{Interface, PCWSTR};
    use windows::Win32::System::Com::{
        CoCreateInstance, CoInitializeEx, CoUninitialize, IPersistFile, CLSCTX_INPROC_SERVER,
        COINIT_APARTMENTTHREADED,
    };
    use windows::Win32::UI::Shell::{IShellLinkW, ShellLink, SLGP_RAWPATH};

    unsafe {
        let coinit_result = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
        let needs_uninitialize = coinit_result.is_ok();

        let resolved_path = (|| {
            let shell_link: IShellLinkW =
                CoCreateInstance(&ShellLink, None, CLSCTX_INPROC_SERVER).ok()?;
            let persist_file: IPersistFile = shell_link.cast().ok()?;
            let shortcut_path: Vec<u16> = path
                .as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();

            persist_file
                .Load(
                    PCWSTR(shortcut_path.as_ptr()),
                    windows::Win32::System::Com::STGM(0),
                )
                .ok()?;

            let mut target_path_buffer = vec![0u16; 260];
            shell_link
                .GetPath(
                    &mut target_path_buffer,
                    std::ptr::null_mut(),
                    SLGP_RAWPATH.0 as u32,
                )
                .ok()?;

            let target_path_length = target_path_buffer
                .iter()
                .position(|character| *character == 0)?;

            if target_path_length == 0 {
                return None;
            }

            Some(String::from_utf16_lossy(
                &target_path_buffer[..target_path_length],
            ))
        })();

        if needs_uninitialize {
            CoUninitialize();
        }

        resolved_path
    }
}

#[cfg(windows)]
pub fn resolve_windows_directory_shortcut(path: String) -> Result<Option<String>, String> {
    let shortcut_path = Path::new(&path);

    if !shortcut_path.exists() || !shortcut_path.is_file() {
        return Ok(None);
    }

    if path_extension_lowercase(shortcut_path).as_deref() != Some("lnk") {
        return Ok(None);
    }

    let Some(resolved_path) = resolve_windows_shortcut_target(shortcut_path) else {
        return Ok(None);
    };

    if !Path::new(&resolved_path).is_dir() {
        return Ok(None);
    }

    Ok(Some(normalize_path(&resolved_path)))
}

#[cfg(not(windows))]
pub fn resolve_windows_directory_shortcut(path: String) -> Result<Option<String>, String> {
    let _ = path;
    Ok(None)
}

pub fn get_dir_entry(path: String) -> Result<DirEntry, String> {
    let entry_path = Path::new(&path);

    match entry_path.try_exists() {
        Ok(true) => {}
        Ok(false) => return Err(format!("Path does not exist: {}", path)),
        Err(io_error) => {
            return Err(format!("Failed to access path: {}: {}", path, io_error));
        }
    }

    read_entry(entry_path, true).ok_or_else(|| format!("Failed to read path: {}", path))
}

/// Computes item counts for a batch of directory paths. Used to backfill folder
/// counts after a fast `read_dir_names_only` listing has already been rendered.
pub fn get_dir_item_counts(paths: Vec<String>) -> Vec<DirItemCount> {
    paths
        .into_iter()
        .map(|path| {
            let item_count = count_dir_entries(Path::new(&path));
            DirItemCount { path, item_count }
        })
        .collect()
}

pub async fn get_dir_entry_with_timeout(path: String, timeout_ms: u64) -> Result<DirEntry, String> {
    match with_blocking_timeout(timeout_ms, move || get_dir_entry(path)).await {
        Ok(result) => result,
        Err(BlockingTimeoutError::JoinError(join_error)) => {
            Err(format!("Failed to read path: {}", join_error))
        }
        Err(BlockingTimeoutError::TimedOut(timeout_ms)) => {
            Err(format!("Reading path timed out after {} ms", timeout_ms))
        }
    }
}

pub fn read_dir(path: String) -> Result<DirContents, String> {
    read_dir_inner(path, true)
}

/// Like `read_dir` but skips per-subfolder item counting, so the listing returns
/// without a network round-trip per subfolder. Folder `item_count` is left as
/// `None`; counts are backfilled via `get_dir_item_counts`.
pub fn read_dir_names_only(path: String) -> Result<DirContents, String> {
    read_dir_inner(path, false)
}

/// Returns the host name when `path` is a UNC host-root (e.g. `\\pf-george`),
/// i.e. a UNC path with exactly one segment and no share. WSL virtual host
/// roots are excluded so they keep flowing through the normal fs-based path.
#[cfg(windows)]
fn unc_host_root(path: &str) -> Option<String> {
    let normalized = normalize_path(path);

    if !normalized.starts_with("//") || normalized.starts_with("///") {
        return None;
    }

    let segments: Vec<&str> = normalized
        .trim_matches('/')
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();

    if segments.len() != 1 {
        return None;
    }

    let host = segments[0];
    let host_lower = host.to_lowercase();

    if host_lower == "wsl.localhost" || host_lower == "wsl$" {
        return None;
    }

    Some(host.to_string())
}

/// Enumerates the SMB shares published by `host` (what Windows Explorer shows
/// when you type `\\host` in the address bar) and returns them as directory
/// entries. Uses `NetShareEnum` (level 1), filtering out special/admin shares
/// (IPC$, ADMIN$, C$, ...) and hidden `$`-suffixed shares.
#[cfg(windows)]
fn enumerate_smb_shares(host: &str, original_path: &str) -> Result<DirContents, String> {
    use windows::core::PCWSTR;
    use windows::Win32::NetworkManagement::NetManagement::{NetApiBufferFree, MAX_PREFERRED_LENGTH};
    use windows::Win32::Storage::FileSystem::{NetShareEnum, SHARE_INFO_1, STYPE_SPECIAL};

    const NERR_SUCCESS: u32 = 0;
    const ERROR_MORE_DATA: u32 = 234;
    const ERROR_ACCESS_DENIED: u32 = 5;
    const ERROR_BAD_NETPATH: u32 = 53;
    const ERROR_BAD_NET_NAME: u32 = 67;

    // NetShareEnum expects the server in `\\server` form.
    let server: Vec<u16> = format!("\\\\{host}")
        .encode_utf16()
        .chain(std::iter::once(0))
        .collect();

    let mut buffer: *mut u8 = std::ptr::null_mut();
    let mut entries_read: u32 = 0;
    let mut total_entries: u32 = 0;

    let status = unsafe {
        NetShareEnum(
            PCWSTR(server.as_ptr()),
            1,
            &mut buffer as *mut *mut u8,
            MAX_PREFERRED_LENGTH,
            &mut entries_read,
            &mut total_entries,
            None,
        )
    };

    if status != NERR_SUCCESS && status != ERROR_MORE_DATA {
        if !buffer.is_null() {
            unsafe {
                NetApiBufferFree(Some(buffer as *const _));
            }
        }

        return Err(match status {
            ERROR_ACCESS_DENIED => format!(
                "Access denied listing shares on \\\\{host}. The host may require credentials."
            ),
            ERROR_BAD_NETPATH | ERROR_BAD_NET_NAME => {
                format!("Network host not found: \\\\{host}")
            }
            other => format!("Failed to list shares on \\\\{host} (error {other})"),
        });
    }

    let mut entries: Vec<DirEntry> = Vec::new();

    if !buffer.is_null() {
        let shares = unsafe {
            std::slice::from_raw_parts(buffer as *const SHARE_INFO_1, entries_read as usize)
        };

        for share in shares {
            // Skip special/admin shares (IPC$, ADMIN$, drive-letter $ shares).
            if (share.shi1_type.0 & STYPE_SPECIAL.0) != 0 {
                continue;
            }

            let name = unsafe { share.shi1_netname.to_string() }.unwrap_or_default();

            if name.is_empty() || name.ends_with('$') {
                continue;
            }

            entries.push(DirEntry {
                path: normalize_path(&format!("//{host}/{name}")),
                name,
                ext: None,
                size: 0,
                item_count: None,
                modified_time: 0,
                accessed_time: 0,
                created_time: 0,
                mime: None,
                is_file: false,
                is_dir: true,
                is_symlink: false,
                is_hidden: false,
            });
        }

        unsafe {
            NetApiBufferFree(Some(buffer as *const _));
        }
    }

    entries.sort_by(|first, second| first.name.to_lowercase().cmp(&second.name.to_lowercase()));

    let dir_count = entries.len();

    Ok(DirContents {
        path: normalize_path(original_path),
        entries,
        total_count: dir_count,
        dir_count,
        file_count: 0,
        opened_directory_times: OpenedDirectoryTimes {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
        },
    })
}

fn read_dir_inner(path: String, count_items: bool) -> Result<DirContents, String> {
    // A bare `\\host` UNC path can't be listed with `fs::read_dir` because the
    // OS resolves it via SMB share enumeration, not a directory read. Mirror
    // Explorer by listing the host's shares.
    #[cfg(windows)]
    if let Some(host) = unc_host_root(&path) {
        return enumerate_smb_shares(&host, &path);
    }

    let directory = Path::new(&path);

    let self_metadata = match fs::metadata(directory) {
        Ok(metadata) => metadata,
        Err(io_error) if io_error.kind() == std::io::ErrorKind::NotFound => {
            return Err(format!("Path does not exist: {}", path));
        }
        Err(io_error) => {
            return Err(format!("Failed to access path: {}: {}", path, io_error));
        }
    };

    if !self_metadata.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let (self_modified, self_accessed, self_created) = metadata_times_unix_ms(&self_metadata);

    let read_result = fs::read_dir(directory).map_err(|error| error.to_string())?;

    let mut entries: Vec<DirEntry> = Vec::new();
    let mut dir_count = 0;
    let mut file_count = 0;

    for entry in read_result.flatten() {
        if let Some(dir_entry) = read_entry(&entry.path(), count_items) {
            if dir_entry.is_dir {
                dir_count += 1;
            } else if dir_entry.is_file {
                file_count += 1;
            }
            entries.push(dir_entry);
        }
    }

    entries.sort_by(|first, second| match (first.is_dir, second.is_dir) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => first.name.to_lowercase().cmp(&second.name.to_lowercase()),
    });

    Ok(DirContents {
        path: normalize_path(&path),
        entries,
        total_count: dir_count + file_count,
        dir_count,
        file_count,
        opened_directory_times: OpenedDirectoryTimes {
            modified_time: self_modified,
            accessed_time: self_accessed,
            created_time: self_created,
        },
    })
}

pub async fn read_dir_with_timeout(path: String, timeout_ms: u64) -> Result<DirContents, String> {
    match with_blocking_timeout(timeout_ms, move || read_dir(path)).await {
        Ok(result) => result,
        Err(BlockingTimeoutError::JoinError(join_error)) => {
            Err(format!("Failed to read directory: {}", join_error))
        }
        Err(BlockingTimeoutError::TimedOut(timeout_ms)) => Err(format!(
            "Reading directory timed out after {} ms",
            timeout_ms
        )),
    }
}
