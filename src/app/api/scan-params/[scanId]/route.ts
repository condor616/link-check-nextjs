import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

// Get scan parameters for restarting a scan with the same settings
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;

    // Validate scanId
    if (!scanId || typeof scanId !== 'string' || !scanId.match(/^[\w-]+$/)) {
      return NextResponse.json(
        { error: 'Invalid scan ID' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        // Get directly from scan_history table
        return await getScanParamsFromSupabaseHistory(scanId);
      } catch (supabaseError) {
        console.error('Error getting scan params from Supabase:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await getScanParamsFromPrisma(scanId);
      }
    } else {
      return await getScanParamsFromPrisma(scanId);
    }
  } catch (err) {
    console.error('Error fetching scan parameters:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// Get scan parameters from Prisma
async function getScanParamsFromPrisma(scanId: string) {
  try {
    const scan = await prisma.scanHistory.findUnique({
      where: { id: scanId }
    });

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan parameters not found' },
        { status: 404 }
      );
    }

    let config = {};
    try {
      config = JSON.parse(scan.config);
    } catch (e) {
      console.error(`Error parsing config for scan ${scanId}:`, e);
    }

    return NextResponse.json({
      url: scan.scan_url,
      config: config
    });
  } catch (err) {
    console.error('Failed to get scan params from Prisma:', err);
    return NextResponse.json(
      { error: 'Failed to get scan parameters' },
      { status: 500 }
    );
  }
}

// Get scan parameters from Supabase scan_history table
async function getScanParamsFromSupabaseHistory(scanId: string) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { data, error } = await supabase
    .from('scan_history')
    .select('scan_url, config')
    .eq('id', scanId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Scan parameters not found' },
        { status: 404 }
      );
    }
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Scan parameters not found' },
      { status: 404 }
    );
  }

  // Define interface for Supabase response
  interface ScanParamsItem {
    scan_url: string;
    config: any;
  }

  const paramsData = data as unknown as ScanParamsItem;

  // Return the data in the expected format
  return NextResponse.json({
    url: paramsData.scan_url,
    config: paramsData.config
  });
}
