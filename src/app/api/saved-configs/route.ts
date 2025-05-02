import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ScanConfig } from '@/lib/scanner';

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
    console.error('Error getting saved configurations:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved configurations' },
      { status: 500 }
    );
  }
}

// POST to save a new configuration
export async function POST(request: NextRequest) {
  try {
    await ensureConfigsDir();
    
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
    
    // Save to file
    const configFilePath = path.join(process.cwd(), SCAN_CONFIGS_DIR, `${sanitizedId}.json`);
    await fs.writeFile(
      configFilePath,
      JSON.stringify(savedConfig, null, 2)
    );
    
    return NextResponse.json(
      { 
        message: 'Configuration saved successfully',
        id: sanitizedId,
        config: savedConfig
      },
      { status: 201 }
    );
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