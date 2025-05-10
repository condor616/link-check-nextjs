import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

const SCAN_HISTORY_DIR = '.scan_history';

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
        // Fall back to file-based storage on Supabase error
        return await getScanFromFile(scanId);
      }
    } else {
      return await getScanFromFile(scanId);
    }
  } catch (err) {
    console.error('Error fetching scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

async function getScanFromFile(scanId: string) {
  // Build file path
  const scanFilePath = path.join(process.cwd(), SCAN_HISTORY_DIR, `${scanId}.json`);
  
  try {
    // Check if file exists
    await fs.access(scanFilePath);
  } catch (_) {
    return NextResponse.json(
      { error: 'Scan not found' },
      { status: 404 }
    );
  }
  
  // Read and parse the scan file
  const scanData = await fs.readFile(scanFilePath, 'utf-8');
  
  try {
    const scan = JSON.parse(scanData);
    
    // Return the scan data
    return NextResponse.json(scan);
  } catch (err) {
    console.error('Failed to parse scan data:', err);
    return NextResponse.json(
      { error: 'Failed to parse scan data' },
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
  
  // Format data to match the file-based format
  const formattedData = {
    id: data.id,
    scanUrl: data.scan_url,
    scanDate: data.scan_date,
    durationSeconds: data.duration_seconds,
    results: data.results || [],
    config: data.config || {}
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
        // Fall back to file-based storage on Supabase error
        return await deleteScanFromFile(scanId);
      }
    } else {
      return await deleteScanFromFile(scanId);
    }
  } catch (err) {
    console.error('Error deleting scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

async function deleteScanFromFile(scanId: string) {
  // Build file path
  const scanFilePath = path.join(process.cwd(), SCAN_HISTORY_DIR, `${scanId}.json`);
  
  try {
    // Check if file exists
    await fs.access(scanFilePath);
  } catch (_) {
    return NextResponse.json(
      { error: 'Scan not found' },
      { status: 404 }
    );
  }
  
  // Delete the scan file
  await fs.unlink(scanFilePath);
  
  // Return success
  return NextResponse.json(
    { success: true, message: 'Scan deleted successfully' }
  );
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