import { NextResponse } from 'next/server';
import { ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        return await getLastScanFromSupabase();
      } catch (supabaseError) {
        console.error('Error getting last scan from Supabase:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await getLastScanFromPrisma();
      }
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
      orderBy: { scan_date: 'desc' }
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

    // Parse results to count broken links
    let results: ScanResult[] = [];
    try {
      const parsed = JSON.parse(lastScan.results);
      if (Array.isArray(parsed)) {
        results = parsed;
      } else if (parsed && typeof parsed === 'object') {
        results = Object.values(parsed);
      }
    } catch (e) {
      console.error(`Error parsing results for scan ${lastScan.id}:`, e);
    }

    // Count broken links
    const brokenLinks = results.filter((result: ScanResult) =>
      result.status === 'broken' ||
      (result.statusCode !== undefined && result.statusCode >= 400) ||
      result.status === 'error'
    ).length;

    return NextResponse.json({
      id: lastScan.id,
      url: lastScan.scan_url,
      date: lastScan.scan_date.toISOString(),
      brokenLinks,
      totalLinks: results.length,
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
      .select('*')
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

    // Define interface for Supabase response since we don't have generated types
    interface ScanHistoryItem {
      id: string;
      scan_url: string;
      scan_date: string;
      duration_seconds: number;
      results: any[];
      config: any;
    }

    const scanData = data as unknown as ScanHistoryItem;

    // Count broken links
    let resultsArr: any[] = [];
    if (Array.isArray(scanData.results)) {
      resultsArr = scanData.results;
    } else if (scanData.results && typeof scanData.results === 'object') {
      resultsArr = Object.values(scanData.results);
    }

    const brokenLinks = resultsArr.filter((result: ScanResult) =>
      result.status === 'broken' ||
      (result.statusCode !== undefined && result.statusCode >= 400) ||
      result.status === 'error'
    ).length;

    // Return simplified scan data for the homepage
    return NextResponse.json({
      id: scanData.id,
      url: scanData.scan_url,
      date: scanData.scan_date,
      brokenLinks,
      totalLinks: resultsArr.length,
    });
  } catch (error) {
    console.error('Error fetching last scan from Supabase:', error);
    // Rethrow to be handled by the parent try/catch
    throw error;
  }
}
