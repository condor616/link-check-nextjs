import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

const SCAN_HISTORY_DIR = '.scan_history';
const SCAN_PARAMS_DIR = '.scan_params';

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
        // First try to get from scan_params table
        const paramsResult = await getScanParamsFromSupabase(scanId);
        if (paramsResult) {
          return paramsResult;
        }
        
        // If not found in scan_params, try to get from scan_history
        return await getScanParamsFromSupabaseHistory(scanId);
      } catch (supabaseError) {
        console.error('Error getting scan params from Supabase:', supabaseError);
        // Fall back to file-based storage on Supabase error
        return await getScanParamsFromFile(scanId);
      }
    } else {
      return await getScanParamsFromFile(scanId);
    }
  } catch (err) {
    console.error('Error fetching scan parameters:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}

// Get scan parameters from file system
async function getScanParamsFromFile(scanId: string) {
  // Check both possible directories for the scan ID
  // First try the scan_params directory (temporary scans)
  const paramsFilePath = path.join(process.cwd(), SCAN_PARAMS_DIR, `${scanId}.json`);
  const historyFilePath = path.join(process.cwd(), SCAN_HISTORY_DIR, `${scanId}.json`);
  
  let scanData: string;
  let isFromHistory = false;
  
  try {
    // First check params directory
    await fs.access(paramsFilePath);
    scanData = await fs.readFile(paramsFilePath, 'utf-8');
  } catch (_) {
    try {
      // Then check history directory
      await fs.access(historyFilePath);
      scanData = await fs.readFile(historyFilePath, 'utf-8');
      isFromHistory = true;
    } catch (_) {
      return NextResponse.json(
        { error: 'Scan parameters not found' },
        { status: 404 }
      );
    }
  }
  
  try {
    const parsedData = JSON.parse(scanData);
    
    // If from history, we need to extract the parameters
    if (isFromHistory) {
      return NextResponse.json({
        url: parsedData.scanUrl,
        config: parsedData.config
      });
    }
    
    // If from params directory, the structure is already correct
    return NextResponse.json(parsedData);
  } catch (err) {
    console.error('Failed to parse scan data:', err);
    return NextResponse.json(
      { error: 'Failed to parse scan parameters' },
      { status: 500 }
    );
  }
}

// Get scan parameters from Supabase scan_params table
async function getScanParamsFromSupabase(scanId: string) {
  const supabase = await getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }
  
  const { data, error } = await supabase
    .from('scan_params')
    .select('*')
    .eq('id', scanId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      // Not found in scan_params table
      return null;
    }
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  if (!data) {
    return null;
  }
  
  // Return the data in the expected format
  return NextResponse.json({
    url: data.url,
    config: data.config
  });
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
  
  // Return the data in the expected format
  return NextResponse.json({
    url: data.scan_url,
    config: data.config
  });
} 