import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { ScanConfig } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

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

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();
    
    if (useSupabase) {
      return await saveParamsToSupabase(sanitizedId, payload.url, payload.config);
    } else {
      return await saveParamsToFile(sanitizedId, payload.url, payload.config);
    }

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

// Save scan parameters to file
async function saveParamsToFile(id: string, url: string, config: ScanConfig) {
  await ensureParamsDir();
  
  // Create the file path
  const paramsFilePath = path.join(process.cwd(), SCAN_PARAMS_DIR, `${id}.json`);
  
  // Save the parameters to file
  await fs.writeFile(
    paramsFilePath, 
    JSON.stringify({
      url: url,
      config: config
    }, null, 2)
  );

  return NextResponse.json(
    { 
      message: 'Scan parameters saved successfully to file',
      id: id
    },
    { status: 201 }
  );
}

// Save scan parameters to Supabase
async function saveParamsToSupabase(id: string, url: string, config: ScanConfig) {
  const supabase = await getSupabaseClient();
  
  if (!supabase) {
    throw new Error('Supabase client is not available');
  }
  
  // Insert scan parameters into database
  const { error } = await supabase
    .from('scan_params')
    .upsert({
      id: id,
      url: url,
      config: config,
      created_at: new Date().toISOString()
    });
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  return NextResponse.json(
    { 
      message: 'Scan parameters saved successfully to Supabase',
      id: id
    },
    { status: 201 }
  );
} 