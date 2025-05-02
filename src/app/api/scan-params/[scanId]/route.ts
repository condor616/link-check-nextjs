import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

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
  } catch (err) {
    console.error('Error fetching scan parameters:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
} 