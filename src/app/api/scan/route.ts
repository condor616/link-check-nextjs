import { NextRequest, NextResponse } from 'next/server';
import { scanWebsite, ScanConfig, ScanResult } from '@/lib/scanner';

// Define the expected request body structure more accurately
interface ScanApiRequest {
  url: string;
  config?: ScanConfig; // Use the imported ScanConfig type
  auth?: {
    username: string;
    password: string;
  };
}

// Helper function to serialize results for JSON
function serializeResults(results: Map<string, ScanResult> | ScanResult[]): any[] {
  if (Array.isArray(results)) {
    return results.map(r => ({
      ...r,
      foundOn: Array.from(r.foundOn || [])
    }));
  } else {
    return Array.from(results.values()).map(r => ({
      ...r,
      foundOn: Array.from(r.foundOn || [])
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

    const { url, config, auth } = body;

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

    // Log auth presence without showing credentials
    if (auth) {
      console.log('Basic auth credentials provided');
    }

    console.log("Initiating scan...");
    const startTime = Date.now();

    try {
      // Use scanWebsite instead of startScan to get the array of results directly
      // Pass auth credentials if provided
      const results = await scanWebsite(url, {
        ...config,
        auth: auth ? {
          username: auth.username,
          password: auth.password
        } : undefined
      });

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
    } catch (scanError) {
      console.error("Scan process error:", scanError);

      // Handle specific scan errors
      if (scanError instanceof TypeError && scanError.message.includes('fetch')) {
        return NextResponse.json({
          error: `Failed to connect to the target website (${url}). Please check the URL and try again.`,
          status: 'error'
        }, { status: 502 }); // Bad Gateway
      }

      if (scanError instanceof Error && scanError.message.includes('timeout')) {
        return NextResponse.json({
          error: `The scan process timed out. Try scanning with a higher timeout value or a smaller site section.`,
          status: 'error'
        }, { status: 504 }); // Gateway Timeout
      }

      // Generic error fallback
      return NextResponse.json({
        error: scanError instanceof Error ? scanError.message : 'Scan process failed',
        status: 'error'
      }, { status: 500 });
    }

  } catch (error) {
    // Top-level error handler for the API route itself
    console.error('Error processing scan request:', error);

    // Try to provide a helpful error message
    let errorMessage = 'Unknown server error';
    let statusCode = 500;

    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle specific error types
      if (error.message.includes('memory') || error.name === 'RangeError') {
        errorMessage = 'The scan operation exceeded available memory. Try scanning a smaller site or reducing the scan depth.';
        statusCode = 507; // Insufficient Storage
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        status: 'error'
      },
      { status: statusCode }
    );
  }
} 