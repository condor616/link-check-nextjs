import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        return await getHistoryFromSupabase();
      } catch (supabaseError) {
        console.error('Error getting history from Supabase - falling back to Prisma:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await getHistoryFromPrisma();
      }
    } else {
      return await getHistoryFromPrisma();
    }
  } catch (err) {
    console.error('Error retrieving scan history:', err);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json({ items: [] });
  }
}

// Get history data from Prisma (SQLite)
async function getHistoryFromPrisma() {
  try {
    const scans = await prisma.scanHistory.findMany({
      where: {
        NOT: {
          id: {
            startsWith: 'temp_'
          }
        }
      },
      orderBy: { scan_date: 'desc' }
    });

    const summaries = scans.map(scan => {
      let resultsArr: any[] = [];
      try {
        const parsedResults = JSON.parse(scan.results);
        if (Array.isArray(parsedResults)) {
          resultsArr = parsedResults;
        } else if (parsedResults && typeof parsedResults === 'object') {
          resultsArr = Object.values(parsedResults);
        }
      } catch (e) {
        console.error(`Error parsing results for scan ${scan.id}:`, e);
      }

      const resultsCount = resultsArr.length;
      const brokenLinksCount = resultsArr.filter((r: any) =>
        r && (r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400))
      ).length;

      let config = {};
      try {
        config = JSON.parse(scan.config);
      } catch (e) {
        console.error(`Error parsing config for scan ${scan.id}:`, e);
      }

      return {
        id: scan.id,
        scanUrl: scan.scan_url,
        scanDate: scan.scan_date.toISOString(),
        durationSeconds: scan.duration_seconds,
        timestamp: scan.scan_date.getTime(),
        resultsCount,
        brokenLinksCount,
        config
      };
    });

    return NextResponse.json({ items: summaries });
  } catch (err) {
    console.error('Error retrieving scan history from Prisma:', err);
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
      .not('id', 'like', 'temp_%')
      .order('scan_date', { ascending: false });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Define interface for Supabase response since we don't have generated types
    interface ScanHistoryItem {
      id: string;
      scan_url: string;
      scan_date: string;
      duration_seconds: number;
      results: any[];
      config: any;
    }

    const scans = data as unknown as ScanHistoryItem[];

    // Convert to the expected format
    const summaries = scans.map(scan => {
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