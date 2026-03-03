import json
import sqlite3
import hashlib
from datetime import datetime

# Configuration
NEW_DATA_FILE = '/Users/kaushikdas/Downloads/Spotify Account Data/StreamingHistory_music_3.json'
DB_PATH = 'spotify_intelligence.db'

def generate_mock_uri(artist, track):
    """Generates a consistent pseudo-URI for tracks missing an official one."""
    seed = f"{artist}||{track}".encode('utf-8')
    hash_id = hashlib.md5(seed).hexdigest()[:22] # Spotify IDs are 22 chars
    return f"spotify:track:local_{hash_id}"

def parse_time(json_time_str):
    """Convert '2026-01-21 11:42' to '2026-01-21 11:42:00' for SQLite DATETIME."""
    try:
        dt = datetime.strptime(json_time_str, "%Y-%m-%d %H:%M")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception as e:
        print(f"Error parsing date {json_time_str}: {e}")
        return None

def merge_data():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print(f"Loading data from {NEW_DATA_FILE}...")
    try:
        with open(NEW_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except FileNotFoundError:
        print(f"Error: File not found at {NEW_DATA_FILE}")
        return

    new_tracks_added = 0
    new_sessions_added = 0
    
    print("Starting merge Process...")
    for record in data:
        ms_played = record.get('msPlayed', 0)
        
        # Skip skips (same 30s filter)
        if ms_played < 30000:
            continue
            
        artist_name = record.get('artistName', 'Unknown Artist')
        track_name = record.get('trackName', 'Unknown Track')
        played_at = parse_time(record.get('endTime'))
        
        if not played_at:
            continue
            
        # 1. Try to find the official track_uri if it already exists in the DB based on Name + Artist
        cursor.execute("SELECT track_uri FROM tracks WHERE track_name = ? AND artist_name = ?", (track_name, artist_name))
        existing_track = cursor.fetchone()
        
        if existing_track:
            track_uri = existing_track[0]
        else:
            # We don't have this track yet, and we don't have its official URI from this JSON format.
            track_uri = generate_mock_uri(artist_name, track_name)
            
            # Insert the new track with our local URI
            cursor.execute('''
                INSERT OR IGNORE INTO tracks (track_uri, track_name, artist_name, album_name)
                VALUES (?, ?, ?, ?)
            ''', (track_uri, track_name, artist_name, "Unknown Album"))
            
            # Only count it as a new track if it actually inserted
            if cursor.rowcount > 0:
                new_tracks_added += 1

        # 2. Add Session (Checking for duplicates first)
        # Check by played_at time (to the minute, since this JSON only provides precision to the minute)
        # We check a window to be safe because the other JSONs have exact seconds.
        # SQLite datetime functions can handle this. We look for records within the same minute.
        
        # Determine the start and end of the minute
        minute_start = played_at
        minute_end = played_at.replace("00", "59")
        
        cursor.execute('''
            SELECT id FROM streaming_history 
            WHERE track_uri = ? AND played_at >= ? AND played_at <= ?
        ''', (track_uri, minute_start, minute_end))
        
        if not cursor.fetchone():
            cursor.execute('''
                INSERT INTO streaming_history (
                    played_at, ms_played, track_uri, platform, reason_start, reason_end
                )
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                played_at,
                ms_played,
                track_uri,
                'Merged Account Data JSON',
                'account_data_json',
                'account_data_json'
            ))
            new_sessions_added += 1

    conn.commit()
    conn.close()
    
    print("\n--- Merge Complete ---")
    print(f"Total valid sessions in new file (>= 30s): {len([r for r in data if r.get('msPlayed', 0) >= 30000])}")
    print(f"New Sessions successfully inserted: {new_sessions_added}")
    print(f"New Tracks (with local URIs) added: {new_tracks_added}")

if __name__ == "__main__":
    merge_data()
