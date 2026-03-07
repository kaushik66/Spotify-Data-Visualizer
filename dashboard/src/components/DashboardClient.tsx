"use client";

import { motion, Variants } from "framer-motion";
import { Disc, Clock, MessageCircle } from "lucide-react";
import Image from "next/image";
import HeroLeaderLayout from "@/components/HeroLeaderLayout";
import { getTopArtists, getTopTracks, getTopAlbums, RecentTrack, SpotifyItem } from "@/app/actions/spotify";
import LivePlayer from "@/components/LivePlayer";
import AuraChat from "@/components/AuraChat";

interface DashboardClientProps {
  lastListened?: RecentTrack | null;
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
      {/* Hero: Last Listened / Now Playing */}
      <LivePlayer fallbackData={lastListened} />

      {/* Recently Played — horizontal strip, newest on the left */}
      <motion.div variants={item} className="md:col-span-2 glass-panel p-6 flex flex-col gap-5">
        <div className="flex items-center gap-2 text-pink-200">
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
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-white/10 shadow-lg bg-pink-950/40 group-hover:border-pink-400/40 transition-colors group-hover:shadow-[0_0_20px_rgba(99,102,241,0.25)]">
                {track.imageUrl ? (
                  <Image
                    src={track.imageUrl}
                    alt={track.track_name}
                    fill
                    priority={i === 0}
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    sizes="20vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Disc className="w-8 h-8 text-pink-400/40 animate-spin-slow" />
                  </div>
                )}
                {/* Position badge — newest = 1 */}
                {i === 0 && (
                  <div className="absolute top-1.5 left-1.5 bg-pink-500/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md">
                    Latest
                  </div>
                )}
              </div>

              {/* Track info */}
              <div className="mt-2 w-full text-center px-0.5">
                <p className="text-xs font-semibold text-white/90 truncate leading-tight">{track.track_name}</p>
                <p className="text-[10px] text-pink-300/60 uppercase tracking-wider truncate mt-0.5">{track.artist_name}</p>
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

      {/* Aura AI Chat */}
      <motion.div variants={item} className="md:col-span-3 mt-4">
        <AuraChat />
      </motion.div>

    </motion.div>
  );
}


