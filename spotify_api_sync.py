import os
import sqlite3
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import CacheFileHandler
from dotenv import load_dotenv

# Load Environment Variables from .env file
load_dotenv()

# Configuration
DB_PATH = 'spotify_intelligence.db'
# You will need to create a .env file with SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, and SPOTIPY_REDIRECT_URI
SCOPE = "user-read-recently-played user-top-read"

def get_spotify_client():
    """Initializes and returns the Spotipy client with OAuth."""
    cache_handler = CacheFileHandler(cache_path='.spotipy_cache')
    auth_manager = SpotifyOAuth(
        scope=SCOPE,
        cache_handler=cache_handler,
        show_dialog=True
    )
    return spotipy.Spotify(auth_manager=auth_manager)

def sync_recently_played(sp, cursor, conn):
    """Fetches the 50 most recently played tracks and syncs to DB."""
    print("--- Starting Recently Played Sync ---")
    
    try:
        results = sp.current_user_recently_played(limit=50)
        items = results.get('items', [])
        
        if not items:
            print("No recently played tracks found.")
            return

        print(f"Fetched {len(items)} recently played tracks from Spotify.")
        
        new_sessions = 0
        new_tracks = 0
        
        for item in reversed(items): # Process oldest to newest
            track = item.get('track')
            if not track: continue
            
            track_uri = track.get('uri')
            played_at_str = item.get('played_at')
            
            # Format date from ISO 8601 to SQLite format
            from datetime import datetime
            try:
                # API returns e.g. '2026-02-27T14:32:10.000Z'
                # Strip fractional seconds and Z for parsing if necessary, or use fromisoformat
                dt = datetime.strptime(played_at_str[:19], "%Y-%m-%dT%H:%M:%S")
                played_at = dt.strftime("%Y-%m-%d %H:%M:%S")
            except Exception as e:
                print(f"Error parsing date {played_at_str}: {e}")
                continue
                
            # 1. Ensure Track Exists in tracks table
            cursor.execute('SELECT track_uri FROM tracks WHERE track_uri = ?', (track_uri,))
            if not cursor.fetchone():
                cursor.execute('''
                    INSERT INTO tracks (track_uri, track_name, artist_name, album_name)
                    VALUES (?, ?, ?, ?)
                ''', (
                    track_uri,
                    track.get('name'),
                    track['artists'][0]['name'] if track.get('artists') else 'Unknown',
                    track['album']['name'] if track.get('album') else 'Unknown'
                ))
                new_tracks += 1
                
            # 2. Add Session if not already present
            cursor.execute('SELECT id FROM streaming_history WHERE track_uri = ? AND played_at = ?', (track_uri, played_at))
            if not cursor.fetchone():
                # We don't get ms_played dynamically from this endpoint unfortunately, so we store duration
                ms_played = track.get('duration_ms', 0) 
                
                cursor.execute('''
                    INSERT INTO streaming_history (
                        played_at, ms_played, track_uri, platform, reason_start, reason_end
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    played_at,
                    ms_played,
                    track_uri,
                    'Spotify API Sync',
                    'api',
                    'api'
                ))
                new_sessions += 1
                
        conn.commit()
        print(f"Sync complete. Added {new_sessions} new listening sessions and {new_tracks} new tracks.")
        
    except Exception as e:
        print(f"Error fetching recently played data: {e}")

def main():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found.")
        return

    print("Authenticating with Spotify...")
    try:
        sp = get_spotify_client()
        # Test connection by getting current user
        user = sp.current_user()
        print(f"Successfully authenticated as: {user['id']}")
    except spotipy.oauth2.SpotifyOauthError as e:
        print(f"Authentication Failed. Ensure your .env file is configured correctly.\n{e}")
        return
    except Exception as e:
         print(f"An error occurred during setup: {e}")
         return


    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Run the Sync Engine
    sync_recently_played(sp, cursor, conn)
    
    conn.close()

if __name__ == "__main__":
    main()
