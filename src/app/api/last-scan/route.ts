import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { ScanResult } from '@/lib/scanner';

export async function GET() {
  try {
    // Path to the scan history directory
    const historyDir = path.join(process.cwd(), '.scan_history');
    
    // Ensure the directory exists
    if (!fs.existsSync(historyDir)) {
      return NextResponse.json({ error: 'No scan history found' }, { status: 404 });
    }
    
    // Get all scan files
    const files = fs.readdirSync(historyDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(historyDir, file);
        const stats = fs.statSync(filePath);
        return {
          file,
          id: file.replace('.json', ''),
          mtime: stats.mtime.getTime()
        };
      })
      .sort((a, b) => b.mtime - a.mtime); // Sort by most recent first
    
    // If no files found
    if (files.length === 0) {
      return NextResponse.json({ error: 'No scan history found' }, { status: 404 });
    }
    
    // Get the most recent scan file
    const mostRecentFile = files[0];
    const filePath = path.join(historyDir, mostRecentFile.file);
    const scanData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Count broken links
    const brokenLinks = Array.isArray(scanData.results) 
      ? scanData.results.filter((result: ScanResult) => 
          result.status === 'broken' || 
          (result.statusCode !== undefined && result.statusCode >= 400) ||
          result.status === 'error'
        ).length
      : 0;
    
    // Return simplified scan data for the homepage
    return NextResponse.json({
      id: mostRecentFile.id,
      url: scanData.scanUrl,
      date: scanData.scanDate,
      brokenLinks,
      totalLinks: scanData.results.length,
    });
    
  } catch (error) {
    console.error('Error fetching last scan:', error);
    return NextResponse.json(
      { error: 'Error fetching last scan' },
      { status: 500 }
    );
  }
} 