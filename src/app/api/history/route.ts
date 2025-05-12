import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

const SCAN_HISTORY_DIR = '.scan_history';

export async function GET(_request: NextRequest) {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();
    
    if (useSupabase) {
      try {
        return await getHistoryFromSupabase();
      } catch (supabaseError) {
        console.error('Error getting history from Supabase - falling back to files:', supabaseError);
        // Fall back to file-based storage on Supabase error instead of showing an error
        return NextResponse.json({ items: [] });
      }
    } else {
      return await getHistoryFromFiles();
    }
  } catch (err) {
    console.error('Error retrieving scan history:', err);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json({ items: [] });
  }
}

// Get history data from local files
async function getHistoryFromFiles() {
  try {
    const historyDirPath = path.join(process.cwd(), SCAN_HISTORY_DIR);

    // Create history directory if it doesn't exist
    try {
      await fs.access(historyDirPath);
    } catch (_) {
      await fs.mkdir(historyDirPath, { recursive: true });
      return NextResponse.json({ items: [] }); // Return empty array if directory was just created
    }

    // Read all files in the history directory
    const files = await fs.readdir(historyDirPath);

    // Filter for JSON files only
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Read and parse each file
    const scanItems = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(historyDirPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const scanData = JSON.parse(content);

          // Extract scanId from filename (remove .json extension)
          const scanId = file.replace(/\.json$/, '');

          return {
            id: scanId,
            ...scanData,
            timestamp: scanData.timestamp || new Date(scanData.scanDate).getTime() || Date.now() // Fallback if timestamp is missing
          };
        } catch (err) {
          console.error(`Error reading scan file ${file}:`, err);
          return null;
        }
      })
    );

    // Filter out any failed reads and sort by timestamp (newest first)
    const validScans = scanItems
      .filter(item => item !== null)
      .sort((a: any, b: any) => {
        // Try to sort by timestamp, scanDate, or id as fallback
        if (a.timestamp && b.timestamp) return b.timestamp - a.timestamp;
        if (a.scanDate && b.scanDate) return new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime();
        return b.id.localeCompare(a.id);
      });

    // Create lightweight summaries instead of sending full scan data
    const summaries = validScans.map(scan => {
      let resultsArr: any[] = [];
      if (Array.isArray(scan.results)) {
        resultsArr = scan.results;
      } else if (scan.results && typeof scan.results === 'object') {
        // Sometimes results may be an object (e.g., a Map serialized as object)
        resultsArr = Object.values(scan.results);
      }
      const resultsCount = resultsArr.length;
      const brokenLinksCount = resultsArr.filter((r: any) =>
        r && (r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400))
      ).length;
      return {
        id: scan.id,
        scanUrl: scan.scanUrl,
        scanDate: scan.scanDate,
        durationSeconds: scan.durationSeconds,
        timestamp: scan.timestamp,
        resultsCount,
        brokenLinksCount,
        config: scan.config
        // Omit the full results array which can be very large
      };
    });

    return NextResponse.json({ items: summaries });
  } catch (err) {
    console.error('Error retrieving scan history from files:', err);
    throw err;
  }
}

// Get history data from Supabase
async function getHistoryFromSupabase() {
  try {
    const supabase = await getSupabaseClient();
    
    if (!supabase) {
      throw new Error('Supabase client is not available');
    }
    
    const { data, error } = await supabase
      .from('scan_history')
      .select('*')
      .order('scan_date', { ascending: false });
    
    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    // Convert to the expected format
    const summaries = data.map(scan => {
      let resultsArr: any[] = [];
      if (Array.isArray(scan.results)) {
        resultsArr = scan.results;
      } else if (scan.results && typeof scan.results === 'object') {
        resultsArr = Object.values(scan.results);
      }
      
      const resultsCount = resultsArr.length;
      const brokenLinksCount = resultsArr.filter((r: any) =>
        r && (r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400))
      ).length;
      
      return {
        id: scan.id,
        scanUrl: scan.scan_url,
        scanDate: scan.scan_date,
        durationSeconds: scan.duration_seconds,
        timestamp: new Date(scan.scan_date as string).getTime(),
        resultsCount,
        brokenLinksCount,
        config: scan.config
      };
    });
    
    return NextResponse.json({ items: summaries });
  } catch (err) {
    console.error('Error retrieving scan history from Supabase:', err);
    throw err;
  }
}