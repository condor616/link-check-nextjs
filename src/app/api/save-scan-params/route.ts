import { NextRequest, NextResponse } from 'next/server';
import { ScanConfig } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase, ensureUserInSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

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

    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      // Ensure user row exists in Supabase public.users before FK-referencing insert
      await ensureUserInSupabase(user);
      return await saveParamsToSupabaseHistory(sanitizedId, payload.url, payload.config, user.id);
    } else {
      return await saveParamsToPrisma(sanitizedId, payload.url, payload.config, user.id);
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
async function saveParamsToPrisma(id: string, url: string, config: ScanConfig, userId: string) {
  try {
    // Check if scan exists and belongs to another user
    const existingScan = await prisma.scanHistory.findUnique({ where: { id }});
    if (existingScan && existingScan.userId && existingScan.userId !== userId) {
        throw new Error('Unauthorized or scan ID belongs to another user');
    }

    await prisma.scanHistory.upsert({
      where: { id: id },
      update: {
        config: JSON.stringify(config),
        userId: userId
      },
      create: {
        id: id,
        scan_url: url,
        scan_date: new Date(),
        duration_seconds: 0,
        config: JSON.stringify(config),
        results: '[]',
        userId: userId
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
async function saveParamsToSupabaseHistory(id: string, url: string, config: ScanConfig, userId: string) {
  const supabase = await getSupabaseClient();

  if (!supabase) {
    throw new Error('Supabase client is not available');
  }

  // First check if the scan already exists in history
  const { data, error: checkError } = await supabase
    .from('scan_history')
    .select('id, user_id')
    .eq('id', id)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    throw new Error(`Supabase error: ${checkError.message}`);
  }

  // If scan exists in history, update it
  if (data) {
    const checkData = data as any;
    if (checkData.user_id && checkData.user_id !== userId) {
        throw new Error('Unauthorized or scan ID belongs to another user');
    }

    const { error } = await (supabase
      .from('scan_history') as any)
      .update({
        config: config,
        user_id: userId
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
        results: [],
        user_id: userId
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
