#[tauri::command]
pub fn list_files(path: String, pattern: String) -> Vec<String> {
    use std::fs;
    use regex::Regex;

    let mut matching_files = Vec::new();

    // Compile the regex pattern
    let re = match Regex::new(&pattern) {
        Ok(re) => re,
        Err(_) => return matching_files, // Return empty vec on invalid pattern
    };

    let entries = match fs::read_dir(path) {
        Ok(entries) => entries,
        Err(_) => return matching_files,
    };

    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if re.is_match(file_name) {
                            matching_files.push(file_name.to_string());
                        }
                    }
                }
            }
        }
    }

    matching_files
}

#[tauri::command]
pub fn read_audio_file(path: String) -> Result<Vec<u8>, String> {
    use std::fs;

    fs::read(&path)
        .map_err(|e| format!("Failed to read audio file: {}", e))
}

#[tauri::command]
pub fn get_image_filename(directory_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let dir_path = PathBuf::from(&directory_path);

    // Read directory entries
    let entries = fs::read_dir(&dir_path)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    // Look for image files (png, jpg, jpeg, gif, etc.)
    for entry in entries {
        if let Ok(entry) = entry {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        let lower = file_name.to_lowercase();
                        if lower.ends_with(".png") || lower.ends_with(".jpg") ||
                           lower.ends_with(".jpeg") || lower.ends_with(".gif") {
                            return Ok(file_name.to_string());
                        }
                    }
                }
            }
        }
    }

    Err("No image file found in directory".to_string())
}

#[tauri::command]
pub fn read_details_file(directory_path: String) -> Result<String, String> {
    use std::fs;
    use std::path::PathBuf;

    let mut details_path = PathBuf::from(&directory_path);
    details_path.push("details.txt");

    fs::read_to_string(&details_path)
        .map_err(|e| format!("Failed to read details file: {}", e))
}