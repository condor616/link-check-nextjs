import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ScanConfig } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

// Define the expected structure for saved configurations
export interface SavedScanConfig {
  id: string;
  name: string;
  url: string;
  config: ScanConfig;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

const SCAN_CONFIGS_DIR = '.scan_configs';

// Ensure configs directory exists
async function ensureConfigsDir() {
  try {
    await fs.access(path.join(process.cwd(), SCAN_CONFIGS_DIR));
  } catch (_) {
    // Directory doesn't exist, create it
    await fs.mkdir(path.join(process.cwd(), SCAN_CONFIGS_DIR), { recursive: true });
  }
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
        // Return empty array instead of throwing an error
        return NextResponse.json([]);
      }
    } else {
      return await getConfigsFromFiles();
    }
  } catch (error) {
    console.error('Error getting saved configurations:', error);
    // Return empty array instead of error to avoid breaking the UI
    return NextResponse.json([]);
  }
}

// Get configs from file storage
async function getConfigsFromFiles() {
  try {
    await ensureConfigsDir();
    
    // Read all files in the configs directory
    const files = await fs.readdir(path.join(process.cwd(), SCAN_CONFIGS_DIR));
    const configFiles = files.filter(file => file.endsWith('.json'));
    
    // Read and parse each config file
    const configs: SavedScanConfig[] = [];
    for (const file of configFiles) {
      try {
        const fileContent = await fs.readFile(
          path.join(process.cwd(), SCAN_CONFIGS_DIR, file),
          'utf-8'
        );
        const config = JSON.parse(fileContent) as SavedScanConfig;
        configs.push(config);
      } catch (err) {
        console.error(`Error reading config file ${file}:`, err);
        // Skip invalid files
      }
    }
    
    // Sort by most recently updated
    configs.sort((a, b) => 
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    
    return NextResponse.json(configs);
  } catch (error) {
    console.error('Error getting configurations from files:', error);
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
    
    // Convert Supabase format to our app format
    const configs = data.map(item => ({
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
      return await saveConfigToFile(savedConfig);
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

// Save config to file storage
async function saveConfigToFile(config: SavedScanConfig) {
  try {
    await ensureConfigsDir();
    
    // Save to file
    const configFilePath = path.join(process.cwd(), SCAN_CONFIGS_DIR, `${config.id}.json`);
    await fs.writeFile(
      configFilePath,
      JSON.stringify(config, null, 2)
    );
    
    return NextResponse.json(
      { 
        message: 'Configuration saved successfully to file',
        id: config.id,
        config: config
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error saving configuration to file:', error);
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
      result = await supabase
        .from('scan_configs')
        .update({
          name: config.name,
          url: config.url,
          config: config.config,
          updated_at: config.updatedAt
        })
        .eq('id', config.id);
    } else {
      // Insert new config
      result = await supabase
        .from('scan_configs')
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
      return await deleteConfigFromFile(id);
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

// Delete config from file storage
async function deleteConfigFromFile(id: string) {
  try {
    await ensureConfigsDir();
    
    const configFilePath = path.join(process.cwd(), SCAN_CONFIGS_DIR, `${id}.json`);
    
    try {
      await fs.access(configFilePath);
    } catch (_) {
      return NextResponse.json(
        { error: 'Configuration not found' },
        { status: 404 }
      );
    }
    
    // Delete the file
    await fs.unlink(configFilePath);
    
    return NextResponse.json(
      { message: 'Configuration deleted successfully from file' }
    );
  } catch (error) {
    console.error('Error deleting configuration from file:', error);
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