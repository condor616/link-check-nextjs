import { createClient } from '@supabase/supabase-js';
import { AppSettings } from '@/app/api/settings/route';
import fs from 'fs/promises';
import path from 'path';

// Environment variables are used as fallback if no custom settings are provided
const DEFAULT_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const DEFAULT_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Cache for the Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let lastSettings: { url: string; key: string } | null = null;

// Cache for settings to avoid excessive disk reads
let cachedSettings: AppSettings | null = null;
let lastSettingsRead = 0;
const SETTINGS_CACHE_TTL = 1000; // 1 second

const SETTINGS_FILE = '.app_settings.json';

// Get settings from settings file
async function getSettings(): Promise<AppSettings | null> {
  const now = Date.now();
  if (cachedSettings && (now - lastSettingsRead < SETTINGS_CACHE_TTL)) {
    return cachedSettings;
  }

  try {
    const settingsFilePath = path.join(process.cwd(), SETTINGS_FILE);

    try {
      await fs.access(settingsFilePath);
      const settingsData = await fs.readFile(settingsFilePath, 'utf-8');
      cachedSettings = JSON.parse(settingsData) as AppSettings;
      lastSettingsRead = now;
      return cachedSettings;
    } catch (error) {
      // Don't log if file doesn't exist, it's a valid state (defaults will be used)
      return null;
    }
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
}

// Initialize Supabase client with current settings
export async function getSupabaseClient() {
  try {
    // Get current settings
    const settings = await getSettings();

    // Determine if we should use Supabase and get credentials
    const envStorageType = process.env.STORAGE_TYPE;
    const useSupabase = (envStorageType === 'supabase') || (settings?.storageType === 'supabase');

    // Credentials priority: env var > settings field > fallback default (which is env var anyway)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || (useSupabase && settings?.supabaseUrl ? settings.supabaseUrl : DEFAULT_SUPABASE_URL);
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || (useSupabase && settings?.supabaseKey ? settings.supabaseKey : DEFAULT_SUPABASE_ANON_KEY);

    // Return null if Supabase is not enabled or credentials are missing
    if (!useSupabase || !supabaseUrl || !supabaseKey) {
      return null;
    }

    // Check if settings have changed since last initialization
    const settingsChanged =
      !lastSettings ||
      lastSettings.url !== supabaseUrl ||
      lastSettings.key !== supabaseKey;

    // Create new client if needed
    if (!supabaseInstance || settingsChanged) {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false
        }
      });

      // Update last settings
      lastSettings = {
        url: supabaseUrl,
        key: supabaseKey
      };
    }

    return supabaseInstance;
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return null;
  }
}

// Check if the application is using Supabase storage
export async function isUsingSupabase(): Promise<boolean> {
  if (process.env.STORAGE_TYPE === 'supabase') return true;
  const settings = await getSettings();
  return settings?.storageType === 'supabase';
}