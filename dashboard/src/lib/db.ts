import Database from 'better-sqlite3';
import path from 'path';

// Pointing to the real database in the root folder, read-only to be extremely safe.
const dbPath = path.resolve(process.cwd(), '../spotify_intelligence.db');

export const db = new Database(dbPath);

// Types
export interface Track {
    track_uri: string;
    track_name: string;
    artist_name: string;
    album_name: string;
    tempo?: number;
    valence?: number;
    energy?: number;
    danceability?: number;
    acousticness?: number;
    instrumentalness?: number;
    liveness?: number;
    speechiness?: number;
    genres?: string;
}

export interface StreamingHistory {
    id: number;
    played_at: string;
    ms_played: number;
    track_uri: string;
    platform: string;
    conn_country: string;
    reason_start: string;
    reason_end: string;
    shuffle: boolean;
    skipped: boolean;
    offline: boolean;
    offline_timestamp: number;
}
