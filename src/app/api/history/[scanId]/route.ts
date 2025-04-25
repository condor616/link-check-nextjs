import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SCAN_HISTORY_DIR = '.scan_history';

type RouteContext = {
  params: {
    scanId: string;
  };
};

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
  } catch (err) {
    console.error('Error fetching scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
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
  } catch (err) {
    console.error('Error deleting scan:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
} 