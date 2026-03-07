import os
import sqlite3
import time
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from spotipy.cache_handler import CacheFileHandler
from dotenv import load_dotenv

# Load Environment Variables from .env file
load_dotenv()

# Configuration
DB_PATH = 'spotify_intelligence.db'
# You will need to create a .env file with SPOTIPY_CLIENT_ID, SPOTIPY_CLIENT_SECRET, and SPOTIPY_REDIRECT_URI
SCOPE = "user-read-recently-played user-top-read user-read-currently-playing"

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

def prewarm_image_cache(sp, cursor, conn):
    """Pre-fetch and cache album art for all top artists, tracks, and albums across all time ranges."""
    print("\n--- Pre-warming Image Cache ---")
    
    # Ensure image_cache table exists
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_cache (
            id TEXT PRIMARY KEY,
            image_url TEXT,
            object_type TEXT
        )
    ''')
    conn.commit()
    
    from datetime import datetime
    
    # Define time range thresholds
    ranges = {
        'short_term': 1,   # 1 month
        'medium_term': 6,  # 6 months
        'long_term': 240,  # 20 years (all time)
    }
    
    cached_count = 0
    skipped_count = 0
    
    for range_name, months_back in ranges.items():
        d = datetime.now()
        if months_back <= 12:
            d = d.replace(month=max(1, d.month - months_back))
        else:
            d = d.replace(year=d.year - (months_back // 12))
        threshold = d.isoformat()
        
        print(f"\n  [{range_name}] Fetching top items since {threshold[:10]}...")
        
        # --- Top Artists ---
        artists = cursor.execute('''
            SELECT t.artist_name as name
            FROM streaming_history s
            JOIN tracks t ON s.track_uri = t.track_uri
            WHERE s.played_at >= ?
            GROUP BY t.artist_name
            ORDER BY SUM(s.ms_played) DESC
            LIMIT 10
        ''', (threshold,)).fetchall()
        
        for (name,) in artists:
            cache_key = f"artist:{name}"
            existing = cursor.execute('SELECT image_url FROM image_cache WHERE id = ?', (cache_key,)).fetchone()
            if existing:
                skipped_count += 1
                continue
            
            try:
                results = sp.search(q=f"artist:{name}", type='artist', limit=1)
                items = results.get('artists', {}).get('items', [])
                if items and items[0].get('images'):
                    images = items[0]['images']
                    url = images[1]['url'] if len(images) > 1 else images[0]['url']
                    cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                   (cache_key, url, 'artist'))
                    cached_count += 1
                    print(f"    ✓ Cached artist: {name}")
                else:
                    print(f"    ✗ No image for artist: {name}")
                time.sleep(0.1)  # Rate limit safety
            except Exception as e:
                print(f"    ✗ Error fetching artist {name}: {e}")
                time.sleep(1)
        
        # --- Top Tracks ---
        tracks = cursor.execute('''
            SELECT t.track_name as name, t.artist_name as artist, t.track_uri as uri
            FROM streaming_history s
            JOIN tracks t ON s.track_uri = t.track_uri
            WHERE s.played_at >= ?
            GROUP BY t.track_uri
            ORDER BY SUM(s.ms_played) DESC
            LIMIT 10
        ''', (threshold,)).fetchall()
        
        for (name, artist, uri) in tracks:
            track_id = uri.split(':')[-1] if uri else None
            cache_key = f"track:{track_id or name + artist}"
            existing = cursor.execute('SELECT image_url FROM image_cache WHERE id = ?', (cache_key,)).fetchone()
            if existing:
                skipped_count += 1
                continue
            
            try:
                if track_id:
                    track_data = sp.track(track_id)
                    if track_data and track_data.get('album', {}).get('images'):
                        images = track_data['album']['images']
                        url = images[1]['url'] if len(images) > 1 else images[0]['url']
                        cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                       (cache_key, url, 'track'))
                        cached_count += 1
                        print(f"    ✓ Cached track: {name} by {artist}")
                        time.sleep(0.1)
                        continue
                
                # Fallback: search
                results = sp.search(q=f"track:{name} artist:{artist}", type='track', limit=1)
                items = results.get('tracks', {}).get('items', [])
                if items and items[0].get('album', {}).get('images'):
                    images = items[0]['album']['images']
                    url = images[1]['url'] if len(images) > 1 else images[0]['url']
                    cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                   (cache_key, url, 'track'))
                    cached_count += 1
                    print(f"    ✓ Cached track: {name} by {artist}")
                else:
                    print(f"    ✗ No image for track: {name} by {artist}")
                time.sleep(0.1)
            except Exception as e:
                print(f"    ✗ Error fetching track {name}: {e}")
                time.sleep(1)
        
        # --- Top Albums ---
        albums = cursor.execute('''
            SELECT t.album_name as name, t.artist_name as artist
            FROM streaming_history s
            JOIN tracks t ON s.track_uri = t.track_uri
            WHERE s.played_at >= ?
              AND t.album_name IS NOT NULL
              AND t.album_name != 'Unknown Album'
              AND t.album_name != ''
            GROUP BY t.album_name
            ORDER BY SUM(s.ms_played) DESC
            LIMIT 10
        ''', (threshold,)).fetchall()
        
        for (name, artist) in albums:
            cache_key = f"album:{name}:{artist}"
            existing = cursor.execute('SELECT image_url FROM image_cache WHERE id = ?', (cache_key,)).fetchone()
            if existing:
                skipped_count += 1
                continue
            
            try:
                results = sp.search(q=f"album:{name} artist:{artist}", type='album', limit=1)
                items = results.get('albums', {}).get('items', [])
                if items and items[0].get('images'):
                    images = items[0]['images']
                    url = images[1]['url'] if len(images) > 1 else images[0]['url']
                    cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                   (cache_key, url, 'album'))
                    cached_count += 1
                    print(f"    ✓ Cached album: {name} by {artist}")
                else:
                    # Fallback: plain search
                    results = sp.search(q=name, type='album', limit=1)
                    items = results.get('albums', {}).get('items', [])
                    if items and items[0].get('images'):
                        images = items[0]['images']
                        url = images[1]['url'] if len(images) > 1 else images[0]['url']
                        cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                       (cache_key, url, 'album'))
                        cached_count += 1
                        print(f"    ✓ Cached album (fallback): {name}")
                    else:
                        print(f"    ✗ No image for album: {name} by {artist}")
                time.sleep(0.1)
            except Exception as e:
                print(f"    ✗ Error fetching album {name}: {e}")
                time.sleep(1)
    
    # --- Recently Played (top 5) ---
    print(f"\n  [recently_played] Fetching recent tracks...")
    recent = cursor.execute('''
        SELECT t.track_name, t.artist_name, t.track_uri
        FROM streaming_history s
        JOIN tracks t ON s.track_uri = t.track_uri
        ORDER BY s.played_at DESC
        LIMIT 5
    ''').fetchall()
    
    for (name, artist, uri) in recent:
        track_id = uri.split(':')[-1] if uri else None
        cache_key = f"track:{track_id or name + artist}"
        existing = cursor.execute('SELECT image_url FROM image_cache WHERE id = ?', (cache_key,)).fetchone()
        if existing:
            skipped_count += 1
            continue
        
        try:
            if track_id:
                track_data = sp.track(track_id)
                if track_data and track_data.get('album', {}).get('images'):
                    images = track_data['album']['images']
                    url = images[1]['url'] if len(images) > 1 else images[0]['url']
                    cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                                   (cache_key, url, 'track'))
                    cached_count += 1
                    print(f"    ✓ Cached recent: {name} by {artist}")
                    time.sleep(0.1)
                    continue
            
            results = sp.search(q=f"track:{name} artist:{artist}", type='track', limit=1)
            items = results.get('tracks', {}).get('items', [])
            if items and items[0].get('album', {}).get('images'):
                images = items[0]['album']['images']
                url = images[1]['url'] if len(images) > 1 else images[0]['url']
                cursor.execute('INSERT OR REPLACE INTO image_cache (id, image_url, object_type) VALUES (?, ?, ?)',
                               (cache_key, url, 'track'))
                cached_count += 1
                print(f"    ✓ Cached recent: {name} by {artist}")
            time.sleep(0.1)
        except Exception as e:
            print(f"    ✗ Error fetching recent track {name}: {e}")
            time.sleep(1)
    
    conn.commit()
    print(f"\n✅ Image cache complete. Cached {cached_count} new images, skipped {skipped_count} already cached.")

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
    
    # Pre-warm image cache for all dashboard views
    prewarm_image_cache(sp, cursor, conn)
    
    conn.close()

if __name__ == "__main__":
    main()
