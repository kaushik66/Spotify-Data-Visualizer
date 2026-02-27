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
SCOPE = "user-read-recently-played"

def get_spotify_client():
    """Initializes and returns the Spotipy client with OAuth."""
    cache_handler = CacheFileHandler(cache_path='.spotipy_cache')
    auth_manager = SpotifyOAuth(
        scope=SCOPE,
        cache_handler=cache_handler,
        show_dialog=True
    )
    return spotipy.Spotify(auth_manager=auth_manager)

def enrich_audio_features(sp, cursor, conn):
    """Fetches missing audio features in batches of 100."""
    print("--- Starting Audio Feature Enrichment ---")
    
    # 1. Find tracks missing audio features
    cursor.execute('SELECT track_uri FROM tracks WHERE tempo IS NULL')
    missing_tracks = [row[0] for row in cursor.fetchall()]
    
    total_missing = len(missing_tracks)
    print(f"Found {total_missing} tracks needing audio features.")
    
    if total_missing == 0:
        return

    # Spotify API limits audio-features array to 100 IDs per request
    batch_size = 100
    processed_count = 0

    for i in range(0, total_missing, batch_size):
        batch_uris = missing_tracks[i:i + batch_size]
        # Spotipy's audio_features takes fully qualified URIs or IDs
        try:
            features_data = sp.audio_features(tracks=batch_uris)
            
            for feature in features_data:
                if feature is None:
                    continue # Track might not have features available
                    
                uri = feature['uri']
                cursor.execute('''
                    UPDATE tracks
                    SET tempo = ?, valence = ?, energy = ?, danceability = ?, 
                        acousticness = ?, instrumentalness = ?, liveness = ?, speechiness = ?
                    WHERE track_uri = ?
                ''', (
                    feature['tempo'], feature['valence'], feature['energy'],
                    feature['danceability'], feature['acousticness'], feature['instrumentalness'],
                    feature['liveness'], feature['speechiness'], uri
                ))
            
            conn.commit()
            processed_count += len(batch_uris)
            print(f"Processed {processed_count}/{total_missing} tracks...")
            
        except Exception as e:
            print(f"Error fetching batch: {e}")
            
    print("Enrichment complete.")

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
    
    # Run the Enrichment Engine
    enrich_audio_features(sp, cursor, conn)
    
    conn.close()

if __name__ == "__main__":
    main()
