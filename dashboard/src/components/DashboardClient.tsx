"use client";

import { motion, Variants } from "framer-motion";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Disc, Play, Sparkles, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import HeroLeaderLayout from "@/components/HeroLeaderLayout";
import { getTopArtists, getTopTracks, SpotifyItem } from "@/app/actions/spotify";

interface DashboardClientProps {
  lastListened?: { track_name: string; artist_name: string; played_at: string };
  liveTopArtists: SpotifyItem[];
  liveTopTracks: SpotifyItem[];
  topAlbums: { album_name: string; artist_name: string; plays: number }[];
  topGenres: { genres: string; plays: number }[];
  trends: { date: string; count: number }[];
}

export default function DashboardClient({ lastListened, liveTopArtists, liveTopTracks, topAlbums, topGenres, trends }: DashboardClientProps) {
  
  // Animation variants
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
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
            <p className="text-xs text-white/30 mt-4">{new Date(lastListened.played_at).toLocaleString()}</p>
          </div>
        ) : (
          <p className="text-white/50 mt-auto">No history found.</p>
        )}
      </motion.div>

      {/* Listening Trends Area Chart */}
      <motion.div variants={item} className="md:col-span-2 glass-panel p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-indigo-200">
          <Play className="w-5 h-5 opacity-80" />
          <h2 className="text-sm font-medium uppercase tracking-widest opacity-80">Listening Flow (14 Days)</h2>
        </div>
        
        <div className="h-48 w-full mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trends} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(10px)' }}
                itemStyle={{ color: '#e2e8f0' }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#818cf8" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorCount)" 
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Live Hero Layouts (Artists & Tracks) */}
      <motion.div variants={item} className="md:col-span-3">
         <HeroLeaderLayout 
           title="Top Artists" 
           initialItems={liveTopArtists} 
           fetchAction={getTopArtists} 
         />
      </motion.div>

      <motion.div variants={item} className="md:col-span-3">
         <HeroLeaderLayout 
           title="Top Tracks" 
           initialItems={liveTopTracks} 
           fetchAction={getTopTracks} 
         />
      </motion.div>

      {/* Database Extras */}

      {/* Top Albums & Genres Column */}
      <motion.div variants={item} className="md:col-span-1 flex flex-col gap-6">
        <div className="glass-panel p-6 flex flex-col gap-4 flex-1">
           <h2 className="text-sm font-medium uppercase tracking-widest text-indigo-200 opacity-80">Top Albums</h2>
           <div className="flex flex-col gap-3 mt-2">
            {topAlbums.map((album, i) => (
              <div key={i} className="flex flex-col bg-white/5 p-3 rounded-lg border border-white/5 hover:bg-white/10 transition-colors">
                <span className="text-sm text-white font-medium truncate">{album.album_name}</span>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-indigo-200/60 truncate">{album.artist_name}</span>
                  <span className="text-xs font-mono text-indigo-300">{album.plays}x</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
      
       <motion.div variants={item} className="md:col-span-1 flex flex-col gap-6">
        {/* Vibe Map / Proxy Card */}
        <div className="glass-panel p-6 flex flex-col items-center justify-center text-center gap-3 relative overflow-hidden group flex-1">
          <div className="absolute inset-0 bg-gradient-to-tr from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <Sparkles className="w-10 h-10 text-purple-300 opacity-80 mb-2" />
          <h3 className="text-xl font-semibold text-white">Vibe Analysis</h3>
          <p className="text-indigo-200/70 text-sm px-2">
            Sonic fingerprinting is currently calibrating via advanced LLM models.
          </p>
        </div>
        
        {/* Top Genres Backup card if needed */}
         {topGenres && topGenres.length > 0 && (
           <div className="glass-panel p-6 flex flex-col gap-4">
             <h2 className="text-sm font-medium uppercase tracking-widest text-indigo-200 opacity-80">Top Genres</h2>
              {/* Dynamic rendering of genres if db allows in future*/}
           </div>
         )}
      </motion.div>

      
      {/* Floating AI Assistant Chat Placeholder */}
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
