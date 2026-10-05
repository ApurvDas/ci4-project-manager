// A thin shell around the website's own pages (../web). Everything the app does lives in that
// JavaScript, so web and desktop share one UI; this file only adds what a browser tab can't:
// a tray icon (showing the running timer), staying alive in the tray when the window closes,
// one running copy, updates, and the apurvdas-pm:// link the website uses to hand back a browser
// sign-in. Notifications and the website links are driven from web/assets/js/desktop.js through
// the plugins registered below.
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WindowEvent,
};
use tauri_plugin_deep_link::DeepLinkExt;

/// The page tells us what the timer says; it becomes the tray icon's tooltip.
#[tauri::command]
fn tray_timer(app: AppHandle, text: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(text));
    }
}

fn show_main(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

/// Ask once at start-up whether a newer version is published; install it if the user agrees.
/// A failed check (offline, no release yet) is not worth interrupting anyone for.
async fn check_for_update(app: AppHandle) -> tauri_plugin_updater::Result<()> {
    use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
    use tauri_plugin_updater::UpdaterExt;

    if let Some(update) = app.updater()?.check().await? {
        let install = app
            .dialog()
            .message(format!("Version {} is available. Install it now? The app will restart.", update.version))
            .title("Update available")
            .buttons(MessageDialogButtons::OkCancelCustom("Install".into(), "Later".into()))
            .blocking_show();
        if install {
            update.download_and_install(|_chunk, _total| {}, || {}).await?;
            app.restart();
        }
    }
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        // A second launch brings the first one back instead of opening another window. Windows opens
        // an apurvdas-pm:// link as a second launch; the deep-link feature passes the link on.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| show_main(app)))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![tray_timer])
        .setup(|app| {
            // The installer registers the link for releases; a dev build isn't installed, so it registers itself.
            #[cfg(debug_assertions)]
            app.deep_link().register_all()?;
            // The page checks the sign-in it was handed (see desktop.js), so pass the link on as it is.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    let _ = handle.emit("auth-link", url.to_string());
                }
                show_main(&handle);
            });

            let open =MenuItem::with_id(app, "open", "Open Project Manager", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "Stop timer", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &stop, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().expect("the app has an icon").clone())
                .tooltip("Project Manager")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    // The page owns the timer (and the offline queue), so it does the stopping.
                    "stop" => {
                        let _ = app.emit("stop-timer", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        show_main(tray.app_handle());
                    }
                })
                .build(app)?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let _ = check_for_update(handle).await;
            });
            Ok(())
        })
        // Closing the window hides it to the tray (so the timer and reminders keep running); Quit exits.
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Project Manager");
}
