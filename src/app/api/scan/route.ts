import { NextRequest, NextResponse } from 'next/server';
import { scanWebsite, ScanConfig, ScanResult } from '@/lib/scanner';

// Define the expected request body structure more accurately
interface ScanApiRequest {
  url: string;
  config?: ScanConfig; // Use the imported ScanConfig type
}

// Helper function to serialize results for JSON
function serializeResults(results: Map<string, ScanResult> | ScanResult[]): any[] {
  if (Array.isArray(results)) {
    return results.map(r => ({
      ...r,
      foundOn: Array.from(r.foundOn || []),
      htmlContexts: r.htmlContexts ? Object.fromEntries(r.htmlContexts) : undefined
    }));
  } else {
    return Array.from(results.values()).map(r => ({
      ...r,
      foundOn: Array.from(r.foundOn || []),
      htmlContexts: r.htmlContexts ? Object.fromEntries(r.htmlContexts) : undefined
    }));
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let body: ScanApiRequest;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, config } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required and must be a string' }, { status: 400 });
    }

    // Validate URL format using the Scanner's internal logic (or keep basic one)
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    console.log(`API received scan request for: ${url}`, config);

    console.log("Initiating scan...");
    const startTime = Date.now();

    // Use scanWebsite instead of startScan to get the array of results directly
    const results = await scanWebsite(url, config);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`Scan completed in ${duration.toFixed(2)} seconds. Found ${results.length} unique URLs.`);

    // Serialize results for JSON
    const serializableResults = serializeResults(results);

    // Return the results
    return NextResponse.json({
        message: 'Scan completed successfully',
        durationSeconds: duration,
        resultsCount: serializableResults.length,
        results: serializableResults,
        status: 'completed'
    });

  } catch (error) {
    console.error('Error processing scan request:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      }, 
      { status: 500 }
    );
  }
} 