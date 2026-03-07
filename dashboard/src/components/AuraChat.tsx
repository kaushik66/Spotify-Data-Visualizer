"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { Sparkles, Send, X } from "lucide-react";

interface AuraResult {
  sql: string;
  rows: Record<string, any>[];
}

const EMPHASIZED_KEYS = new Set(["track_name", "artist_name", "album_name"]);

function isMetric(key: string): boolean {
  return ["play_count", "energy", "valence", "tempo", "danceability", "acousticness", "instrumentalness", "liveness", "speechiness", "count", "total", "avg_energy", "avg_valence", "avg_tempo"].includes(key) || key.startsWith("avg_") || key.startsWith("total_") || key.startsWith("count_");
}

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(key: string, value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    // Format floats to 2 decimal places, integers as-is
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
  }
  return String(value);
}

export default function AuraChat() {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AuraResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setResult(null);
    setError(null);
    setIsExpanded(true);

    try {
      const res = await fetch("/api/aura/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Aura could not connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Animation variants
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 },
    },
  };

  const rowVariants: Variants = {
    hidden: { opacity: 0, y: 20, scale: 0.97 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 24 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
  };

  const keys = result?.rows?.[0] ? Object.keys(result.rows[0]) : [];
  const primaryKeys = keys.filter(k => EMPHASIZED_KEYS.has(k));
  const metricKeys = keys.filter(k => isMetric(k));
  const otherKeys = keys.filter(k => !EMPHASIZED_KEYS.has(k) && !isMetric(k));

  return (
    <div className="w-full relative flex flex-col gap-4 z-50">
      {/* The Vibe Bar */}
      <form onSubmit={handleSubmit} className="relative flex-shrink-0">
        <div className="relative flex items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-full px-6 py-4 shadow-lg shadow-purple-500/5 transition-all duration-300 focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-400/30 focus-within:shadow-purple-500/20 focus-within:bg-white/[0.07] group">
          <Sparkles className="w-5 h-5 text-purple-300/70 group-focus-within:text-purple-300 transition-colors flex-shrink-0 mr-4" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask Aura about your music..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            className="bg-transparent border-none outline-none text-white w-full placeholder:text-white/30 text-lg font-light tracking-wide"
          />
          {prompt.trim() && (
            <motion.button
              type="submit"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              disabled={isLoading}
              className="ml-3 flex-shrink-0 w-9 h-9 rounded-full bg-purple-500/30 border border-purple-400/30 flex items-center justify-center text-purple-200 hover:bg-purple-500/50 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </form>

      {/* Results Container */}
      <div className="absolute top-full left-0 right-0 mt-4 shadow-2xl z-50">
        <AnimatePresence mode="wait">
          {/* Loading State — Liquid Thinking */}
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.4 }}
            className="glass-panel rounded-2xl p-8 flex flex-col items-center justify-center gap-4 overflow-hidden"
          >
            {/* Pulsing Orb */}
            <div className="relative w-20 h-20">
              <div className="aura-orb absolute inset-0 rounded-full" />
              <div className="aura-orb absolute inset-2 rounded-full" style={{ animationDelay: "-1.5s" }} />
              <div className="aura-orb absolute inset-4 rounded-full" style={{ animationDelay: "-3s" }} />
            </div>
            <p className="text-white/50 text-sm font-medium tracking-widest uppercase animate-pulse">
              Aura is analyzing your vibe...
            </p>
          </motion.div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-panel rounded-2xl p-6 border border-red-500/20"
          >
            <div className="flex items-center justify-between">
              <p className="text-red-300/80 text-sm font-medium">{error}</p>
              <button onClick={() => { setError(null); setIsExpanded(false); }} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Results State */}
        {result && !isLoading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="glass-panel rounded-2xl p-6 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-300/70" />
                <p className="text-white/40 text-xs font-medium uppercase tracking-widest">
                  {result.rows.length} result{result.rows.length !== 1 ? "s" : ""} found
                </p>
              </div>
              <button onClick={() => { setResult(null); setIsExpanded(false); setPrompt(""); }} className="text-white/30 hover:text-white/60 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Rows */}
            {result.rows.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-4">No data matched that query.</p>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className="flex flex-col gap-2"
              >
                {result.rows.map((row, i) => (
                  <motion.div
                    key={i}
                    variants={rowVariants}
                    className="bg-white/5 rounded-2xl p-4 flex items-center justify-between gap-4 border border-white/5 hover:bg-white/[0.08] hover:border-white/10 transition-all duration-200 group"
                  >
                    {/* Left: Primary & Other Fields */}
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      {primaryKeys.map((key) => (
                        <p
                          key={key}
                          className={
                            key === "track_name"
                              ? "text-white font-semibold text-base truncate"
                              : "text-white/60 text-sm truncate"
                          }
                        >
                          {row[key]}
                        </p>
                      ))}
                      {otherKeys.map((key) => (
                        <p key={key} className="text-white/40 text-xs truncate">
                          <span className="text-white/25">{formatKey(key)}:</span>{" "}
                          {formatValue(key, row[key])}
                        </p>
                      ))}
                    </div>

                    {/* Right: Metric Badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {metricKeys.map((key) => (
                        <div
                          key={key}
                          className="flex flex-col items-center bg-purple-500/10 border border-purple-400/15 rounded-xl px-3 py-1.5 min-w-[60px]"
                        >
                          <span className="text-white font-bold text-sm leading-tight">
                            {formatValue(key, row[key])}
                          </span>
                          <span className="text-white/40 text-[10px] uppercase tracking-wider leading-tight mt-0.5">
                            {formatKey(key)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* SQL Preview (subtle) */}
            <details className="mt-4 group/sql">
              <summary className="text-white/20 text-[10px] uppercase tracking-widest cursor-pointer hover:text-white/40 transition-colors">
                View Generated SQL
              </summary>
              <pre className="mt-2 text-white/30 text-xs font-mono bg-black/20 rounded-lg p-3 overflow-x-auto border border-white/5">
                {result.sql}
              </pre>
            </details>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  );
}
