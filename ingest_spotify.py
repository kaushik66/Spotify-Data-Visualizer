import os
import json
import sqlite3
from datetime import datetime

# Configuration
DATA_DIR = '/Users/kaushikdas/Downloads/Spotify Extended Streaming History'
DB_PATH = 'spotify_intelligence.db'

def create_db_schema(cursor):
    # Create tracks table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS tracks (
        track_uri TEXT PRIMARY KEY,
        track_name TEXT,
        artist_name TEXT,
        album_name TEXT,
        tempo REAL,
        valence REAL,
        energy REAL,
        danceability REAL,
        acousticness REAL,
        instrumentalness REAL,
        liveness REAL,
        speechiness REAL,
        genres TEXT
    )
    ''')

    # Create streaming_history table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS streaming_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        played_at DATETIME,
        ms_played INTEGER,
        track_uri TEXT,
        platform TEXT,
        conn_country TEXT,
        reason_start TEXT,
        reason_end TEXT,
        shuffle BOOLEAN,
        skipped BOOLEAN,
        offline BOOLEAN,
        offline_timestamp BIGINT,
        FOREIGN KEY(track_uri) REFERENCES tracks(track_uri)
    )
    ''')
    
    # Create indexes
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_played_at ON streaming_history(played_at)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_track_uri ON streaming_history(track_uri)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_skipped ON streaming_history(skipped)')

def parse_iso_time(iso_str):
    """Convert ISO ts into standard SQLite DATETIME (YYYY-MM-DD HH:MM:SS)"""
    try:
        # Example format: 2020-11-19T17:08:24Z
        dt = datetime.strptime(iso_str, "%Y-%m-%dT%H:%M:%SZ")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except Exception as e:
        print(f"Error parsing date {iso_str}: {e}")
        return None

def main():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH) # Start fresh for now based on instructions
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    create_db_schema(cursor)
    
    unique_tracks = set()
    total_sessions_imported = 0
    total_records_processed = 0

    print(f"Scanning directory: {DATA_DIR}")
    for filename in os.listdir(DATA_DIR):
        if filename.startswith('Streaming_History_Audio') and filename.endswith('.json'):
            file_path = os.path.join(DATA_DIR, filename)
            print(f"Processing: {filename}...")
            
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            for record in data:
                total_records_processed += 1
                
                track_uri = record.get('spotify_track_uri')
                ms_played = record.get('ms_played', 0)
                
                # Filters
                if not track_uri or ms_played < 30000:
                    continue
                
                # Setup Track
                if track_uri not in unique_tracks:
                    cursor.execute('''
                        INSERT OR IGNORE INTO tracks (track_uri, track_name, artist_name, album_name)
                        VALUES (?, ?, ?, ?)
                    ''', (
                        track_uri,
                        record.get('master_metadata_track_name'),
                        record.get('master_metadata_album_artist_name'),
                        record.get('master_metadata_album_album_name')
                    ))
                    unique_tracks.add(track_uri)
                
                # Format Date
                played_at = parse_iso_time(record.get('ts'))
                
                # Insert Session
                cursor.execute('''
                    INSERT INTO streaming_history (
                        played_at, ms_played, track_uri, platform, conn_country, 
                        reason_start, reason_end, shuffle, skipped, offline, offline_timestamp
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    played_at,
                    ms_played,
                    track_uri,
                    record.get('platform'),
                    record.get('conn_country'),
                    record.get('reason_start'),
                    record.get('reason_end'),
                    record.get('shuffle'),
                    record.get('skipped'),
                    record.get('offline'),
                    record.get('offline_timestamp')
                ))
                total_sessions_imported += 1
                
    conn.commit()
    
    print("\n--- Validation Statistics ---")
    print(f"Total Unique Tracks Found: {len(unique_tracks)}")
    print(f"Total Listening Sessions Imported: {total_sessions_imported}")
    print(f"Total Raw Records Processed: {total_records_processed}")
    
    print("\n--- Sample 5 Rows from Tracks Table ---")
    cursor.execute('SELECT track_uri, track_name, artist_name, genres FROM tracks LIMIT 5')
    for row in cursor.fetchall():
        print(row)
        
    print("\n--- Sample 5 Rows from Streaming History Table ---")
    cursor.execute('SELECT id, played_at, ms_played, track_uri, offline FROM streaming_history LIMIT 5')
    for row in cursor.fetchall():
        print(row)
        
    conn.close()

if __name__ == "__main__":
    main()
