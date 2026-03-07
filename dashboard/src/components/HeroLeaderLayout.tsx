"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { TimeRange, SpotifyItem } from "@/app/actions/spotify";

interface HeroLeaderProps {
  title: string;
  initialItems: SpotifyItem[];
  fetchAction: (timeRange: TimeRange) => Promise<SpotifyItem[]>;
}

export default function HeroLeaderLayout({ title, initialItems, fetchAction }: HeroLeaderProps) {
  const [items, setItems] = useState<SpotifyItem[]>(initialItems);
  const [timeRange, setTimeRange] = useState<TimeRange>('short_term');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Client-side cache: avoids re-fetching when switching back to a previously viewed range
  const cache = useRef<Record<string, SpotifyItem[]>>({ short_term: initialItems });

  useEffect(() => {
    // If we already have cached results for this range, use them instantly
    if (cache.current[timeRange]) {
      setItems(cache.current[timeRange]);
      return;
    }

    let isMounted = true;
    const load = async () => {
      setLoading(true);
      setError(false);
      try {
        const newItems = await fetchAction(timeRange);
        if (isMounted) {
          if (newItems.length > 0) {
            cache.current[timeRange] = newItems; // Store in client cache
            setItems(newItems);
          } else {
            setError(true);
          }
        }
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    load();
    return () => { isMounted = false; };
  }, [timeRange, fetchAction]);

  const hero = items[0];
  const followers = items.slice(1);

  // Scope layoutIds to timeRange to prevent cross-range animation conflicts
  const scope = `${title}-${timeRange}`;

  return (
    <div className="glass-panel p-6 flex flex-col gap-6 w-full relative overflow-hidden group/board shadow-xl shadow-pink-500/5">
      {/* Dynamic Background Glow Based on Hover */}
      <div className="absolute top-1/2 left-0 w-[400px] h-[200px] bg-pink-500/10 rounded-full blur-[80px] -translate-y-1/2 -translate-x-1/2 group-hover/board:bg-pink-500/20 transition-all duration-1000" />
      
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center z-10 gap-4">
        <h2 className="text-sm md:text-md font-medium uppercase tracking-widest text-pink-200 opacity-90">{title}</h2>
        
        <div className="flex gap-1 bg-black/20 p-1.5 rounded-full border border-white/10 backdrop-blur-md relative overflow-hidden">
          {(['short_term', 'medium_term', 'long_term'] as TimeRange[]).map((tr, i) => (
            <button 
              key={tr}
              onClick={() => setTimeRange(tr)}
              disabled={loading}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-all relative z-10 disabled:opacity-50",
                timeRange === tr ? "text-white" : "text-white/40 hover:text-white/80 hover:bg-white/5"
              )}
            >
              {timeRange === tr && (
                 <motion.div 
                   layoutId={`${title}-timerange-pill`}
                   className="absolute inset-0 bg-gradient-to-r from-pink-500/80 to-pink-600/80 rounded-full -z-10 shadow-lg"
                   transition={{ type: "spring", stiffness: 300, damping: 30 }}
                 />
              )}
              {['4 Weeks', '6 Months', 'All Time'][i]}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-red-300 bg-red-500/10 p-4 rounded-xl text-sm border border-red-500/20">Please re-authenticate your Spotify API connection by running `python3 spotify_api_sync.py` to grant the "Top Read" scopes.</div>}
      {(!hero && !error) && <div className="text-white/50 text-sm">Waiting for live data sync...</div>}

      <AnimatePresence mode="wait">
        {hero && !error && (
          <motion.div 
            key={scope}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col md:flex-row gap-8 items-center md:items-start w-full min-h-[300px] mt-2 z-10"
          >
          
            {/* THE HERO (#1 RANK) */}
            <div className="flex-shrink-0 flex items-center justify-center relative w-48 h-48 md:w-56 md:h-56 mt-4 md:mt-8">
               <div className="absolute inset-0 bg-pink-400/30 rounded-full blur-[40px] animate-pulse pointer-events-none" />
               <div className="relative w-full h-full rounded-full border border-white/20 overflow-hidden shadow-2xl shadow-black/50 z-10 bg-pink-950/50">
                  {hero.imageUrl && (
                    <Image 
                      src={hero.imageUrl} 
                      alt={hero.name} 
                      fill 
                      className="object-cover transition-transform duration-700 hover:scale-105" 
                      sizes="(max-width: 768px) 192px, 224px" 
                      priority
                    />
                  )}
               </div>

               {/* Hero Rank Bubble */}
               <div className="absolute -top-1 -left-1 z-20 w-12 h-12 bg-white/10 backdrop-blur-xl border border-white/20 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                 <span className="text-2xl font-black bg-gradient-to-br from-pink-200 to-white bg-clip-text text-transparent">1</span>
               </div>

               
               <div className="absolute -bottom-6 z-20 whitespace-nowrap bg-black/70 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/10 shadow-xl flex flex-col items-center max-w-[120%]">
                  <span className="font-bold text-white text-lg tracking-tight truncate w-full text-center">{hero.name}</span>
                  {hero.artist && <span className="text-[11px] text-pink-300 uppercase tracking-widest truncate w-full text-center mt-0.5">{hero.artist}</span>}
               </div>
            </div>

            {/* THE FOLLOWERS (#2 - 10 Bubble Grid) */}
            <div className="flex-1 w-full relative">
              <div className="grid grid-cols-3 gap-y-6 gap-x-2 pb-4 pt-2 px-2 items-start w-full">
                {Array.from({ length: 9 }).map((_, index) => {
                  const item = followers[index];

                  return (
                    <div key={index} className="flex flex-col items-center w-full h-[120px]">
                      {item && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.5, y: 30 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          transition={{ 
                            type: "spring", stiffness: 280, damping: 20, 
                            delay: index * 0.04 
                          }}
                          whileHover={{ y: -5, scale: 1.05 }}
                          className="flex flex-col items-center relative group w-full cursor-pointer h-full"
                        >
                           {/* Follower Rank Bubble */}
                           <div className="absolute top-0 right-1/2 z-20 w-6 h-6 bg-black/60 shadow-xl backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center -translate-y-2 translate-x-8 md:translate-x-10">
                             <span className="text-[10px] font-black text-white/90">{index + 2}</span>
                           </div>
                           
                           <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-full overflow-hidden border border-white/10 group-hover:border-pink-400/50 transition-colors shadow-lg bg-pink-950/30 group-hover:shadow-[0_0_20px_rgba(236,72,153,0.3)]">
                             {item.imageUrl && (
                                <Image 
                                  src={item.imageUrl} 
                                  alt={item.name} 
                                  fill
                                  priority={index < 3}
                                  className="object-cover" 
                                  sizes="(max-width: 768px) 64px, 80px" 
                                />
                             )}
                           </div>
                           
                           <div className="mt-3 flex flex-col items-center text-center w-full px-1">
                              <span className="text-[11px] md:text-xs font-semibold text-white/90 truncate w-full px-1 leading-tight">{item.name}</span>
                              {item.artist && <span className="text-[9px] text-white/40 uppercase tracking-widest truncate w-full mt-0.5">{item.artist}</span>}
                           </div>
                        </motion.div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
