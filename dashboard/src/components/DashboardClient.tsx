"use client";

import { motion, Variants } from "framer-motion";
import { Disc, Clock, MessageCircle } from "lucide-react";
import Image from "next/image";
import HeroLeaderLayout from "@/components/HeroLeaderLayout";
import { getTopArtists, getTopTracks, getTopAlbums, RecentTrack, SpotifyItem } from "@/app/actions/spotify";

interface DashboardClientProps {
  lastListened?: { track_name: string; artist_name: string; played_at: string };
  liveTopArtists: SpotifyItem[];
  liveTopTracks: SpotifyItem[];
  liveTopAlbums: SpotifyItem[];
  recentlyPlayed: RecentTrack[];
}

export default function DashboardClient({ lastListened, liveTopArtists, liveTopTracks, liveTopAlbums, recentlyPlayed }: DashboardClientProps) {
  
  const container: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const item: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show" 
      className="grid grid-cols-1 md:grid-cols-3 gap-6"
    >
      
      {/* Hero: Last Listened */}
      <motion.div variants={item} className="md:col-span-1 glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-indigo-400/30 transition-all duration-700" />
        
        <div className="flex items-center gap-3 text-indigo-200">
          <Disc className="w-6 h-6 animate-spin-slow opacity-80" />
          <h2 className="text-sm font-medium uppercase tracking-widest opacity-80">Last Listened</h2>
        </div>

        {lastListened ? (
          <div className="mt-auto">
            <h3 className="text-2xl font-semibold text-white mb-1 line-clamp-2">{lastListened.track_name}</h3>
            <p className="text-indigo-100/70 text-lg">{lastListened.artist_name}</p>
            <p className="text-xs text-white/30 mt-4">{new Date(lastListened.played_at).toISOString().replace('T', ', ').substring(0, 19)}</p>
          </div>
        ) : (
          <p className="text-white/50 mt-auto">No history found.</p>
        )}
      </motion.div>

      {/* Recently Played — horizontal strip, newest on the left */}
      <motion.div variants={item} className="md:col-span-2 glass-panel p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2 text-indigo-200">
          <Clock className="w-5 h-5 opacity-80" />
          <h2 className="text-sm font-medium uppercase tracking-widest opacity-80">Recently Played</h2>
        </div>

        <div className="flex flex-row gap-4 items-start w-full overflow-hidden">
          {recentlyPlayed.map((track, i) => (
            <motion.div
              key={track.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, type: "spring", stiffness: 300, damping: 24 }}
              className="flex flex-col items-center flex-1 min-w-0 group cursor-default"
            >
              {/* Album Art */}
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg bg-indigo-950/40 group-hover:border-indigo-400/40 transition-colors group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                {track.imageUrl ? (
                  <Image
                    src={track.imageUrl}
                    alt={track.track_name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="20vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Disc className="w-8 h-8 text-indigo-400/40 animate-spin-slow" />
                  </div>
                )}
                {/* Position badge — newest = 1 */}
                {i === 0 && (
                  <div className="absolute top-1.5 left-1.5 bg-indigo-500/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                    Latest
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="mt-2 w-full text-center px-0.5">
                <p className="text-xs font-semibold text-white/90 truncate leading-tight">{track.track_name}</p>
                <p className="text-[10px] text-indigo-300/60 uppercase tracking-wider truncate mt-0.5">{track.artist_name}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Top Artists */}
      <motion.div variants={item} className="md:col-span-3">
         <HeroLeaderLayout 
           title="Top Artists" 
           initialItems={liveTopArtists} 
           fetchAction={getTopArtists} 
         />
      </motion.div>

      {/* Top Tracks */}
      <motion.div variants={item} className="md:col-span-3">
         <HeroLeaderLayout 
           title="Top Tracks" 
           initialItems={liveTopTracks} 
           fetchAction={getTopTracks} 
         />
      </motion.div>

      {/* Top Albums — same Hero-Leader style */}
      <motion.div variants={item} className="md:col-span-3">
         <HeroLeaderLayout 
           title="Top Albums" 
           initialItems={liveTopAlbums} 
           fetchAction={getTopAlbums} 
         />
      </motion.div>

      {/* Floating AI Assistant Chat */}
      <motion.div variants={item} className="md:col-span-3 mt-4">
        <div className="glass-panel p-4 flex items-center gap-4 hover:bg-white/10 transition-colors cursor-text group shadow-lg shadow-indigo-500/5">
          <MessageCircle className="w-6 h-6 text-indigo-300 group-hover:text-indigo-200 transition-colors" />
          <input 
            type="text" 
            placeholder="Ask Aura AI about your music..."
            className="bg-transparent border-none outline-none text-white w-full placeholder:text-indigo-200/50 text-lg font-light"
            disabled
          />
        </div>
      </motion.div>

    </motion.div>
  );
}


