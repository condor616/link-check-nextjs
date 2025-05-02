import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { SavedScanConfig } from '../route';

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
    
    // Read the configuration file
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
  } catch (error) {
    console.error('Error getting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve saved configuration' },
      { status: 500 }
    );
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
    
    // Get updated config data
    const payload = await request.json();
    
    // Validate payload
    if (!payload.name || !payload.url || !payload.config) {
      return NextResponse.json(
        { error: 'Invalid payload: missing required fields' },
        { status: 400 }
      );
    }
    
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
  } catch (error) {
    console.error('Error updating saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to update saved configuration' },
      { status: 500 }
    );
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
  } catch (error) {
    console.error('Error deleting saved configuration:', error);
    return NextResponse.json(
      { error: 'Failed to delete saved configuration' },
      { status: 500 }
    );
  }
} 