import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ScanConfig } from '@/lib/scanner';

// Define the expected structure for saving scan parameters
interface SaveScanParamsPayload {
  id: string;
  url: string;
  config: ScanConfig;
}

const SCAN_PARAMS_DIR = '.scan_params';

// Ensure parameters directory exists
async function ensureParamsDir() {
  try {
    await fs.access(path.join(process.cwd(), SCAN_PARAMS_DIR));
  } catch (_) {
    // Directory doesn't exist, create it
    await fs.mkdir(path.join(process.cwd(), SCAN_PARAMS_DIR), { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureParamsDir();
    const payload = await request.json() as SaveScanParamsPayload;

    // Validate payload
    if (!payload.id || !payload.url || !payload.config) {
      return NextResponse.json(
        { error: 'Invalid payload: missing required fields' },
        { status: 400 }
      );
    }

    // Sanitize the ID (remove potential path traversal)
    const sanitizedId = payload.id.replace(/[^a-zA-Z0-9_-]/g, '');
    
    if (sanitizedId !== payload.id) {
      return NextResponse.json(
        { error: 'Invalid scan ID format' },
        { status: 400 }
      );
    }

    // Create the file path
    const paramsFilePath = path.join(process.cwd(), SCAN_PARAMS_DIR, `${sanitizedId}.json`);
    
    // Save the parameters to file
    await fs.writeFile(
      paramsFilePath, 
      JSON.stringify({
        url: payload.url,
        config: payload.config
      }, null, 2)
    );

    return NextResponse.json(
      { 
        message: 'Scan parameters saved successfully',
        id: sanitizedId
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error saving scan parameters:', error);
    
    let errorMessage = 'Failed to save scan parameters';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
} 