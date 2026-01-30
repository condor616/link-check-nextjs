import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the settings interface
export interface AppSettings {
  storageType: 'file' | 'sqlite' | 'supabase';
  supabaseUrl?: string;
  supabaseKey?: string;
  appUrl?: string;
  maxScansPerMinute?: number;
}

const SETTINGS_FILE = '.app_settings.json';

/**
 * Finds the project root directory.
 * When running in standalone mode, process.cwd() might be inside .next/standalone.
 */
function getProjectRoot(): string {
  const cwd = process.cwd();
  // If we are in .next/standalone, the root is the parent directory
  if (cwd.endsWith(path.join('.next', 'standalone'))) {
    return path.dirname(path.dirname(cwd));
  }
  return cwd;
}

// Helper to ensure settings file exists
async function getSettingsPath(createIfMissing = false) {
  try {
    const root = getProjectRoot();
    const settingsFilePath = path.join(root, SETTINGS_FILE);

    try {
      await fs.access(settingsFilePath);
    } catch (_) {
      if (!createIfMissing) {
        return null;
      }
      // Create it with default settings if requested
      const defaultSettings: AppSettings = {
        storageType: 'sqlite',
        appUrl: 'http://localhost:3000',
        maxScansPerMinute: 60
      };

      await fs.writeFile(
        settingsFilePath,
        JSON.stringify(defaultSettings, null, 2)
      );
    }

    return settingsFilePath;
  } catch (error) {
    console.error('Error getting settings path:', error);
    throw error;
  }
}


// GET to retrieve settings
export async function GET() {
  try {
    const settingsFilePath = await getSettingsPath();

    if (!settingsFilePath) {
      // Return default settings if none exist
      return NextResponse.json({
        storageType: (process.env.STORAGE_TYPE as any) || 'sqlite',
        appUrl: 'http://localhost:3000',
        maxScansPerMinute: 60
      });
    }

    // Read settings from file
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(settingsData) as AppSettings;

    // Ensure maxScansPerMinute exists
    if (settings.maxScansPerMinute === undefined) {
      settings.maxScansPerMinute = 60;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error retrieving settings:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve settings' },
      { status: 500 }
    );
  }
}

// POST to update settings
export async function POST(request: NextRequest) {
  try {
    const settingsFilePath = await getSettingsPath(true); // Create if missing on save

    // Path definitely exists now due to true flag
    const currentSettingsData = await fs.readFile(settingsFilePath!, 'utf-8');
    const currentSettings = JSON.parse(currentSettingsData) as AppSettings;

    // Get new settings from request
    const newSettings = await request.json() as Partial<AppSettings>;

    // Validate settings
    if (newSettings.storageType &&
      !['file', 'sqlite', 'supabase'].includes(newSettings.storageType)) {
      return NextResponse.json(
        { error: 'Invalid storage type' },
        { status: 400 }
      );
    }

    // If switching to Supabase, validate URL and key
    if (newSettings.storageType === 'supabase') {
      if (!newSettings.supabaseUrl || !newSettings.supabaseKey) {
        return NextResponse.json(
          { error: 'Supabase URL and key are required when using Supabase storage' },
          { status: 400 }
        );
      }
    }

    // Validate maxScansPerMinute if provided
    if (newSettings.maxScansPerMinute !== undefined) {
      if (typeof newSettings.maxScansPerMinute !== 'number' || newSettings.maxScansPerMinute <= 0) {
        return NextResponse.json(
          { error: 'Max scans per minute must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Merge settings
    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
    };

    // Save updated settings
    await fs.writeFile(
      settingsFilePath as string,
      JSON.stringify(updatedSettings, null, 2)
    );

    return NextResponse.json({
      message: 'Settings updated successfully',
      settings: updatedSettings
    });
  } catch (error) {
    console.error('Error updating settings:', error);

    let errorMessage = 'Failed to update settings';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}  