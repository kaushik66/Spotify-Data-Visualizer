import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const SYSTEM_PROMPT = `You are an expert SQLite data analyst. Convert the user prompt into a valid SQLite query based on this schema:
- tracks(track_uri, track_name, artist_name, album_name, tempo, valence, energy, danceability, acousticness, instrumentalness, liveness, speechiness, genres)
- streaming_history(id, played_at, ms_played, track_uri, platform, conn_country, reason_start, reason_end, shuffle, skipped, offline, offline_timestamp)

Rules:
1. Return ONLY the raw SQL code. No markdown formatting (don't use \`\`\`sql), no explanations.
2. The 'play count' of a track is the number of times it appears in streaming_history. Calculate this with COUNT(sh.id).
3. Always JOIN streaming_history sh ON sh.track_uri = t.track_uri.`;

function cleanSQL(raw: string): string {
  let cleaned = raw.trim();
  // Strip markdown code fences like ```sql ... ``` or ``` ... ```
  cleaned = cleaned.replace(/^```(?:sql)?\s*/i, '');
  cleaned = cleaned.replace(/\s*```$/i, '');
  return cleaned.trim();
}

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'A prompt is required.' }, { status: 400 });
    }

    // 1. Ask Ollama to generate SQL
    const ollamaRes = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'qwen2.5-coder:3b',
        prompt: `${SYSTEM_PROMPT}\n\nUser: ${prompt}`,
        stream: false
      })
    });

    if (!ollamaRes.ok) {
      console.error('[AuraAI] Ollama returned status', ollamaRes.status);
      return NextResponse.json({ error: 'Aura could not reach the AI engine. Is Ollama running?' }, { status: 502 });
    }

    const ollamaData = await ollamaRes.json();
    const rawSQL = ollamaData.response;

    if (!rawSQL) {
      return NextResponse.json({ error: 'Aura could not parse that vibe. Try rephrasing.' }, { status: 422 });
    }

    const sql = cleanSQL(rawSQL);
    console.log('[AuraAI] Generated SQL:', sql);

    // 2. Execute the SQL against our database
    try {
      const rows = db.prepare(sql).all();
      return NextResponse.json({ sql, rows });
    } catch (dbError: any) {
      console.error('[AuraAI] SQL Execution Error:', dbError.message);
      console.error('[AuraAI] Bad SQL was:', sql);
      return NextResponse.json(
        { error: 'Aura could not parse that vibe. Try rephrasing.', debug_sql: sql },
        { status: 422 }
      );
    }
  } catch (e: any) {
    console.error('[AuraAI] Unexpected Error:', e);
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }
}
