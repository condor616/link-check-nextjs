import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

interface RecheckRequest {
  url: string;
  scanId: string;
  config?: ScanConfig;
  auth?: {
    username: string;
    password: string;
  };
}

// Simple function to check a single URL
async function checkUrl(url: string, config?: ScanConfig & { originalScanUrl?: string }): Promise<ScanResult & { authDecision?: string }> {
  try {
    // Prepare fetch options
    const timeoutDuration = config?.requestTimeout ?? 30000;

    // Determine if auth should be used by comparing domains
    let shouldUseAuth = false;
    let authDecision = "";

    if (config?.auth && config.originalScanUrl) {
      try {
        const urlDomain = new URL(url).hostname;
        const scanUrlDomain = new URL(config.originalScanUrl).hostname;

        // Only use auth for the same domain as the original scan
        shouldUseAuth = urlDomain === scanUrlDomain;

        if (shouldUseAuth) {
          console.log(`Using HTTP Basic Auth for ${url} (same domain as scan URL)`);
          authDecision = "auth_used_same_domain";
        } else {
          console.log(`Skipping HTTP Basic Auth for ${url} (different domain than scan URL)`);
          authDecision = "auth_skipped_different_domain";
        }
      } catch (err) {
        console.warn(`Error comparing domains for auth decision:`, err);
        authDecision = "auth_skipped_domain_error";
      }
    } else if (!config?.auth) {
      authDecision = "no_auth_credentials";
    }

    const fetchOptions: RequestInit = {
      headers: shouldUseAuth && config?.auth ? {
        'User-Agent': 'LinkCheckerProBot/1.0',
        'Authorization': `Basic ${Buffer.from(`${config.auth.username}:${config.auth.password}`).toString('base64')}`,
        'Connection': 'keep-alive'
      } : {
        'User-Agent': 'LinkCheckerProBot/1.0',
        'Connection': 'keep-alive'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutDuration),
      cache: 'no-store',
      keepalive: true
    };

    // Fetch the URL
    console.log(`Sending request to ${url} with auth: ${shouldUseAuth ? 'yes' : 'no'}`);
    const response = await fetch(url, fetchOptions);
    const status = response.status;
    const contentType = response.headers.get('content-type') || '';
    const isBroken = status >= 400;
    console.log(`Response for ${url}: status ${status}, content type: ${contentType}`);

    return {
      url,
      status: isBroken ? 'broken' : 'ok',
      statusCode: status,
      contentType,
      foundOn: new Set<string>(), // Will be preserved from original scan
      htmlContexts: new Map<string, string[]>(), // Will be preserved from original scan
      usedAuth: shouldUseAuth, // Add flag to indicate if auth was used
      authDecision // Return the auth decision reason
    };
  } catch (error: any) {
    console.error(`Error checking URL ${url}:`, error.name, error.message);

    if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
      return {
        url,
        status: 'broken',
        errorMessage: `Request timed out after ${(config?.requestTimeout ?? 30000) / 1000} seconds`,
        foundOn: new Set<string>(),
        htmlContexts: new Map<string, string[]>(),
        usedAuth: false,
        authDecision: "request_timeout"
      };
    }

    return {
      url,
      status: 'error',
      errorMessage: error.message || 'Unknown error occurred',
      foundOn: new Set<string>(),
      htmlContexts: new Map<string, string[]>(),
      usedAuth: false,
      authDecision: "request_error"
    };
  }
}

// Helper function to convert Map<string, string[]> to a plain object
function htmlContextsToObject(htmlContexts: Map<string, string[]> | undefined): Record<string, string[]> {
  if (!htmlContexts) return {};
  return Object.fromEntries(htmlContexts);
}

// Helper function to get a descriptive auth message
function getAuthMessage(authDecision: string, originalScanUrl: string, checkedUrl: string): string {
  try {
    const originalDomain = new URL(originalScanUrl).hostname;
    const checkedDomain = new URL(checkedUrl).hostname;

    switch (authDecision) {
      case "auth_used_same_domain":
        return `HTTP Basic Auth credentials were used (same domain: ${originalDomain})`;
      case "auth_skipped_different_domain":
        return `HTTP Basic Auth credentials were NOT used (different domain: ${checkedDomain} vs ${originalDomain})`;
      case "auth_skipped_domain_error":
        return "HTTP Basic Auth credentials were NOT used due to domain comparison error";
      case "no_auth_credentials":
        return "No HTTP Basic Auth credentials were configured for this scan";
      case "request_timeout":
        return "Request timed out, authentication status unknown";
      case "request_error":
        return "Request failed, authentication status unknown";
      default:
        return "";
    }
  } catch (e) {
    return "Error determining authentication status";
  }
}

// Get scan data from file
async function getScanDataFromFile(scanId: string) {
  // Get the scan file path
  const scanFilePath = path.join(process.cwd(), '.scan_history', `${scanId}.json`);

  // Check if scan file exists
  try {
    await fs.access(scanFilePath);
  } catch (_) {
    return null;
  }

  // Read the scan file
  const scanFileContent = await fs.readFile(scanFilePath, 'utf-8');
  return JSON.parse(scanFileContent);
}

// Get scan data from Supabase
async function getScanDataFromSupabase(scanId: string) {
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
      return null;
    }
    throw new Error(`Supabase error: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  // Define interface for Supabase response since we don't have generated types
  interface ScanHistoryItem {
    id: string;
    scan_url: string;
    scan_date: string;
    duration_seconds: number;
    results: any[];
    config: any;
  }

  const scanData = data as unknown as ScanHistoryItem;

  // Format data to match the file-based format
  return {
    id: scanData.id,
    scanUrl: scanData.scan_url,
    scanDate: scanData.scan_date,
    durationSeconds: scanData.duration_seconds,
    results: scanData.results || [],
    config: scanData.config || {}
  };
}

// Save updated scan data to file
async function saveScanDataToFile(scanId: string, scanData: any) {
  const scanFilePath = path.join(process.cwd(), '.scan_history', `${scanId}.json`);
  await fs.writeFile(scanFilePath, JSON.stringify(scanData, null, 2));
}

// Save updated scan data to Supabase
async function saveScanDataToSupabase(scanId: string, scanData: any) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  const { error } = await (supabase
    .from('scan_history') as any)
    .update({
      results: scanData.results
    })
    .eq('id', scanId);

  if (error) {
    throw new Error(`Supabase error updating scan: ${error.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let body: RecheckRequest;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { url, scanId, config, auth } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required and must be a string' }, { status: 400 });
    }

    if (!scanId || typeof scanId !== 'string') {
      return NextResponse.json({ error: 'Scan ID is required and must be a string' }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    // Get scan data
    let scanData;
    if (useSupabase) {
      scanData = await getScanDataFromSupabase(scanId);
      if (!scanData) {
        // Try file as fallback
        scanData = await getScanDataFromFile(scanId);
      }
    } else {
      scanData = await getScanDataFromFile(scanId);
    }

    // Check if scan exists
    if (!scanData) {
      return NextResponse.json({ error: 'Scan not found' }, { status: 404 });
    }

    // Get authentication credentials - first use the ones provided in the request,
    // if not available, check the original scan config
    const authCredentials = auth || scanData.config?.auth;
    const configWithAuth = {
      ...config,
      auth: authCredentials,
      requestTimeout: config?.requestTimeout || scanData.config?.requestTimeout,
      originalScanUrl: scanData.scanUrl // Add original scan URL for domain comparison
    };

    // Check the single URL
    console.log(`Re-checking URL: ${url}`);
    if (configWithAuth.auth) {
      console.log(`Auth credentials available for re-check (will only be used for same domain)`);
    }
    const startTime = Date.now();

    try {
      // Check the URL with auth credentials from the original scan if available
      const result = await checkUrl(url, configWithAuth);
      const authMessage = getAuthMessage(result.authDecision || "", scanData.scanUrl, url);

      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;

      // Find and update the URL result in the scan data
      const urlIndex = scanData.results.findIndex((r: any) => r.url === url);
      if (urlIndex !== -1) {
        // Preserve the foundOn and htmlContexts from the original scan
        const originalResult = scanData.results[urlIndex];
        result.foundOn = new Set(originalResult.foundOn);
        result.htmlContexts = new Map(Object.entries(originalResult.htmlContexts || {}));

        // Update the result in the scan data
        scanData.results[urlIndex] = {
          ...result,
          foundOn: Array.from(result.foundOn),
          htmlContexts: htmlContextsToObject(result.htmlContexts),
          usedAuth: result.usedAuth
        };
      }

      // Save the updated scan data
      if (useSupabase) {
        await saveScanDataToSupabase(scanId, scanData);
      } else {
        await saveScanDataToFile(scanId, scanData);
      }

      // Return the updated result
      return NextResponse.json({
        message: 'URL re-checked successfully',
        durationSeconds: duration,
        authMessage,
        result: {
          ...result,
          foundOn: Array.from(result.foundOn),
          htmlContexts: htmlContextsToObject(result.htmlContexts)
        }
      });

    } catch (scanError) {
      console.error("Re-check error:", scanError);

      if (scanError instanceof TypeError && scanError.message.includes('fetch')) {
        return NextResponse.json({
          error: `Failed to connect to the URL (${url}). Please check the URL and try again.`,
          status: 'error'
        }, { status: 502 });
      }

      if (scanError instanceof Error && scanError.message.includes('timeout')) {
        return NextResponse.json({
          error: `Request timed out after ${(configWithAuth?.requestTimeout ?? 30000) / 1000} seconds`,
          status: 'error'
        }, { status: 504 });
      }

      return NextResponse.json({
        error: scanError instanceof Error ? scanError.message : 'Unknown error occurred',
        status: 'error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Re-check endpoint error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Internal server error',
      status: 'error'
    }, { status: 500 });
  }
} 