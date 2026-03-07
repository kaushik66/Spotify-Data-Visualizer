import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getAccessToken(): string | null {
  try {
    const cachePath = path.resolve(process.cwd(), '../.spotipy_cache');
    if (fs.existsSync(cachePath)) {
      const content = fs.readFileSync(cachePath, 'utf8');
      const cache = JSON.parse(content);
      return cache.access_token || null;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  const token = getAccessToken();
  if (!token) {
    return NextResponse.json({ isPlaying: false, reason: 'no_token' });
  }

  try {
    const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });

    // 204 = nothing playing
    if (res.status === 204) {
      return NextResponse.json({ isPlaying: false, reason: 'no_content' });
    }

    // 429 = rate limited — pass the status to the client so SWR can back off
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || '5';
      return NextResponse.json(
        { isPlaying: false, reason: 'rate_limited', retryAfter: parseInt(retryAfter, 10) },
        { status: 429 }
      );
    }

    if (!res.ok) {
      return NextResponse.json({ isPlaying: false, reason: `spotify_error_${res.status}` });
    }

    const data = await res.json();

    // Not a track (could be a podcast episode)
    if (data.currently_playing_type !== 'track' || !data.item) {
      return NextResponse.json({ isPlaying: data.is_playing || false, reason: 'not_track' });
    }

    const track = data.item;
    const images = track.album?.images || [];

    return NextResponse.json({
      isPlaying: data.is_playing || false,
      trackName: track.name,
      artistName: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
      albumName: track.album?.name || '',
      albumArt: images.length > 1 ? images[1].url : images[0]?.url || '',
      progress_ms: data.progress_ms || 0,
      duration_ms: track.duration_ms || 0,
    });
  } catch (e) {
    console.error('[NowPlaying] Fetch error:', e);
    return NextResponse.json({ isPlaying: false, reason: 'fetch_error' });
  }
}
