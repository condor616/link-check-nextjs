import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await getHistoryFromSupabase();
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
      select: {
        id: true,
        scan_url: true,
        scan_date: true,
        duration_seconds: true,
        broken_links: true,
        total_links: true,
        config: true
      },
      where: {
        NOT: {
          id: {
            startsWith: 'temp_'
          }
        }
      },
      orderBy: { scan_date: 'desc' }
    });

    const summaries = scans.map((scan: any) => {
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
        resultsCount: scan.total_links,
        brokenLinksCount: scan.broken_links,
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
      .select('id, scan_url, scan_date, duration_seconds, broken_links, total_links, config')
      .not('id', 'like', 'temp_%')
      .order('scan_date', { ascending: false });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Convert to the expected format
    const summaries = (data as any[]).map((scan: any) => {
      return {
        id: scan.id,
        scanUrl: scan.scan_url,
        scanDate: scan.scan_date,
        durationSeconds: scan.duration_seconds,
        timestamp: new Date(scan.scan_date as string).getTime(),
        resultsCount: scan.total_links || 0,
        broken_links: scan.broken_links || 0,
        config: scan.config
      };
    });

    return NextResponse.json({ items: summaries });
  } catch (err) {
    console.error('Error retrieving scan history from Supabase:', err);
    throw err;
  }
}