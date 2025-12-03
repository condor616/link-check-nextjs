import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { ScanConfig } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from '@/lib/prisma';

// Define the expected structure for saved configurations
export interface SavedScanConfig {
  id: string;
  name: string;
  url: string;
  config: ScanConfig;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

// GET all saved configurations
export async function GET() {
  try {
    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        return await getConfigsFromSupabase();
      } catch (supabaseError) {
        console.error('Error getting configurations from Supabase - falling back to empty array:', supabaseError);
        // Fall back to Prisma on Supabase error
        return await getConfigsFromPrisma();
      }
    } else {
      return await getConfigsFromPrisma();
    }
  } catch (error) {
    console.error('Error getting saved configurations:', error);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json([]);
  }
}

// Get configs from Prisma
async function getConfigsFromPrisma() {
  try {
    const configs = await prisma.savedConfig.findMany({
      orderBy: { updatedAt: 'desc' }
    });

    // Format for response
    const formattedConfigs: SavedScanConfig[] = configs.map((config: any) => {
      let parsedConfig = {};
      try {
        parsedConfig = JSON.parse(config.config);
      } catch (e) {
        console.error(`Error parsing config for ${config.id}:`, e);
      }

      return {
        id: config.id,
        name: config.name,
        url: config.url,
        config: parsedConfig as ScanConfig,
        createdAt: config.createdAt.toISOString(),
        updatedAt: config.updatedAt.toISOString()
      };
    });

    return NextResponse.json(formattedConfigs);
  } catch (error) {
    console.error('Error getting configurations from Prisma:', error);
    throw error;
  }
}

// Get configs from Supabase
async function getConfigsFromSupabase() {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    const { data, error } = await supabase
      .from('scan_configs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    // Define interface for Supabase response
    interface SavedConfigItem {
      id: string;
      name: string;
      url: string;
      config: any;
      created_at: string;
      updated_at: string;
    }

    const configItems = data as unknown as SavedConfigItem[];

    // Convert Supabase format to our app format
    const configs = configItems.map(item => ({
      id: item.id,
      name: item.name,
      url: item.url,
      config: item.config,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }));

    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error getting configurations from Supabase:', error);
    throw error;
  }
}

// POST to save a new configuration
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Validate payload
    if (!payload.name || !payload.url || !payload.config) {
      return NextResponse.json(
        { error: 'Invalid payload: missing required fields' },
        { status: 400 }
      );
    }

    // Generate unique ID if not provided (for new configs)
    const id = payload.id || `config_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // Sanitize the ID
    const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');

    const now = new Date().toISOString();

    const savedConfig: SavedScanConfig = {
      id: sanitizedId,
      name: payload.name,
      url: payload.url,
      config: payload.config,
      createdAt: payload.createdAt || now,
      updatedAt: now
    };

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await saveConfigToSupabase(savedConfig);
    } else {
      return await saveConfigToPrisma(savedConfig);
    }
  } catch (error) {
    console.error('Error saving configuration:', error);

    let errorMessage = 'Failed to save configuration';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Save config to Prisma
async function saveConfigToPrisma(config: SavedScanConfig) {
  try {
    await prisma.savedConfig.upsert({
      where: { id: config.id },
      update: {
        name: config.name,
        url: config.url,
        config: JSON.stringify(config.config),
        updatedAt: new Date()
      },
      create: {
        id: config.id,
        name: config.name,
        url: config.url,
        config: JSON.stringify(config.config),
        createdAt: new Date(config.createdAt),
        updatedAt: new Date()
      }
    });

    return NextResponse.json(
      {
        message: 'Configuration saved successfully to Prisma',
        id: config.id,
        config: config
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving configuration to Prisma:', error);
    throw error;
  }
}

// Save config to Supabase
async function saveConfigToSupabase(config: SavedScanConfig) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    // Check if config with this ID already exists (update vs insert)
    const { data: existingConfig } = await supabase
      .from('scan_configs')
      .select('id')
      .eq('id', config.id)
      .maybeSingle();

    let result;

    if (existingConfig) {
      // Update existing config
      result = await (supabase
        .from('scan_configs') as any)
        .update({
          name: config.name,
          url: config.url,
          config: config.config,
          updated_at: config.updatedAt
        })
        .eq('id', config.id);
    } else {
      // Insert new config
      result = await (supabase
        .from('scan_configs') as any)
        .insert({
          id: config.id,
          name: config.name,
          url: config.url,
          config: config.config,
          created_at: config.createdAt,
          updated_at: config.updatedAt
        });
    }

    if (result.error) {
      throw new Error(`Supabase error: ${result.error.message}`);
    }

    return NextResponse.json(
      {
        message: 'Configuration saved successfully to Supabase',
        id: config.id,
        config: config
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving configuration to Supabase:', error);
    throw error;
  }
}

// DELETE a saved configuration
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing configuration ID' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await deleteConfigFromSupabase(id);
    } else {
      return await deleteConfigFromPrisma(id);
    }
  } catch (error) {
    console.error('Error deleting configuration:', error);

    let errorMessage = 'Failed to delete configuration';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// Delete config from Prisma
async function deleteConfigFromPrisma(id: string) {
  try {
    await prisma.savedConfig.delete({
      where: { id: id }
    });

    return NextResponse.json(
      { message: 'Configuration deleted successfully from Prisma' }
    );
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }
    console.error('Error deleting configuration from Prisma:', error);
    throw error;
  }
}

// Delete config from Supabase
async function deleteConfigFromSupabase(id: string) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    const { error } = await supabase
      .from('scan_configs')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    return NextResponse.json(
      { message: 'Configuration deleted successfully from Supabase' }
    );
  } catch (error) {
    console.error('Error deleting configuration from Supabase:', error);
    throw error;
  }
}
