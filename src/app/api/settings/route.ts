import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Define the settings interface
export interface AppSettings {
  storageType: 'file' | 'sqlite' | 'supabase';
  supabaseUrl?: string;
  supabaseKey?: string;
  appUrl?: string;
}

const SETTINGS_FILE = '.app_settings.json';

// Helper to ensure settings file exists
async function ensureSettingsFile() {
  try {
    const settingsFilePath = path.join(process.cwd(), SETTINGS_FILE);

    try {
      await fs.access(settingsFilePath);
    } catch (_) {
      // If settings file doesn't exist, create it with default settings
      const defaultSettings: AppSettings = {
        storageType: 'sqlite',
        appUrl: 'http://localhost:3000'
      };

      await fs.writeFile(
        settingsFilePath,
        JSON.stringify(defaultSettings, null, 2)
      );
    }

    return settingsFilePath;
  } catch (error) {
    console.error('Error ensuring settings file:', error);
    throw error;
  }
}

// GET to retrieve settings
export async function GET() {
  try {
    const settingsFilePath = await ensureSettingsFile();

    // Read settings from file
    const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
    const settings = JSON.parse(settingsData) as AppSettings;

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
    const settingsFilePath = await ensureSettingsFile();

    // Get current settings
    const currentSettingsData = await fs.readFile(settingsFilePath, 'utf-8');
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

    // Merge settings
    const updatedSettings = {
      ...currentSettings,
      ...newSettings,
    };

    // Save updated settings
    await fs.writeFile(
      settingsFilePath,
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