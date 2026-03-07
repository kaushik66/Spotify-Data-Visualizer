import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST() {
  return new Promise((resolve) => {
    // The python script is located in the root directory, one level up from dashboard/
    const scriptPath = '/Users/kaushikdas/Spotify Data Visualizer/spotify_api_sync.py';
    const cwd = '/Users/kaushikdas/Spotify Data Visualizer';
    const pythonPath = '/Users/kaushikdas/Spotify Data Visualizer/venv/bin/python3';

    exec(`"${pythonPath}" "${scriptPath}"`, { cwd }, (error, stdout, stderr) => {
      if (error) {
        console.error('[TriggerSync] Exec Error:', error);
        console.error('[TriggerSync] Stderr:', stderr);
        // We still return 500 so the client knows it failed
        resolve(NextResponse.json({ success: false, error: error.message }, { status: 500 }));
        return;
      }

      console.log('[TriggerSync] Success:', stdout);
      resolve(NextResponse.json({ success: true }));
    });
  });
}
