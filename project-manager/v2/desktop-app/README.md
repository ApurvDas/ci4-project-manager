# Project Manager — Desktop app (Windows)

A thin [Tauri](https://tauri.app) shell around the [`web/`](../web) front end, so the website and
the desktop app share **one UI and one codebase**. Same pages, in their own window — plus a tray
icon, Windows notifications, automatic updates and full offline editing.

> Branch: **`desktop-app`** · Latest release: **desktop-v0.2.1**

## ⬇️ Download & install

| | |
|---|---|
| **Get it** | [**Releases page →**](https://github.com/ApurvDas/project-manager/releases/latest) (always the newest) |
| **Direct (v0.2.1)** | [`Project.Manager_0.2.1_x64-setup.exe`](https://github.com/ApurvDas/project-manager/releases/download/desktop-v0.2.1/Project.Manager_0.2.1_x64-setup.exe) — ~2 MB |
| **Requires** | Windows 10/11 x64 (uses the WebView2 runtime Windows already ships) |

Run the installer — it installs **per-user, no admin needed**. It isn't code-signed, so Windows
SmartScreen warns the first time: choose **More info → Run anyway**. After that the app updates
itself at start-up.

## 🖥️ What it does differently from the browser

| Feature | Behaviour |
|---|---|
| **Tray icon** | Tooltip shows the running timer; closing the window hides to tray so timers/reminders keep going. **Quit** in the tray menu really exits. |
| **Notifications** | A Windows toast per new notification, and once for each task due within the hour. |
| **Sign in** | *Sign in with your browser* opens the website (so saved passwords work), then hands the session back via an `apurvdas-pm://` link. Email/password form works too. |
| **Offline** | The same offline editing and merge the website has. |
| **Memory** | ~170 MB idle (app + WebView2 processes) vs ~315 MB for Chrome on the same page. |

## 🔨 Build it yourself

Needs [Rust](https://rustup.rs) and the Visual Studio C++ build tools. Run from `project-manager/v2`:

```bash
npm run desktop:dev      # app pointed at http://localhost:8123 (starts the dev server for you)
npm run desktop:build    # installer in desktop-app/src-tauri/target/release/bundle/nsis/
```

## 🚀 Release it

The **Desktop app** GitHub Actions workflow builds the installer and publishes it with the files the
updater reads (`latest.json` + the signed `.exe`).

1. Bump `version` in [`src-tauri/tauri.conf.json`](src-tauri/tauri.conf.json) and
   [`src-tauri/Cargo.toml`](src-tauri/Cargo.toml).
2. Push a tag: `git tag desktop-v0.2.2 && git push origin desktop-v0.2.2`.

The updater reads `latest.json` from the repository's **latest** release, so keep the desktop release
marked as Latest. Signing keys (`TAURI_SIGNING_PRIVATE_KEY` / `…_PASSWORD`) live in Actions secrets;
the matching public key is in `tauri.conf.json` under `plugins.updater.pubkey`. **Lose the private
key and installed copies can never auto-update again.**

See the [v2 README](../README.md#desktop-app-windows) for the full desktop notes.
