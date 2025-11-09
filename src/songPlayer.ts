import { invoke } from "@tauri-apps/api/core";

export enum PlayerState {
  IDLE = "idle",
  PLAYING = "playing",
  PAUSED = "paused",
  STOPPED = "stopped",
  LOADING = "loading"
}

export interface PlayerCallbacks {
  onStateChange?: (state: PlayerState) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onSongEnd?: () => void;
  onError?: (error: string) => void;
  onLoadComplete?: (duration: number) => void;
}

export class SongPlayer {
  private audio: HTMLAudioElement;
  private currentFilePath: string | null = null;
  private currentBlobUrl: string | null = null;
  private state: PlayerState = PlayerState.IDLE;
  private callbacks: PlayerCallbacks = {};

  constructor(callbacks?: PlayerCallbacks) {
    this.audio = new Audio();
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.setupEventListeners();
  }

  /**
   * Setup event listeners for the audio element
   */
  private setupEventListeners(): void {
    // Time update event
    this.audio.addEventListener('timeupdate', () => {
      if (this.callbacks.onTimeUpdate) {
        this.callbacks.onTimeUpdate(
          this.audio.currentTime,
          this.audio.duration || 0
        );
      }
    });

    // Song ended event
    this.audio.addEventListener('ended', () => {
      this.setState(PlayerState.STOPPED);
      if (this.callbacks.onSongEnd) {
        this.callbacks.onSongEnd();
      }
    });

    // Error event
    this.audio.addEventListener('error', (e) => {
      const errorMessage = `Audio error: ${this.audio.error?.message || 'Unknown error'}`;
      console.error(errorMessage, e);
      this.setState(PlayerState.STOPPED);
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
    });

    // Loaded metadata event
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.callbacks.onLoadComplete) {
        this.callbacks.onLoadComplete(this.audio.duration);
      }
    });

    // Can play event
    this.audio.addEventListener('canplay', () => {
      if (this.state === PlayerState.LOADING) {
        this.setState(PlayerState.PLAYING);
      }
    });

    // Pause event
    this.audio.addEventListener('pause', () => {
      if (this.state === PlayerState.PLAYING) {
        this.setState(PlayerState.PAUSED);
      }
    });

    // Play event
    this.audio.addEventListener('play', () => {
      this.setState(PlayerState.PLAYING);
    });
  }

  /**
   * Update the player state and notify callbacks
   */
  private setState(state: PlayerState): void {
    this.state = state;
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange(state);
    }
  }

  /**
   * Play a song from the given file path
   * @param filePath Absolute path to the audio file
   */
  async play(filePath: string): Promise<void> {
    try {
      // Stop current playback if any
      this.stop();

      this.setState(PlayerState.LOADING);
      this.currentFilePath = filePath;

      // Read the audio file as bytes from Tauri backend
      const audioBytes = await invoke<number[]>("read_audio_file", { path: filePath });

      // Convert to Uint8Array and create a blob
      const uint8Array = new Uint8Array(audioBytes);

      // Detect MIME type based on file extension
      const extension = filePath.split('.').pop()?.toLowerCase();
      const mimeType = this.getMimeType(extension || '');

      const blob = new Blob([uint8Array], { type: mimeType });

      // Revoke previous blob URL if it exists
      if (this.currentBlobUrl) {
        URL.revokeObjectURL(this.currentBlobUrl);
      }

      // Create a blob URL
      this.currentBlobUrl = URL.createObjectURL(blob);

      // Set the source and load
      this.audio.src = this.currentBlobUrl;
      this.audio.load();

      // Start playback
      await this.audio.play();
    } catch (error) {
      const errorMessage = `Failed to play: ${error}`;
      console.error(errorMessage);
      this.setState(PlayerState.STOPPED);
      if (this.callbacks.onError) {
        this.callbacks.onError(errorMessage);
      }
      throw error;
    }
  }

  /**
   * Get MIME type based on file extension
   * @param extension File extension (without dot)
   * @returns MIME type string
   */
  private getMimeType(extension: string): string {
    const mimeTypes: Record<string, string> = {
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'ogg': 'audio/ogg',
      'flac': 'audio/flac',
      'aac': 'audio/aac',
      'm4a': 'audio/mp4',
      'opus': 'audio/opus',
      'webm': 'audio/webm',
    };
    return mimeTypes[extension] || 'audio/mpeg';
  }

  /**
   * Pause the current playback
   */
  pause(): void {
    if (this.state === PlayerState.PLAYING) {
      this.audio.pause();
      this.setState(PlayerState.PAUSED);
    }
  }

  /**
   * Resume playback from paused state
   */
  async resume(): Promise<void> {
    if (this.state === PlayerState.PAUSED) {
      try {
        await this.audio.play();
        this.setState(PlayerState.PLAYING);
      } catch (error) {
        const errorMessage = `Failed to resume: ${error}`;
        console.error(errorMessage);
        if (this.callbacks.onError) {
          this.callbacks.onError(errorMessage);
        }
        throw error;
      }
    }
  }

  /**
   * Stop playback completely and reset position
   */
  stop(): void {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.setState(PlayerState.STOPPED);
  }

  /**
   * Clear and reset to default state
   */
  clear(): void {
    this.stop();
    this.audio.src = '';
    this.currentFilePath = null;

    // Revoke blob URL to free memory
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }

    this.setState(PlayerState.IDLE);
  }

  /**
   * Seek to a specific time in the song
   * @param time Time in seconds
   */
  seek(time: number): void {
    if (this.audio.duration && time >= 0 && time <= this.audio.duration) {
      this.audio.currentTime = time;
    }
  }

  /**
   * Set the volume
   * @param volume Volume level between 0.0 and 1.0
   */
  setVolume(volume: number): void {
    if (volume >= 0 && volume <= 1) {
      this.audio.volume = volume;
    }
  }

  /**
   * Get the current volume
   * @returns Volume level between 0.0 and 1.0
   */
  getVolume(): number {
    return this.audio.volume;
  }

  /**
   * Get the current playback time
   * @returns Current time in seconds
   */
  getCurrentTime(): number {
    return this.audio.currentTime;
  }

  /**
   * Get the duration of the current song
   * @returns Duration in seconds, or 0 if not loaded
   */
  getDuration(): number {
    return this.audio.duration || 0;
  }

  /**
   * Get the current player state
   * @returns Current PlayerState
   */
  getState(): PlayerState {
    return this.state;
  }

  /**
   * Get the current file path being played
   * @returns File path or null if nothing is loaded
   */
  getCurrentFilePath(): string | null {
    return this.currentFilePath;
  }

  /**
   * Check if the player is currently playing
   * @returns true if playing, false otherwise
   */
  isPlaying(): boolean {
    return this.state === PlayerState.PLAYING;
  }

  /**
   * Check if the player is paused
   * @returns true if paused, false otherwise
   */
  isPaused(): boolean {
    return this.state === PlayerState.PAUSED;
  }

  /**
   * Update callbacks
   * @param callbacks New callbacks to set
   */
  setCallbacks(callbacks: PlayerCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Dispose of the player and clean up resources
   */
  dispose(): void {
    this.clear();
    this.audio.remove();
  }
}
