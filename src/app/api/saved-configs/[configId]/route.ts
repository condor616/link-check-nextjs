import { NextRequest, NextResponse } from 'next/server';
import { SavedScanConfig } from '../route';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { ScanConfig } from '@/lib/scanner';
import { prisma } from '@/lib/prisma';

// Helper function to validate config ID
function validateConfigId(configId: string): boolean {
  return /^[\w-]+$/.test(configId);
}

// GET a specific saved configuration
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;

    // Validate configId
    if (!configId || !validateConfigId(configId)) {
      return NextResponse.json(
        { error: 'Invalid configuration ID' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      try {
        return await getConfigFromSupabase(configId);
      } catch (error) {
        console.error('Error getting configuration from Supabase:', error);
        // Fall back to Prisma if Supabase fails
        return await getConfigFromPrisma(configId);
      }
    } else {
      return await getConfigFromPrisma(configId);
    }
  } catch (error) {
    console.error('Error getting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved configuration' },
      { status: 500 }
    );
  }
}

// Helper function to get config from Prisma
async function getConfigFromPrisma(configId: string) {
  try {
    const config = await prisma.savedConfig.findUnique({
      where: { id: configId }
    });

    if (!config) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    let parsedConfig = {};
    try {
      parsedConfig = JSON.parse(config.config);
    } catch (e) {
      console.error(`Error parsing config for ${config.id}:`, e);
    }

    const savedConfig: SavedScanConfig = {
      id: config.id,
      name: config.name,
      url: config.url,
      config: parsedConfig as ScanConfig,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString()
    };

    return NextResponse.json(savedConfig);
  } catch (err) {
    console.error('Error getting configuration from Prisma:', err);
    throw err;
  }
}

// Helper function to get config from Supabase
async function getConfigFromSupabase(configId: string) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    const { data, error } = await supabase
      .from('scan_configs')
      .select('*')
      .eq('id', configId)
      .maybeSingle();

    if (error) {
      throw new Error(`Supabase error: ${error.message}`);
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
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

    const configData = data as unknown as SavedConfigItem;

    // Convert from Supabase format to our app format
    const config: SavedScanConfig = {
      id: configData.id,
      name: configData.name,
      url: configData.url,
      config: configData.config,
      createdAt: configData.created_at,
      updatedAt: configData.updated_at
    };

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error getting configuration from Supabase:', error);
    throw error;
  }
}

// PUT to update a specific configuration
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;

    // Validate configId
    if (!configId || !validateConfigId(configId)) {
      return NextResponse.json(
        { error: 'Invalid configuration ID' },
        { status: 400 }
      );
    }

    // Get updated config data
    const payload = await request.json();

    // Validate payload
    if (!payload.name || !payload.url || !payload.config) {
      return NextResponse.json(
        { error: 'Invalid payload: missing required fields' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await updateConfigInSupabase(configId, payload);
    } else {
      return await updateConfigInPrisma(configId, payload);
    }
  } catch (error) {
    console.error('Error updating saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update saved configuration' },
      { status: 500 }
    );
  }
}

// Helper function to update config in Prisma
async function updateConfigInPrisma(configId: string, payload: any) {
  try {
    // Check if configuration exists
    const existingConfig = await prisma.savedConfig.findUnique({
      where: { id: configId }
    });

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    // Update the configuration
    const updated = await prisma.savedConfig.update({
      where: { id: configId },
      data: {
        name: payload.name,
        url: payload.url,
        config: JSON.stringify(payload.config),
        updatedAt: new Date()
      }
    });

    const updatedConfig: SavedScanConfig = {
      id: updated.id,
      name: updated.name,
      url: updated.url,
      config: payload.config,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };

    return NextResponse.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error updating configuration in Prisma:', error);
    throw error;
  }
}

// Helper function to update config in Supabase
async function updateConfigInSupabase(configId: string, payload: any) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    // Check if config exists
    const { data: existingConfig, error: selectError } = await supabase
      .from('scan_configs')
      .select('id, created_at')
      .eq('id', configId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Supabase error: ${selectError.message}`);
    }

    if (!existingConfig) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();

    // Update the config
    const { error: updateError } = await (supabase
      .from('scan_configs') as any)
      .update({
        name: payload.name,
        url: payload.url,
        config: payload.config,
        updated_at: now
      })
      .eq('id', configId);

    if (updateError) {
      throw new Error(`Supabase error: ${updateError.message}`);
    }

    // Return the updated config
    const updatedConfig: SavedScanConfig = {
      id: configId,
      name: payload.name,
      url: payload.url,
      config: payload.config,
      createdAt: (existingConfig as any).created_at as string,
      updatedAt: now
    };

    return NextResponse.json({
      message: 'Configuration updated successfully',
      config: updatedConfig
    });
  } catch (error) {
    console.error('Error updating configuration in Supabase:', error);
    throw error;
  }
}

// DELETE a specific configuration
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ configId: string }> }
) {
  try {
    const { configId } = await params;

    // Validate configId
    if (!configId || !validateConfigId(configId)) {
      return NextResponse.json(
        { error: 'Invalid configuration ID' },
        { status: 400 }
      );
    }

    // Check if using Supabase
    const useSupabase = await isUsingSupabase();

    if (useSupabase) {
      return await deleteConfigFromSupabase(configId);
    } else {
      return await deleteConfigFromPrisma(configId);
    }
  } catch (error) {
    console.error('Error deleting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved configuration' },
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