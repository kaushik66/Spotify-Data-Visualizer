import { db } from "@/lib/db";
import DashboardClient from "@/components/DashboardClient";
import { getTopArtists, getTopTracks } from "@/app/actions/spotify";

export default async function Home() {
  // 1. Fetch Last Listened Track (from DB or could be API later)
  const lastListened = db.prepare(`
    SELECT t.track_name, t.artist_name, s.played_at 
    FROM streaming_history s 
    JOIN tracks t ON s.track_uri = t.track_uri 
    ORDER BY s.played_at DESC 
    LIMIT 1
  `).get() as { track_name: string; artist_name: string; played_at: string } | undefined;

  // 2. Fetch Live Spotify Data for HeroLayout
  const liveTopArtists = await getTopArtists('short_term');
  const liveTopTracks = await getTopTracks('short_term');

  // 3. Fetch Top Albums (SQLite fallback)
  const topAlbums = db.prepare(`
    SELECT t.album_name, t.artist_name, COUNT(*) as plays 
    FROM streaming_history s 
    JOIN tracks t ON s.track_uri = t.track_uri 
    WHERE t.album_name != 'Unknown Album' AND t.album_name IS NOT NULL
    GROUP BY t.album_name 
    ORDER BY plays DESC 
    LIMIT 5
  `).all() as { album_name: string; artist_name: string; plays: number }[];

  // 2c. Fetch Top Genres (Mocking for now as we didn't populate genres API yet, but querying the column space)
  const topGenres = db.prepare(`
    SELECT genres, COUNT(*) as plays 
    FROM streaming_history s 
    JOIN tracks t ON s.track_uri = t.track_uri 
    WHERE t.genres IS NOT NULL AND t.genres != ''
    GROUP BY t.genres 
    ORDER BY plays DESC 
    LIMIT 5
  `).all() as { genres: string; plays: number }[];

  // 3. Fetch Listening Trends (Rolling 14 Days)
  // Get latest date to base 14 days off, so it always looks populated even if there's a gap
  const latestDateRow = db.prepare(`SELECT date(played_at) as latest_date FROM streaming_history ORDER BY played_at DESC LIMIT 1`).get() as { latest_date: string } | undefined;
  let trends: { date: string; count: number }[] = [];
  
  if (latestDateRow) {
      trends = db.prepare(`
        SELECT date(played_at) as date, COUNT(*) as count 
        FROM streaming_history 
        WHERE date(played_at) >= date(?, '-14 days')
        GROUP BY date(played_at) 
        ORDER BY date(played_at) ASC
      `).all(latestDateRow.latest_date) as { date: string; count: number }[];
  }

  return (
    <main className="min-h-screen p-8 relative flex flex-col items-center">
      {/* Absolute positioning for the animated background using CSS classes from globals.css */}
      <div className="liquid-bg" />
      
      <div className="w-full max-w-6xl z-10 flex flex-col gap-8">
        <header className="flex justify-between items-center py-4 text-white">
          <h1 className="text-3xl font-light tracking-tight opacity-90">Music <span className="font-semibold text-blue-300">Intelligence</span></h1>
        </header>
        
        <DashboardClient 
          lastListened={lastListened}
          liveTopArtists={liveTopArtists}
          liveTopTracks={liveTopTracks}
          topAlbums={topAlbums}
          topGenres={topGenres}
          trends={trends}
        />
      </div>
    </main>
  );
}
