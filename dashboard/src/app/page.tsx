import { db } from "@/lib/db";
import DashboardClient from "@/components/DashboardClient";
import { getTopArtists, getTopTracks, getTopAlbums, getRecentlyPlayed, getLastPlayedTrack } from "@/app/actions/spotify";

export default async function Home() {
  // 1. Fetch Last Listened Track (for the small hero card fallback)
  const lastListened = await getLastPlayedTrack();

  // 2. Parallel fetch all Spotify-enriched data
  const [liveTopArtists, liveTopTracks, liveTopAlbums, recentlyPlayed] = await Promise.all([
    getTopArtists('short_term'),
    getTopTracks('short_term'),
    getTopAlbums('short_term'),
    getRecentlyPlayed(5),
  ]);

  return (
    <main className="min-h-screen p-8 relative flex flex-col items-center">
      <div className="liquid-bg" />
      
      <div className="w-full max-w-6xl z-10 flex flex-col gap-8">
        <header className="flex justify-between items-center py-4 text-white">
          <h1 className="text-3xl font-light tracking-tight opacity-90">Music <span className="font-semibold text-blue-300">Intelligence</span></h1>
        </header>
        
        <DashboardClient 
          lastListened={lastListened}
          liveTopArtists={liveTopArtists}
          liveTopTracks={liveTopTracks}
          liveTopAlbums={liveTopAlbums}
          recentlyPlayed={recentlyPlayed}
        />
      </div>
    </main>
  );
}

