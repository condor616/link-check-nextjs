import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SavedScanConfig } from '../route';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { ScanConfig } from '@/lib/scanner';

const SCAN_CONFIGS_DIR = '.scan_configs';

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
        // Fall back to file if Supabase fails
        return await getConfigFromFile(configId);
      }
    } else {
      return await getConfigFromFile(configId);
    }
  } catch (error) {
    console.error('Error getting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved configuration' },
      { status: 500 }
    );
  }
}

// Helper function to get config from file
async function getConfigFromFile(configId: string) {
  try {
    const fileContent = await fs.readFile(
      path.join(process.cwd(), SCAN_CONFIGS_DIR, `${configId}.json`),
      'utf-8'
    );

    const config = JSON.parse(fileContent) as SavedScanConfig;
    return NextResponse.json(config);
  } catch (err) {
    if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }

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
      return await updateConfigInFile(configId, payload);
    }
  } catch (error) {
    console.error('Error updating saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update saved configuration' },
      { status: 500 }
    );
  }
}

// Helper function to update config in file
async function updateConfigInFile(configId: string, payload: any) {
  // Check if configuration exists
  const configPath = path.join(process.cwd(), SCAN_CONFIGS_DIR, `${configId}.json`);
  try {
    await fs.access(configPath);
  } catch (err) {
    return NextResponse.json(
      { error: 'Configuration not found' },
      { status: 404 }
    );
  }

  // Parse existing config to preserve createdAt
  const existingConfig = JSON.parse(
    await fs.readFile(configPath, 'utf-8')
  ) as SavedScanConfig;

  // Update the configuration
  const updatedConfig: SavedScanConfig = {
    id: configId,
    name: payload.name,
    url: payload.url,
    config: payload.config,
    createdAt: existingConfig.createdAt,
    updatedAt: new Date().toISOString()
  };

  // Save updated config
  await fs.writeFile(
    configPath,
    JSON.stringify(updatedConfig, null, 2)
  );

  return NextResponse.json({
    message: 'Configuration updated successfully',
    config: updatedConfig
  });
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
      return await deleteConfigFromFile(configId);
    }
  } catch (error) {
    console.error('Error deleting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved configuration' },
      { status: 500 }
    );
  }
}

// Helper function to delete config from file
async function deleteConfigFromFile(configId: string) {
  // Check if configuration exists
  const configPath = path.join(process.cwd(), SCAN_CONFIGS_DIR, `${configId}.json`);
  try {
    await fs.access(configPath);
  } catch (err) {
    return NextResponse.json(
      { error: 'Configuration not found' },
      { status: 404 }
    );
  }

  // Delete the configuration file
  await fs.unlink(configPath);

  return NextResponse.json({
    message: 'Configuration deleted successfully'
  });
}

// Helper function to delete config from Supabase
async function deleteConfigFromSupabase(configId: string) {
  try {
    const supabase = await getSupabaseClient();

    if (!supabase) {
      throw new Error('Supabase client is not available');
    }

    // Check if config exists first
    const { data: existingConfig, error: selectError } = await supabase
      .from('scan_configs')
      .select('id')
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

    // Delete the config
    const { error: deleteError } = await supabase
      .from('scan_configs')
      .delete()
      .eq('id', configId);

    if (deleteError) {
      throw new Error(`Supabase error: ${deleteError.message}`);
    }

    return NextResponse.json({
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting configuration from Supabase:', error);
    throw error;
  }
} 