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

// Volume control elements
let volumeFill: HTMLElement | null;
let volumeSlider: HTMLInputElement | null;
let volumeIconBtn: HTMLButtonElement | null;
let volumeIcon: HTMLImageElement | null;

// Function buttons
let fn1Btn: HTMLButtonElement | null;
let fn2Btn: HTMLButtonElement | null;

// Current folder path
let currentFolderPath: string | null = null;

// Discord RPC enabled state
let discordEnabled: boolean = false;

// Volume state
let isMuted: boolean = false;
let previousVolume: number = 1.0;

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
    // Auto-play next song
    const nextSong = getNextSong();
    if (nextSong) {
      console.log('Auto-playing next song:', nextSong.fileName);
      playSongByFileName(nextSong.fileName);
    } else {
      console.log('End of playlist reached');
    }
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

      // Save directory path and pattern to localStorage
      localStorage.setItem('last_directory_path', path);
      localStorage.setItem('last_file_pattern', filePattern.value || '');

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
 * Get the next song in the playlist
 * @returns The next song or null if there is no next song
 */
function getNextSong(): Song | null {
  const songs = songManager.getAllSongs();
  if (songs.length === 0 || !currentSelectedSong) return null;

  const currentIndex = songs.findIndex(song => song.fileName === currentSelectedSong);
  if (currentIndex === -1) return null;

  const nextIndex = currentIndex + 1;
  if (nextIndex >= songs.length) return null; // End of playlist

  return songs[nextIndex];
}

/**
 * Get the previous song in the playlist
 * @returns The previous song or null if there is no previous song
 */
function getPreviousSong(): Song | null {
  const songs = songManager.getAllSongs();
  if (songs.length === 0 || !currentSelectedSong) return null;

  const currentIndex = songs.findIndex(song => song.fileName === currentSelectedSong);
  if (currentIndex === -1) return null;

  const previousIndex = currentIndex - 1;
  if (previousIndex < 0) return null; // Beginning of playlist

  return songs[previousIndex];
}

/**
 * Play a song by its filename and update the UI
 * @param fileName The file name of the song to play
 */
function playSongByFileName(fileName: string): void {
  if (!songListEl) return;

  // Remove active class from previously selected song
  const previousActive = songListEl.querySelector('.song-item.active');
  previousActive?.classList.remove('active');

  // Find and activate the new song item
  const songItems = songListEl.querySelectorAll('.song-item');
  songItems.forEach(item => {
    if (item.getAttribute('data-file-name') === fileName) {
      item.classList.add('active');
    }
  });

  // Update current selected song
  currentSelectedSong = fileName;

  // Get the absolute path and play
  const absolutePath = songManager.getAbsolutePath(fileName);
  if (absolutePath) {
    songPlayer.play(absolutePath).catch(error => {
      console.error('Failed to play song:', error);
    });
  }
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
    fn1Btn.style.filter = 'drop-shadow(0 0 1em var(--md-sys-color-primary))';
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
      // Get client ID from localStorage (persists across sessions)
      const clientId = localStorage.getItem('discord_client_id');

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
    const previousSong = getPreviousSong();
    if (previousSong) {
      playSongByFileName(previousSong.fileName);
    } else {
      console.log('No previous song available');
    }
  });

  // Next button
  nextBtn?.addEventListener('click', () => {
    const nextSong = getNextSong();
    if (nextSong) {
      playSongByFileName(nextSong.fileName);
    } else {
      console.log('No next song available');
    }
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

/**
 * Update the volume icon based on current volume level
 */
function updateVolumeIcon(volume: number): void {
  if (!volumeIcon) return;

  if (volume === 0 || isMuted) {
    volumeIcon.src = '/assets/icons/volume_off_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  } else if (volume < 0.5) {
    volumeIcon.src = '/assets/icons/volume_down_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  } else {
    volumeIcon.src = '/assets/icons/volume_up_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg';
  }
}

/**
 * Update the volume bar fill based on current volume
 */
function updateVolumeBar(volume: number): void {
  if (!volumeFill || !volumeSlider) return;

  const percentage = volume * 100;
  volumeFill.style.width = `${percentage}%`;
  volumeSlider.value = percentage.toString();
}

/**
 * Set the volume and update UI
 */
function setVolume(volume: number): void {
  songPlayer.setVolume(volume);
  updateVolumeBar(volume);
  updateVolumeIcon(volume);

  // Save to localStorage
  localStorage.setItem('volume_level', volume.toString());
}

/**
 * Toggle mute/unmute
 */
function toggleMute(): void {
  if (isMuted) {
    // Unmute
    isMuted = false;
    setVolume(previousVolume);
  } else {
    // Mute
    isMuted = true;
    previousVolume = songPlayer.getVolume();
    setVolume(0);
  }
}

/**
 * Setup volume control event listeners
 */
function setupVolumeControls(): void {
  // Volume slider
  volumeSlider?.addEventListener('input', (e) => {
    const target = e.target as HTMLInputElement;
    const percentage = parseFloat(target.value);
    const volume = percentage / 100;

    isMuted = false;
    setVolume(volume);
  });

  // Volume icon button (mute/unmute)
  volumeIconBtn?.addEventListener('click', () => {
    toggleMute();
  });
}

/**
 * Load saved settings from localStorage
 */
function loadSavedSettings(): void {
  // Load directory path
  const savedPath = localStorage.getItem('last_directory_path');
  if (savedPath && filePathEl) {
    filePathEl.value = savedPath;
  }

  // Load file pattern
  const savedPattern = localStorage.getItem('last_file_pattern');
  if (savedPattern && filePattern) {
    filePattern.value = savedPattern;
  }

  // Load volume level
  const savedVolume = localStorage.getItem('volume_level');
  if (savedVolume) {
    const volume = parseFloat(savedVolume);
    if (!isNaN(volume) && volume >= 0 && volume <= 1) {
      setVolume(volume);
    }
  } else {
    // Default volume is 100%
    setVolume(1.0);
  }
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

  // Get volume control elements
  volumeFill = document.querySelector("#volume-fill");
  volumeSlider = document.querySelector("#volume-slider");
  volumeIconBtn = document.querySelector("#volume-icon-btn");
  volumeIcon = document.querySelector("#volume-icon");

  // Get function buttons
  fn1Btn = document.querySelector("#fn-1");
  fn2Btn = document.querySelector("#fn-2");

  // Setup event listeners
  document.querySelector("#file-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    listFiles();
  });

  setupPlayerControls();
  setupVolumeControls();

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

  // Load saved settings from localStorage
  loadSavedSettings();
});

/**
 * Cleanup resources when the page is about to unload
 */
window.addEventListener('beforeunload', () => {
  // Dispose of the song player and free blob URLs
  songPlayer.dispose();
});