import { SongManager, Song } from "./songManager";
import { SongPlayer, PlayerState } from "./songPlayer";

let filePathEl: HTMLInputElement | null;
let filePattern: HTMLInputElement | null;
let fileInfoEl: HTMLElement | null;
let songListEl: HTMLElement | null;

// Control elements
let playBtn: HTMLButtonElement | null;
let pauseBtn: HTMLButtonElement | null;
let stopBtn: HTMLButtonElement | null;
let previousBtn: HTMLButtonElement | null;
let nextBtn: HTMLButtonElement | null;

// Progress bar elements
let progressFill: HTMLElement | null;
let progressSlider: HTMLInputElement | null;
let currentTimeLabel: HTMLElement | null;
let totalTimeLabel: HTMLElement | null;

// Function buttons
let fn1Btn: HTMLButtonElement | null;
let fn2Btn: HTMLButtonElement | null;

// Current folder path
let currentFolderPath: string | null = null;

// Discord RPC enabled state
let discordEnabled: boolean = false;

// Initialize the song manager
const songManager = new SongManager();

// Currently selected song
let currentSelectedSong: string | null = null;

// Initialize the song player with callbacks
const songPlayer = new SongPlayer({
  onStateChange: (state: PlayerState) => {
    console.log('Player state changed to:', state);
    updateControlButtonStates(state);
  },
  onTimeUpdate: (currentTime: number, duration: number) => {
    updateProgressBar(currentTime, duration);
    updateTimeLabels(currentTime, duration);
  },
  onSongEnd: () => {
    console.log('Song ended');
    // TODO: Auto-play next song
  },
  onError: (error: string) => {
    console.error('Player error:', error);
    alert(`Playback error: ${error}`);
  },
  onLoadComplete: (duration: number) => {
    console.log('Song loaded, duration:', duration);
  }
});

/**
 * Populate the song list UI with songs
 */
function populateSongList(songs: Song[]) {
  if (!songListEl) {
    console.error("Song list element not found!");
    return
  }

  // Clear the song list
  songListEl.innerHTML = '';

  if (songs.length === 0) {
    songListEl.innerHTML = '<div class="no-songs">No songs found</div>';
    return;
  }

  // Create song items
  songs.forEach((song) => {
    const songItem = document.createElement('div');
    songItem.className = 'song-item';
    songItem.textContent = song.fileName;
    songItem.dataset.fileName = song.fileName;

    // Handle song item click
    songItem.addEventListener('click', () => {
      // Remove active class from previously selected song
      const previousActive = songListEl?.querySelector('.song-item.active');
      previousActive?.classList.remove('active');

      // Add active class to clicked song
      songItem.classList.add('active');

      // Store the current selected song
      currentSelectedSong = song.fileName;

      // Get the absolute path
      const absolutePath = songManager.getAbsolutePath(song.fileName);
      console.log('Selected song:', song.fileName);
      console.log('Absolute path:', absolutePath);

      // Load and play the song
      if (absolutePath) {
        songPlayer.play(absolutePath).catch(error => {
          console.error('Failed to play song:', error);
        });
      }
    });

    // @ts-ignore
    songListEl.appendChild(songItem);
  });
}

/**
 * List files from the specified directory
 */
async function listFiles() {
  if (fileInfoEl && filePathEl && filePattern) {
    try {
      const path = filePathEl.value.trim();

      if (!path) {
        fileInfoEl.textContent = "Please enter a directory path.";
        return;
      }

      fileInfoEl.textContent = "Loading...";

      // Use the song manager to list files
      const songs = await songManager.listFiles(
        path,
        filePattern.value || ".*"
      );

      // Update status message
      if (songs.length === 0) {
        fileInfoEl.textContent = "No files found matching the pattern.";
      } else {
        fileInfoEl.textContent = `Found ${songs.length} file(s).`;
      }

      // Populate the song list in the UI
      populateSongList(songs);

      // Update current folder path
      currentFolderPath = path;

      // Update Discord RPC if enabled
      if (discordEnabled) {
        updateDiscordPresence(path).catch(err => {
          console.error('Failed to update Discord presence:', err);
        });
      }
    } catch (error) {
      fileInfoEl.textContent = `Error: ${error}`;
      console.error("Error listing files:", error);
    }
  }
}

/**
 * Format time in seconds to MM:SS format
 */
function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) {
    return '0:00';
  }

  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update the progress bar based on current playback time
 */
function updateProgressBar(currentTime: number, duration: number): void {
  if (!progressFill || !progressSlider || !duration) return;

  const percentage = (currentTime / duration) * 100;
  progressFill.style.width = `${percentage}%`;

  // Update slider value without triggering input event
  if (progressSlider && !progressSlider.matches(':active')) {
    progressSlider.value = percentage.toString();
  }
}

/**
 * Update the time labels
 */
function updateTimeLabels(currentTime: number, duration: number): void {
  if (currentTimeLabel) {
    currentTimeLabel.textContent = formatTime(currentTime);
  }
  if (totalTimeLabel) {
    totalTimeLabel.textContent = formatTime(duration);
  }
}

/**
 * Update control button states based on player state
 */
function updateControlButtonStates(state: PlayerState): void {
  // You can add visual feedback here based on state
  // For example, disable/enable buttons or change their appearance
  if (playBtn && pauseBtn) {
    if (state === PlayerState.PLAYING) {
      playBtn.style.opacity = '0.5';
      pauseBtn.style.opacity = '1';
    } else {
      playBtn.style.opacity = '1';
      pauseBtn.style.opacity = '0.5';
    }
  }
}

/**
 * Get the currently selected song's absolute path
 */
export function getCurrentSongPath(): string | undefined {
  if (!currentSelectedSong) return undefined;
  return songManager.getAbsolutePath(currentSelectedSong);
}

/**
 * Navigate to settings page
 */
function navigateToSettings(): void {
  const baseUrl = window.location.origin;
  window.location.href = `${baseUrl}/config.html`;
}

/**
 * Update the Discord button text based on connection state
 */
function updateDiscordButtonState(): void {
  if (!fn1Btn) return;

  if (discordEnabled) {
    fn1Btn.textContent = 'Discord: ON';
    fn1Btn.style.backgroundColor = '#5865F2'; // Discord blue
    fn1Btn.style.filter = 'drop-shadow(0 0 1em var(--sys-color-green-light))';
  } else {
    fn1Btn.textContent = 'Discord: OFF';
    fn1Btn.style.backgroundColor = ''; // Reset to default
    fn1Btn.style.filter = '';
  }
}

/**
 * Update Discord Rich Presence with folder data
 */
async function updateDiscordPresence(folderPath: string): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');

  try {
    // Read details from details.txt
    let details = 'Music Player';
    try {
      const detailsText = await invoke<string>('read_details_file', { directoryPath: folderPath });
      details = detailsText.trim();
    } catch (error) {
      console.warn('Failed to read details.txt, using default:', error);
    }

    // Get image filename and extract asset key
    let largeImageKey = 'music'; // Default fallback
    try {
      const imageFilename = await invoke<string>('get_image_filename', { directoryPath: folderPath });
      // Strip extension to get asset key (e.g., "rock_album.png" -> "rock_album")
      largeImageKey = imageFilename.replace(/\.(png|jpg|jpeg|gif)$/i, '');
      console.log(`Using Discord asset key: ${largeImageKey}`);
    } catch (error) {
      console.warn('No image file found, using default asset key:', error);
    }

    // Get folder name for large_text
    const folderName = folderPath.split(/[/\\]/).filter(Boolean).pop() || 'Music';

    // Update Discord presence
    await invoke('update_discord_presence', {
      details: details,
      state: 'Listening to music',
      largeImageKey: largeImageKey,
      largeImageText: folderName
    });

    console.log('Discord presence updated successfully');
  } catch (error) {
    console.error('Failed to update Discord presence:', error);
  }
}

/**
 * Toggle Discord RPC connection
 */
async function toggleDiscordRPC(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core');

  try {
    if (discordEnabled) {
      await invoke('discord_disconnect');
      discordEnabled = false;
      console.log('Discord RPC disabled');
    } else {
      // Get client ID from sessionStorage
      const clientId = sessionStorage.getItem('discord_client_id');

      if (!clientId) {
        alert('Please set your Discord Client ID in Settings first');
        navigateToSettings();
        return;
      }

      await invoke('discord_connect', { clientId });
      discordEnabled = true;
      console.log('Discord RPC enabled');

      // Update presence if we have a folder loaded
      if (currentFolderPath) {
        await updateDiscordPresence(currentFolderPath);
      }
    }

    updateDiscordButtonState();
  } catch (error) {
    console.error('Failed to toggle Discord RPC:', error);
    alert(`Failed to ${discordEnabled ? 'disable' : 'enable'} Discord RPC: ${error}`);
  }
}

/**
 * Setup player control button event listeners
 */
function setupPlayerControls(): void {
  // Play button
  playBtn?.addEventListener('click', () => {
    if (songPlayer.isPaused()) {
      songPlayer.resume().catch(error => {
        console.error('Failed to resume:', error);
      });
    } else if (currentSelectedSong) {
      const absolutePath = songManager.getAbsolutePath(currentSelectedSong);
      if (absolutePath) {
        songPlayer.play(absolutePath).catch(error => {
          console.error('Failed to play:', error);
        });
      }
    }
  });

  // Pause button
  pauseBtn?.addEventListener('click', () => {
    songPlayer.pause();
  });

  // Stop button
  stopBtn?.addEventListener('click', () => {
    songPlayer.stop();
  });

  // Previous button
  previousBtn?.addEventListener('click', () => {
    // TODO: Implement previous song
    console.log('Previous button clicked');
  });

  // Next button
  nextBtn?.addEventListener('click', () => {
    // TODO: Implement next song
    console.log('Next button clicked');
  });

  // Progress slider
  progressSlider?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const percentage = parseFloat(target.value);
    const duration = songPlayer.getDuration();

    if (duration) {
      const seekTime = (percentage / 100) * duration;
      songPlayer.seek(seekTime);
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  filePathEl = document.querySelector("#path-input");
  filePattern = document.querySelector("#pattern-input");
  fileInfoEl = document.querySelector("#file-msg");
  songListEl = document.querySelector("#song-list");

  // Get control elements
  playBtn = document.querySelector("#play-btn");
  pauseBtn = document.querySelector("#pause-btn");
  stopBtn = document.querySelector("#stop-btn");
  previousBtn = document.querySelector("#previous-btn");
  nextBtn = document.querySelector("#next-btn");

  // Get progress bar elements
  progressFill = document.querySelector("#progress-fill");
  progressSlider = document.querySelector("#progress-slider");
  currentTimeLabel = document.querySelector("#current-time");
  totalTimeLabel = document.querySelector("#total-time");

  // Get function buttons
  fn1Btn = document.querySelector("#fn-1");
  fn2Btn = document.querySelector("#fn-2");

  // Setup event listeners
  document.querySelector("#file-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    listFiles();
  });

  setupPlayerControls();

  // Setup function buttons
  fn1Btn?.addEventListener('click', () => {
    toggleDiscordRPC();
  });

  fn2Btn?.addEventListener('click', () => {
    navigateToSettings();
  });

  // Initialize Discord button state
  updateDiscordButtonState();

  // Update fn-2 button label
  if (fn2Btn) {
    fn2Btn.textContent = 'Settings';
  }
});