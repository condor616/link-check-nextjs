import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const SCAN_HISTORY_DIR = '.scan_history';

export async function GET(_request: NextRequest) {
  try {
    const historyDirPath = path.join(process.cwd(), SCAN_HISTORY_DIR);

    // Create history directory if it doesn't exist
    try {
      await fs.access(historyDirPath);
    } catch (_) {
      await fs.mkdir(historyDirPath, { recursive: true });
      return NextResponse.json({ items: [] }); // Return empty array if directory was just created
    }

    // Read all files in the history directory
    const files = await fs.readdir(historyDirPath);

    // Filter for JSON files only
    const jsonFiles = files.filter(file => file.endsWith('.json'));

    // Read and parse each file
    const scanItems = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(historyDirPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const scanData = JSON.parse(content);

          // Extract scanId from filename (remove .json extension)
          const scanId = file.replace(/\.json$/, '');

          return {
            id: scanId,
            ...scanData,
            timestamp: scanData.timestamp || Date.now() // Fallback if timestamp is missing
          };
        } catch (err) {
          console.error(`Error reading scan file ${file}:`, err);
          return null;
        }
      })
    );

    // Filter out any failed reads and sort by timestamp (newest first)
    const validScans = scanItems
      .filter(item => item !== null)
      .sort((a, b) => b.timestamp - a.timestamp);

    // Create lightweight summaries instead of sending full scan data
    const summaries = validScans.map(scan => {
      let resultsArr: any[] = [];
      if (Array.isArray(scan.results)) {
        resultsArr = scan.results;
      } else if (scan.results && typeof scan.results === 'object') {
        // Sometimes results may be an object (e.g., a Map serialized as object)
        resultsArr = Object.values(scan.results);
      }
      const resultsCount = resultsArr.length;
      const brokenLinksCount = resultsArr.filter((r: any) =>
        r && (r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400))
      ).length;
      return {
        id: scan.id,
        scanUrl: scan.scanUrl,
        scanDate: scan.scanDate,
        durationSeconds: scan.durationSeconds,
        timestamp: scan.timestamp,
        resultsCount,
        brokenLinksCount,
        config: scan.config
        // Omit the full results array which can be very large
      };
    });

    return NextResponse.json({ items: summaries });
  } catch (err) {
    console.error('Error retrieving scan history:', err);
    return NextResponse.json(
      { error: 'Server error' },
      { status: 500 }
    );
  }
}