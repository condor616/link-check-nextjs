import { createClient } from '@supabase/supabase-js';
import { getAppSettings } from './settings';

// Cache for the Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let lastSettings: { url: string; key: string } | null = null;

// Initialize Supabase client with current settings
export async function getSupabaseClient() {
  try {
    // Get current settings (uses standardized root-detection logic)
    const settings = await getAppSettings();

    // Determine if we should use Supabase
    const useSupabase = settings.storageType === 'supabase';

    // Credentials priority: settings field > env var fallback
    const supabaseUrl = settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = settings.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

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
  const settings = await getAppSettings();
  if (settings && settings.storageType) {
    return settings.storageType === 'supabase';
  }
  return process.env.STORAGE_TYPE === 'supabase';
}