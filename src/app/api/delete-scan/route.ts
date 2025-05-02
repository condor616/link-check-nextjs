import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function DELETE(request: Request) {
  try {
    // Extract the scan ID from the URL query parameters
    const { searchParams } = new URL(request.url);
    const scanId = searchParams.get('id');
    
    if (!scanId) {
      return NextResponse.json(
        { error: 'Scan ID is required' },
        { status: 400 }
      );
    }
    
    // Path to the scan history directory
    const historyDir = path.join(process.cwd(), '.scan_history');
    
    // Ensure the directory exists
    if (!fs.existsSync(historyDir)) {
      return NextResponse.json(
        { error: 'Scan history directory not found' },
        { status: 404 }
      );
    }
    
    // Path to the scan file
    const scanFilePath = path.join(historyDir, `${scanId}.json`);
    
    // Check if the file exists
    if (!fs.existsSync(scanFilePath)) {
      return NextResponse.json(
        { error: 'Scan not found' },
        { status: 404 }
      );
    }
    
    // Delete the file
    fs.unlinkSync(scanFilePath);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: 'Scan deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting scan:', error);
    return NextResponse.json(
      { error: 'Failed to delete scan' },
      { status: 500 }
    );
  }
} 