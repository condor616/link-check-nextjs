import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

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
        return await getScanFromSupabase(scanId);
      } catch (supabaseError) {
        console.error('Error getting scan from Supabase:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await getScanFromPrisma(scanId);
      }
    } else {
      return await getScanFromPrisma(scanId);
    }
  } catch (err) {
    console.error('Error fetching scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

async function getScanFromPrisma(scanId: string) {
  try {
    const scan = await prisma.scanHistory.findUnique({
      where: { id: scanId }
    });

    if (!scan) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }

    // Parse JSON fields
    let results = [];
    try {
      results = JSON.parse(scan.results);
    } catch (e) {
      console.error(`Error parsing results for scan ${scanId}:`, e);
    }

    let config = {};
    try {
      config = JSON.parse(scan.config);
    } catch (e) {
      console.error(`Error parsing config for scan ${scanId}:`, e);
    }

    const formattedData = {
      id: scan.id,
      scanUrl: scan.scan_url,
      scanDate: scan.scan_date.toISOString(),
      durationSeconds: scan.duration_seconds,
      results,
      config,
      // Add timestamp for compatibility if needed
      timestamp: scan.scan_date.getTime()
    };

    return NextResponse.json(formattedData);
  } catch (err) {
    console.error('Failed to get scan from Prisma:', err);
    return NextResponse.json(
      { error: 'Failed to get scan data' },
      { status: 500 }
    );
  }
}

async function getScanFromSupabase(scanId: string) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { data, error } = await supabase
    .from('scan_history')
    .select('*')
    .eq('id', scanId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (!data) {
    return NextResponse.json(
      { error: 'Scan not found' },
      { status: 404 }
    );
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

  // Format data to match the file-based format
  const formattedData = {
    id: scanData.id,
    scanUrl: scanData.scan_url,
    scanDate: scanData.scan_date,
    durationSeconds: scanData.duration_seconds,
    results: scanData.results || [],
    config: scanData.config || {}
  };

  return NextResponse.json(formattedData);
}

export async function DELETE(
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
        return await deleteScanFromSupabase(scanId);
      } catch (supabaseError) {
        console.error('Error deleting scan from Supabase:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await deleteScanFromPrisma(scanId);
      }
    } else {
      return await deleteScanFromPrisma(scanId);
    }
  } catch (err) {
    console.error('Error deleting scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

async function deleteScanFromPrisma(scanId: string) {
  try {
    await prisma.scanHistory.delete({
      where: { id: scanId }
    });

    return NextResponse.json(
      { success: true, message: 'Scan deleted successfully' }
    );
  } catch (err: any) {
    if (err.code === 'P2025') { // Record to delete does not exist
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }
    console.error('Error deleting scan from Prisma:', err);
    throw err;
  }
}

async function deleteScanFromSupabase(scanId: string) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { error } = await supabase
    .from('scan_history')
    .delete()
    .eq('id', scanId);

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  return NextResponse.json(
    { success: true, message: 'Scan deleted successfully' }
  );
}
