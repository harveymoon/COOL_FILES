<h1>
  <img valign="middle" src="https://github.com/harveymoon/COOL_FILES/raw/main/.github/media/logo-1024x1024.png" width="64px">
  &nbsp;&nbsp;Cool Files
</h1>

> ### 🍴 This is a fork
> **Cool Files is a personal fork / port of [Sigma File Manager](https://github.com/aleksey-hoffman/sigma-file-manager)**, the free, open-source, modern file manager originally **designed, developed, and maintained by [Aleksey Hoffman](https://github.com/aleksey-hoffman)** and the Sigma File Manager contributors. All credit for the original application, its design, and its features belongs to them.
>
> This fork is **independent and unofficial**: it is **not** affiliated with, endorsed by, or supported by the original Sigma File Manager project. Please do **not** send issues, support requests, or donations intended for this fork to the upstream project — and vice versa.

Cool Files is a free, open-source, modern file manager (explorer / finder) app for Windows and Linux, based on Sigma File Manager.

<img src="./.github/media/cool_files-main.png">

## The original project

If you want the official, actively-maintained app — along with its community and ways to support its author — please go to the original project rather than this fork:

- **Original repository:** https://github.com/aleksey-hoffman/sigma-file-manager
- **Original community:** [Discord](https://discord.gg/sxZTztFVwX) · [Reddit](https://www.reddit.com/r/SigmaFileManager) · [YouTube](https://www.youtube.com/@sigma-dev) · [X (Twitter)](https://twitter.com/sigma__dev) · [Telegram](https://t.me/sigma_devs)
- **Support the original author (Aleksey Hoffman):** [Patreon](https://patreon.com/sigma_file_manager)
- **Official downloads** (winget / Microsoft Store / signed releases): see the original repository above.

Thank you to Aleksey Hoffman and everyone who built Sigma File Manager. ❤️

## ✨ New & improved in Cool Files

These are the changes this fork adds **on top of** the upstream Sigma File Manager feature set. They're the reason Cool Files exists as a separate project.

### 🌳 Tree layout (new)

A fourth navigator layout alongside **List / Grid / Columns**: an interactive, **pannable and zoomable [D3](https://d3js.org/) tree** of the folder structure.

- **Drag** the canvas to pan, **scroll** to zoom.
- **Click a folder** to expand or collapse it — children are **loaded on demand** the first time you open a node, so even huge trees stay responsive.
- **Double-click** a folder to drill into it (re-roots the tree there), or a file to open it.
- Collapsed folders that still have children show as filled nodes; selecting a node updates the info panel. Respects the "Show hidden items" toggle live.
- Switch to it with the **Tree** button (network/nodes icon) in the toolbar's layout group.

### 📊 "Size %" list column (new)

An optional list-view column that visualizes each item's size as a **horizontal bar plus a percentage of the current directory's total size** — so the space hogs in a folder jump out at a glance.

- Folders use their lazily-computed directory size; bars settle as sizes finish calculating.
- Off by default — enable it from the **Columns** button or by right-clicking the list header. It's resizable like any other column, and its visibility persists.

### 🗂️ Smarter tabs — no duplicates (new)

Opening a directory that's **already open now jumps to that existing tab** instead of creating a second copy of the same path. This applies everywhere a folder can be opened: the sidebar, drive/home cards, the dashboard, "open in new tab", and external launches.

### 🚀 Flow Launcher integration (new)

Cool Files works as a first-class file manager for [Flow Launcher](https://www.flowlauncher.com/): opening a folder from the launcher **opens it in a new tab of the already-running Cool Files window** (or focuses the tab if that folder is already open), rather than spawning a new window. Any launcher or tool that calls `cool_files.exe "<path>"` gets the same behavior.

### 🎨 Original branding

- A brand-new **Cool Files logo** (a frosted file-stack mark) replacing the inherited artwork, regenerated across the full app icon set and favicon.
- The in-app updater now checks **this fork's** GitHub releases.

### 🛠️ Stability & UX fixes

Selected fixes carried over and hardened in this fork:

- **No false update prompts:** update checks use the GitHub Releases API and only offer a build that actually ships an installer — unreleased/draft tags no longer trigger a prompt.
- **No accidental file opens:** rapidly clicking two different files now selects the second one instead of opening it (double-click is matched per-file).
- **No stuck loading screen:** a startup-recovery guard prevents the app from hanging on the splash after a device wake/resume.
- **Smoother window resizing.**

---

## Features (inherited from Sigma File Manager)

Cool Files inherits the full Sigma File Manager feature set, including:

- **Smart global search:** Finds files and folders in seconds (searches a full `1TB` drive in ~2 seconds). Its typo-correction system handles typos, wrong case, wrong word order, missing words, missing symbols, and missing file extensions.
- **Tabs:** Keep multiple directories open and switch between them instantly. *(See the no-duplicate-tabs improvement above.)*
- **Split view:** Split any tab into two panes you can navigate independently and transfer files between easily.
- **Multiple layouts:** View a folder as a **List**, **Grid**, or **Columns** (Miller columns) — plus the new **Tree** layout. Resizable, toggleable list columns with sorting.
- **Extensions and marketplace:** Install extensions from the built-in marketplace or local folders. Extensions can add commands, pages, shortcuts, settings, and more.
- **Default file manager:** On Windows, Cool Files can replace File Explorer for most everyday file actions.
- **LAN file sharing:** Share or stream files and folders over your local network, with browser access, QR codes, and FTP support.
- **Network locations (Alpha stage):** Connect to remote locations such as SSHFS, NFS, SMB, and CIFS.
- **Address bar:** Navigate with the keyboard, autocomplete paths, and quickly jump to parent folders.
- **Item filter:** Narrow large folders with glob patterns and property filters for size, dates, MIME type, and more.
- **Smart drag and drop:** Move or copy local files more comfortably, and handle web drops more smoothly.
- **Shortcuts and command palette:** Most actions are keyboard-friendly, with global shortcuts and a fast command palette for app and extension commands.
- **Home banner and visual effects:** Personalize the UI with custom images, videos, built-in artwork, transparency, blend modes, and other style controls.
- **Dashboard and quick access:** Reach favorites, tagged files, most-visited locations, and history data from one central area.
- **Tags:** Organize your files and folders with colored tags.
- **Zip archives:** Compress files into `.zip` archives and extract them without leaving the app.
- **Quick view:** Instantly preview images, videos, audio, PDFs, and text files with `Space`, then move through files without opening external apps.
- **WSL drives:** On Windows, browse detected WSL distributions directly in the navigator.
- **Localization:** Translations for the most widely-used languages.

## Download & install

This fork does **not** currently publish prebuilt binaries, a winget package, or a Microsoft Store listing. To run it, build it from source:

- See [CONTRIBUTING.md](./CONTRIBUTING.md) for the build guide.
- On Windows, after building you can launch the standalone build with `Launch Cool Files.bat` in the project root.

Looking for a ready-to-install, signed, officially-distributed build? Use the **original Sigma File Manager** — see [The original project](#the-original-project) above.

## For developers

If you'd like to contribute, follow this guide: [CONTRIBUTING.md](./CONTRIBUTING.md)

## License

Cool Files is licensed under **GPL-3.0-or-later** — the same license as the upstream project. It is a derivative work of Sigma File Manager, &copy; Aleksey Hoffman and contributors. The original copyright and license notices are retained throughout the source. See [LICENSE.md](./LICENSE.md).
