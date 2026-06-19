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

## Features

Cool Files inherits Sigma File Manager's feature set, including:

- **Smart global search:** Finds files and folders in seconds (searches full `1TB` drive in ~2 seconds). Its typo correction system handles typos, wrong case, wrong word order, missing words, missing symbols, and missing file extension.
- **Tabs:** Keep multiple directories open and switch between them instantly.
- **Split view:** Any tab can be splitted into 2 panes which you can navigate indipendently and transfer files between them easily.
- **Extensions and marketplace:** Install extensions from the built-in marketplace or local folders. Extensions can add commands, pages, shortcuts, settings, and more.
- **Default file manager:** On Windows, Cool Files can replace File Explorer for most everyday file actions.
- **LAN file sharing:** Share or stream files and folders over your local network, with browser access, QR codes, and FTP support.
- **Network locations (Alpha stage):** Connect to remote locations such as SSHFS, NFS, SMB, and CIFS.
- **Address bar:** Navigate with the keyboard, autocomplete paths, and quickly jump to parent folders.
- **Item filter:** Narrow large folders with glob patterns and property filters for size, dates, MIME type, and more.
- **Smart drag and drop:** Move or copy local files more comfortably, and handle web drops more smoothly.
- **Shortcuts and command palette:** Most actions are keyboard-friendly, with global shortcuts and a fast command palette for app and extension commands.
- **Home banner and visual effects:** Personalize the UI with custom images, videos, built-in artwork, transparency, blend modes, and other style controls.
- **Dashboard and quick access:** Reach favorites, tagged files, most visited locations, and history data from one central area.
- **Tags:** Organize your files and folders with tags.
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
