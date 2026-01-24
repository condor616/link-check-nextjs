import { NextResponse } from 'next/server';
import { ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await getLastScanFromSupabase();
    } else {
      return await getLastScanFromPrisma();
    }
  } catch (error) {
    console.error('Error fetching last scan:', error);
    // Return empty placeholder instead of error to avoid breaking the UI
    return NextResponse.json({
      id: null,
      url: null,
      date: null,
      brokenLinks: 0,
      totalLinks: 0,
      error: 'No scan history available'
    });
  }
}

async function getLastScanFromPrisma() {
  try {
    const lastScan = await prisma.scanHistory.findFirst({
      orderBy: { scan_date: 'desc' },
      where: {
        id: { not: 'temp_setup_id' }
      },
      select: {
        id: true,
        scan_url: true,
        scan_date: true,
        broken_links: true,
        total_links: true
      }
    });

    if (!lastScan) {
      return NextResponse.json({
        id: null,
        url: null,
        date: null,
        brokenLinks: 0,
        totalLinks: 0,
        error: 'No scan history found'
      });
    }

    return NextResponse.json({
      id: lastScan.id,
      url: lastScan.scan_url,
      date: lastScan.scan_date.toISOString(),
      brokenLinks: lastScan.broken_links,
      totalLinks: lastScan.total_links,
    });
  } catch (error) {
    console.error('Error fetching last scan from Prisma:', error);
    return NextResponse.json({
      id: null,
      url: null,
      date: null,
      brokenLinks: 0,
      totalLinks: 0,
      error: 'Error loading scan history'
    });
  }
}

async function getLastScanFromSupabase() {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    const { data, error } = await supabase
      .from('scan_history')
      .select('id, scan_url, scan_date, broken_links, total_links')
      .neq('id', 'temp_setup_id')
      .order('scan_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned
        return NextResponse.json({
          id: null,
          url: null,
          date: null,
          brokenLinks: 0,
          totalLinks: 0,
          error: 'No scan history found'
        });
      }
      throw new Error(`Supabase error: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json({
        id: null,
        url: null,
        date: null,
        brokenLinks: 0,
        totalLinks: 0,
        error: 'No scan history found'
      });
    }

    // Define interface for the query result
    interface ScanHistoryRecord {
      id: string;
      scan_url: string;
      scan_date: string;
      broken_links: number;
      total_links: number;
    }

    const record = data as unknown as ScanHistoryRecord;

    // Return simplified scan data for the homepage
    return NextResponse.json({
      id: record.id,
      url: record.scan_url,
      date: record.scan_date,
      brokenLinks: record.broken_links || 0,
      totalLinks: record.total_links || 0,
    });
  } catch (error) {
    console.error('Error fetching last scan from Supabase:', error);
    // Rethrow to be handled by the parent try/catch
    throw error;
  }
}
