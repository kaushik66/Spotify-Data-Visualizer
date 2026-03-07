"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { motion, Variants } from "framer-motion";
import { Disc, Music2 } from "lucide-react";
import Image from "next/image";
import { RecentTrack, getLastPlayedTrack } from "@/app/actions/spotify";

interface NowPlayingData {
  isPlaying: boolean;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  albumArt?: string;
  progress_ms?: number;
  duration_ms?: number;
  reason?: string;
  retryAfter?: number;
}

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (res.status === 429) {
    const error: any = new Error('Rate Limited');
    error.status = 429;
    
    // We expect the JSON payload to have retryAfter returned from our API
    try {
      const data = await res.json();
      error.retryAfter = data.retryAfter;
    } catch {
      error.retryAfter = 5;
    }
    throw error;
  }
  return res.json();
};

export default function LivePlayer({ fallbackData }: { fallbackData?: RecentTrack | null }) {
  const { data, error, isLoading } = useSWR<NowPlayingData>('/api/spotify/now-playing', fetcher, {
    refreshInterval: (data) => {
      // 3 seconds if playing, 30 seconds if paused/no content
      if (data?.isPlaying) return 3000;
      return 30000;
    },
    revalidateOnFocus: true,
    onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
      if (error.status === 429) {
        if (retryCount >= 5) {
          // halt for 5 minutes after 5 retries
          setTimeout(() => revalidate({ retryCount }), 5 * 60 * 1000);
          return;
        }
        // exponential backoff
        const delay = error.retryAfter ? error.retryAfter * 1000 : Math.pow(2, retryCount) * 1000;
        setTimeout(() => revalidate({ retryCount }), delay);
        return;
      }
      
      // Stop retrying on other errors after 10 limits
      if (retryCount >= 10) return;
      setTimeout(() => revalidate({ retryCount }), 5000);
    }
  });

  const [lastListened, setLastListened] = useState<RecentTrack | null>(fallbackData || null);
  const [isSyncing, setIsSyncing] = useState(false);
  const prevIsPlaying = useRef<boolean>(false);

  // Fallback initial load if SWR has no data
  useEffect(() => {
    if (data && !data.isPlaying && !lastListened && !isSyncing) {
      getLastPlayedTrack().then(res => setLastListened(res));
    }
  }, [data, lastListened, isSyncing]);

  // Edge-triggered Sync
  useEffect(() => {
    if (!data) return;
    
    // Detect transition from playing -> paused/stopped
    if (prevIsPlaying.current === true && data.isPlaying === false) {
      const syncAndRevalidate = async () => {
        setIsSyncing(true);
        try {
          const res = await fetch('/api/system/trigger-sync', { method: 'POST' });
          if (res.ok) {
            // Once synced, fetch the latest offline track directly
            const updatedRecent = await getLastPlayedTrack();
            setLastListened(updatedRecent);
          }
        } catch (e) {
          console.error("Sync failed", e);
        } finally {
          setIsSyncing(false);
        }
      };
      syncAndRevalidate();
    }
    
    prevIsPlaying.current = data.isPlaying;
  }, [data]);

  const containerVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  const isPlaying = data?.isPlaying || false;

  // Loading or Syncing State
  if ((isLoading && !data && !lastListened) || isSyncing) {
    return (
      <motion.div variants={containerVariants} className="md:col-span-1 glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group min-h-[200px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl -mr-10 -mt-10 animate-pulse" />
        <div className="flex items-center gap-3 text-pink-200">
           <Disc className="w-6 h-6 animate-spin-slow opacity-80" />
           <h2 className="text-sm font-medium uppercase tracking-widest opacity-80">
             {isSyncing ? "Syncing Aura..." : "Loading..."}
           </h2>
        </div>
      </motion.div>
    );
  }

  // Active playing view
  if (isPlaying && data) {
    const progressPercent = data.duration_ms ? (data.progress_ms! / data.duration_ms) * 100 : 0;
    return (
      <motion.div variants={containerVariants} className="md:col-span-1 glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group min-h-[220px]">
         {/* Liquid Glass Album Art Background */}
         {data.albumArt && (
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 transition-all duration-1000"
              style={{ 
                backgroundImage: `url(${data.albumArt})`,
                filter: 'blur(60px)',
                opacity: 0.4
              }} 
            />
         )}
         <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-green-400/20 transition-all duration-700 z-0" />
        
        <div className="flex items-center justify-between z-10 w-full relative">
           <div className="flex items-center gap-3 text-green-300">
              <div className="relative flex items-center justify-center w-6 h-6">
                <Music2 className="w-5 h-5 animate-bounce" />
              </div>
              <h2 className="text-sm font-medium uppercase tracking-widest opacity-90 text-green-300">Now Playing</h2>
           </div>
        </div>

        <div className="mt-auto z-10 w-full flex gap-4 items-center">
          {data.albumArt && (
             <div className="relative w-16 h-16 rounded-md overflow-hidden shadow-lg border border-white/20 flex-shrink-0">
               <Image src={data.albumArt} alt={data.albumName || "Album Art"} fill className="object-cover" sizes="64px" />
             </div>
          )}
          <div className="overflow-hidden">
            <h3 className="text-xl font-bold text-white mb-0.5 truncate max-w-full drop-shadow-md">{data.trackName}</h3>
            <p className="text-white/80 text-sm truncate max-w-full drop-shadow-md font-medium">{data.artistName}</p>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-2 z-10 backdrop-blur-sm relative">
           <motion.div 
             className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-green-400 to-green-300 rounded-full"
             initial={{ width: `${progressPercent}%` }}
             animate={{ width: `${progressPercent}%` }}
             transition={{ duration: 3, ease: "linear" }}
           />
        </div>
      </motion.div>
    );
  }

  // Fallback View (Offline / Paused / Last Listened)
  return (
    <motion.div variants={containerVariants} className="md:col-span-1 glass-panel p-6 flex flex-col gap-4 relative overflow-hidden group min-h-[220px]">
        {/* Liquid Glass Album Art Background */}
        {lastListened?.imageUrl && (
            <div 
              className="absolute inset-0 bg-cover bg-center z-0 transition-opacity duration-1000 grayscale hover:grayscale-0"
              style={{ 
                backgroundImage: `url(${lastListened.imageUrl})`,
                filter: 'blur(60px)',
                opacity: 0.15
              }} 
            />
        )}
      <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-pink-400/30 transition-all duration-700 z-0" />
      
      <div className="flex items-center gap-3 text-pink-200 z-10 relative">
        <Disc className="w-6 h-6 opacity-80" />
        <h2 className="text-sm font-medium uppercase tracking-widest opacity-80">Last Listened</h2>
      </div>

      {lastListened ? (
        <div className="mt-auto z-10 w-full flex gap-4 items-center">
            {lastListened.imageUrl && (
             <div className="relative w-16 h-16 rounded-md overflow-hidden shadow-lg border border-white/10 flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity">
               <Image src={lastListened.imageUrl} alt={"Album Art"} fill className="object-cover" sizes="64px" />
             </div>
            )}
            <div className="overflow-hidden">
              <h3 className="text-xl font-semibold text-white mb-0.5 truncate max-w-full leading-tight">{lastListened.track_name}</h3>
              <p className="text-pink-100/70 text-sm truncate max-w-full">{lastListened.artist_name}</p>
              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-wider">{new Date(lastListened.played_at).toLocaleString()}</p>
            </div>
        </div>
      ) : (
        <p className="text-white/50 mt-auto z-10">No history found.</p>
      )}
    </motion.div>
  );
}
