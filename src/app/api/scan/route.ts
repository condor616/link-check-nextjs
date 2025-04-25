import { NextRequest, NextResponse } from 'next/server';
import { startScan, ScanConfig, ScanResult } from '../../../lib/scanner'; // Import necessary types

// Define the expected request body structure more accurately
interface ScanApiRequest {
  url: string;
  config?: ScanConfig; // Use the imported ScanConfig type
}

// Helper to convert Map to a serializable format (e.g., array of objects)
// Because Maps aren't directly serializable to JSON
function serializeResults(results: Map<string, ScanResult>): object[] {
    return Array.from(results.values()).map(result => ({
        ...result,
        foundOn: Array.from(result.foundOn) // Convert Set to Array
    }));
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

    // TODO: Add more robust validation for config object if needed

    console.log(`API received scan request for: ${url}`, config);

    // === Timeout Warning ===
    // Performing the full scan here can lead to request timeouts on Vercel (free tier) or other platforms.
    // A background job/queue system is recommended for production.
    // =====================

    console.log("Initiating scan...");
    const startTime = Date.now();

    // Call the scanner function and wait for results
    const results = await startScan(url, config);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`Scan completed in ${duration.toFixed(2)} seconds. Found ${results.size} unique URLs.`);

    // Convert results Map to a JSON-serializable format
    const serializableResults = serializeResults(results);

    // Return the results
    return NextResponse.json({
        message: 'Scan completed successfully',
        durationSeconds: duration,
        resultsCount: serializableResults.length,
        results: serializableResults // Send results back in the response
    });

  } catch (error) {
    console.error("API Scan Error:", error);
    let errorMessage = 'Internal Server Error during scan';
    let statusCode = 500;

    if (error instanceof Error) {
        errorMessage = error.message;
        // Potentially set different status codes based on error type
        if (errorMessage.startsWith('Invalid start URL')) {
            statusCode = 400;
        }
    }

    return NextResponse.json({ error: errorMessage }, { status: statusCode });
  }
} 