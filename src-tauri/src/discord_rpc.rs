use discord_rich_presence::{DiscordIpc, DiscordIpcClient, activity::{Activity, Assets}};
use std::sync::Mutex;

// Global Discord client state
static DISCORD_CLIENT: Mutex<Option<DiscordIpcClient>> = Mutex::new(None);

#[tauri::command]
pub fn discord_connect(client_id: String) -> Result<(), String> {
    let mut client_lock = DISCORD_CLIENT.lock()
        .map_err(|e| format!("Failed to lock Discord client: {}", e))?;

    // If already connected, return success
    if client_lock.is_some() {
        return Ok(());
    }

    // Validate client ID
    if client_id.trim().is_empty() {
        return Err("Client ID cannot be empty".to_string());
    }

    // Create new Discord IPC client
    let mut client = DiscordIpcClient::new(&client_id)
        .map_err(|e| format!("Failed to create Discord client: {}", e))?;

    // Connect to Discord
    client.connect()
        .map_err(|e| format!("Failed to connect to Discord: {}", e))?;

    // Store the client
    *client_lock = Some(client);

    Ok(())
}

#[tauri::command]
pub fn discord_disconnect() -> Result<(), String> {
    let mut client_lock = DISCORD_CLIENT.lock()
        .map_err(|e| format!("Failed to lock Discord client: {}", e))?;

    if let Some(mut client) = client_lock.take() {
        client.close()
            .map_err(|e| format!("Failed to disconnect from Discord: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn update_discord_presence(
    details: String,
    state: String,
    large_image_key: String,
    large_image_text: String
) -> Result<(), String> {
    let mut client_lock = DISCORD_CLIENT.lock()
        .map_err(|e| format!("Failed to lock Discord client: {}", e))?;

    let client = client_lock.as_mut()
        .ok_or_else(|| "Discord client not connected".to_string())?;

    // Create activity
    let activity = Activity::new()
        .details(&details)
        .state(&state)
        .assets(
            Assets::new()
                .large_image(&large_image_key)
                .large_text(&large_image_text)
        );

    // Set activity
    client.set_activity(activity)
        .map_err(|e| format!("Failed to set Discord activity: {}", e))?;

    Ok(())
}
