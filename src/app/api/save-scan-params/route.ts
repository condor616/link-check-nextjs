import { NextRequest, NextResponse } from 'next/server';
import { ScanConfig } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

// Define the expected structure for saving scan parameters
interface SaveScanParamsPayload {
  id: string;
  url: string;
  config: ScanConfig;
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
      return await saveParamsToSupabaseHistory(sanitizedId, payload.url, payload.config);
    } else {
      return await saveParamsToPrisma(sanitizedId, payload.url, payload.config);
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

// Save scan parameters to Prisma (SQLite)
async function saveParamsToPrisma(id: string, url: string, config: ScanConfig) {
  try {
    await prisma.scanHistory.upsert({
      where: { id: id },
      update: {
        config: JSON.stringify(config)
      },
      create: {
        id: id,
        scan_url: url,
        scan_date: new Date(),
        duration_seconds: 0,
        config: JSON.stringify(config),
        results: '[]'
      }
    });

    return NextResponse.json(
      {
        message: 'Scan parameters saved successfully to Prisma',
        id: id
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving scan parameters to Prisma:', error);
    throw error;
  }
}

// Save scan parameters to Supabase history table
async function saveParamsToSupabaseHistory(id: string, url: string, config: ScanConfig) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  // First check if the scan already exists in history
  const { data, error: checkError } = await supabase
    .from('scan_history')
    .select('id')
    .eq('id', id)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    throw new Error(`Supabase error: ${checkError.message}`);
  }

  // If scan exists in history, update it
  if (data) {
    const { error } = await (supabase
      .from('scan_history') as any)
      .update({
        config: config
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
  } else {
    // If scan doesn't exist, insert a minimal record
    const { error } = await (supabase
      .from('scan_history') as any)
      .insert({
        id: id,
        scan_url: url,
        scan_date: new Date().toISOString(),
        duration_seconds: 0,
        config: config,
        results: []
      });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }
  }

  return NextResponse.json(
    {
      message: 'Scan parameters saved successfully to Supabase',
      id: id
    },
    { status: 201 }
  );
}
