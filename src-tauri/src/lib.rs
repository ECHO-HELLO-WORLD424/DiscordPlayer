// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod fileop;
mod discord_rpc;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            fileop::list_files,
            fileop::read_audio_file,
            fileop::get_image_filename,
            fileop::read_details_file,
            discord_rpc::discord_connect,
            discord_rpc::discord_disconnect,
            discord_rpc::update_discord_presence
        ])
        .on_window_event(|_window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Cleanup Discord connection when window is closing
                let _ = discord_rpc::discord_disconnect();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
