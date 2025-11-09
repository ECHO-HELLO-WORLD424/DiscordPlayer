import { invoke } from "@tauri-apps/api/core";

export interface Song {
  fileName: string;
  absolutePath: string;
}

export class SongManager {
  private songs: Map<string, string> = new Map(); // fileName -> absolutePath
  private songList: Song[] = [];

  /**
   * List files from a directory and build the song list
   * @param directoryPath The directory path to search
   * @param pattern Optional regex pattern to filter files
   * @returns Array of songs found
   */
  async listFiles(directoryPath: string, pattern?: string): Promise<Song[]> {
    try {
      // Normalize the directory path (remove trailing slash if present)
      const normalizedPath = directoryPath.endsWith('/') || directoryPath.endsWith('\\')
        ? directoryPath.slice(0, -1)
        : directoryPath;

      // Invoke the Tauri command to list files
      const fileNames: string[] = await invoke("list_files", {
        path: normalizedPath,
        pattern: pattern || ".*" // Default to match all files
      });

      // Clear existing songs
      this.songs.clear();
      this.songList = [];

      // Build the song list with absolute paths
      for (const fileName of fileNames) {
        const absolutePath = this.joinPath(normalizedPath, fileName);
        this.songs.set(fileName, absolutePath);
        this.songList.push({
          fileName,
          absolutePath
        });
      }

      return this.songList;
    } catch (error) {
      console.error("Error listing files:", error);
      throw error;
    }
  }

  /**
   * Get the absolute path for a file name
   * @param fileName The file name to look up
   * @returns The absolute path or undefined if not found
   */
  getAbsolutePath(fileName: string): string | undefined {
    return this.songs.get(fileName);
  }

  /**
   * Get all songs in the current list
   * @returns Array of all songs
   */
  getAllSongs(): Song[] {
    return [...this.songList];
  }

  /**
   * Get the total number of songs
   * @returns The number of songs in the list
   */
  getCount(): number {
    return this.songList.length;
  }

  /**
   * Clear the song list
   */
  clear(): void {
    this.songs.clear();
    this.songList = [];
  }

  /**
   * Join directory path and file name to create absolute path
   * Handles both Windows and Unix path separators
   * @param directoryPath The directory path
   * @param fileName The file name
   * @returns The joined absolute path
   */
  private joinPath(directoryPath: string, fileName: string): string {
    // Detect the path separator based on the directory path
    const separator = directoryPath.includes('\\') ? '\\' : '/';
    return `${directoryPath}${separator}${fileName}`;
  }
}
