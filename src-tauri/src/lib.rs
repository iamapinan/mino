use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
};

fn paint(buffer: &mut [u8], width: u32, x: u32, y: u32, w: u32, h: u32, color: [u8; 4]) {
    for py in y..(y + h) {
        for px in x..(x + w) {
            let index = ((py * width + px) * 4) as usize;
            buffer[index..index + 4].copy_from_slice(&color);
        }
    }
}

fn pet_icon(mood: &str, character: &str, frame: u8) -> Image<'static> {
    let width = 22;
    let height = 22;
    let mut rgba = vec![0; (width * height * 4) as usize];
    let white = [255, 255, 255, 255];
    let clear = [0, 0, 0, 0];
    let blink = mood == "sleeping" || frame % 6 == 5;
    let motion = frame % 2;

    match character {
        "rexo" => {
            // A strong side profile: tail, body, raised head, and two back spikes.
            paint(&mut rgba, width, 1, 11 + motion as u32, 6, 4, white);
            paint(&mut rgba, width, 4, 10, 12, 8, white);
            paint(&mut rgba, width, 13, 5, 8, 9, white);
            paint(&mut rgba, width, 7, 7, 3, 4, white);
            paint(&mut rgba, width, 11, 6, 3, 5, white);
            paint(&mut rgba, width, 6, 17, 4, 3, white);
            paint(&mut rgba, width, 14, 17, 4, 3, white);
            if blink {
                paint(&mut rgba, width, 16, 9, 3, 1, clear);
            } else {
                paint(&mut rgba, width, 17, 8, 2, 2, clear);
            }
            paint(&mut rgba, width, 19, 12, 2, 1, clear);
        }
        "mallow" => {
            // Long separated ears make the rabbit readable at a glance.
            paint(&mut rgba, width, 5, 1 + motion as u32, 5, 10, white);
            paint(&mut rgba, width, 13, 2 - motion as u32, 5, 10, white);
            paint(&mut rgba, width, 4, 8, 15, 11, white);
            paint(&mut rgba, width, 6, 18, 5, 2, white);
            paint(&mut rgba, width, 13, 18, 5, 2, white);
            paint(&mut rgba, width, 7, 3, 1, 5, clear);
            paint(&mut rgba, width, 15, 3, 1, 5, clear);
            if blink {
                paint(&mut rgba, width, 7, 12, 3, 1, clear);
                paint(&mut rgba, width, 13, 12, 3, 1, clear);
            } else {
                paint(&mut rgba, width, 8, 11, 2, 2, clear);
                paint(&mut rgba, width, 14, 11, 2, 2, clear);
            }
            paint(&mut rgba, width, 11, 15, 2, 1, clear);
        }
        "pingo" => {
            // Compact oval body with square flippers and a belly cutout.
            paint(&mut rgba, width, 6, 3, 11, 17, white);
            paint(&mut rgba, width, 4, 5, 15, 13, white);
            paint(&mut rgba, width, 2, 9 + motion as u32, 4, 6, white);
            paint(&mut rgba, width, 17, 10 - motion as u32, 4, 6, white);
            paint(&mut rgba, width, 5, 19, 6, 2, white);
            paint(&mut rgba, width, 13, 19, 6, 2, white);
            paint(&mut rgba, width, 8, 12, 7, 6, clear);
            if blink {
                paint(&mut rgba, width, 7, 8, 3, 1, clear);
                paint(&mut rgba, width, 14, 8, 3, 1, clear);
            } else {
                paint(&mut rgba, width, 8, 7, 2, 2, clear);
                paint(&mut rgba, width, 14, 7, 2, 2, clear);
            }
            paint(&mut rgba, width, 11, 10, 3, 1, clear);
        }
        _ => {
            // Wide ears and a single compact head/body silhouette.
            paint(&mut rgba, width, 3, 3, 5, 6, white);
            paint(&mut rgba, width, 15, 3, 5, 6, white);
            paint(&mut rgba, width, 4, 6, 15, 13, white);
            paint(&mut rgba, width, 18, 13 - motion as u32, 4, 3, white);
            paint(&mut rgba, width, 6, 18, 5, 2, white);
            paint(&mut rgba, width, 13, 18, 5, 2, white);
            if blink {
                paint(&mut rgba, width, 7, 11, 3, 1, clear);
                paint(&mut rgba, width, 14, 11, 3, 1, clear);
            } else {
                paint(&mut rgba, width, 8, 10, 2, 2, clear);
                paint(&mut rgba, width, 14, 10, 2, 2, clear);
            }
            paint(&mut rgba, width, 11, 14, 2, 1, clear);
        }
    }

    Image::new_owned(rgba, width, height)
}

#[tauri::command]
fn set_tray_mood(app: tauri::AppHandle, mood: String, character: String, pet_name: String, frame: u8) -> Result<(), String> {
    let tray = app.tray_by_id("mimo").ok_or("tray icon not found")?;
    let status = match mood.as_str() {
        "sleeping" => "is sleeping",
        "sad" => "needs a little care",
        "okay" => "is doing okay",
        _ => "is feeling cozy",
    };
    tray.set_tooltip(Some(format!("{pet_name} {status}")))
        .map_err(|error| error.to_string())?;
    tray.set_icon(Some(pet_icon(&mood, &character, frame))).map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![set_tray_mood])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let open = MenuItem::with_id(app, "open", "Open Mimo", true, None::<&str>)?;
            let feed = MenuItem::with_id(app, "feed", "Feed", true, None::<&str>)?;
            let play = MenuItem::with_id(app, "play", "Play", true, None::<&str>)?;
            let clean = MenuItem::with_id(app, "clean", "Clean", true, None::<&str>)?;
            let sleep = MenuItem::with_id(app, "sleep", "Sleep / Wake", true, None::<&str>)?;
            let drive = MenuItem::with_id(app, "drive", "Drive a Car", true, None::<&str>)?;
            let fly = MenuItem::with_id(app, "fly", "Fly a Plane", true, None::<&str>)?;
            let next_scene = MenuItem::with_id(app, "next-scene", "Next Scene", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Mimo", true, None::<&str>)?;
            let separator_one = PredefinedMenuItem::separator(app)?;
            let separator_two = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(
                app,
                &[
                    &open,
                    &separator_one,
                    &feed,
                    &play,
                    &clean,
                    &sleep,
                    &drive,
                    &fly,
                    &next_scene,
                    &separator_two,
                    &quit,
                ],
            )?;

            TrayIconBuilder::with_id("mimo")
                .icon(pet_icon("happy", "mimo", 0))
                .icon_as_template(true)
                .tooltip("Mimo is feeling cozy")
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "feed" | "play" | "clean" | "sleep" | "drive" | "fly" | "next-scene" => {
                        let _ = app.emit("tray-action", event.id.as_ref());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let window_to_hide = window.clone();
                window.on_window_event(move |event| {
                    if matches!(event, WindowEvent::Focused(false)) {
                        let _ = window_to_hide.hide();
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Mimo");
}
