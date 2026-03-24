import { createClient } from '@supabase/supabase-js';
import { getAppSettings } from './settings';

// Cache for the Supabase client instance
let supabaseInstance: ReturnType<typeof createClient> | null = null;
let supabaseAdminInstance: ReturnType<typeof createClient> | null = null;
let lastSettings: { url: string; key: string } | null = null;
let lastAdminSettings: { url: string; key: string } | null = null;

// Initialize Supabase client with current settings (Anon/Public)
export async function getSupabaseClient() {
  try {
    const settings = await getAppSettings();
    const useSupabase = settings.storageType === 'supabase';

    const supabaseUrl = (settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
    const supabaseKey = (settings.supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY)?.trim();

    if (!useSupabase || !supabaseUrl || !supabaseKey) {
      return null;
    }

    const settingsChanged =
      !lastSettings ||
      lastSettings.url !== supabaseUrl ||
      lastSettings.key !== supabaseKey;

    if (!supabaseInstance || settingsChanged) {
      supabaseInstance = createClient(supabaseUrl, supabaseKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      lastSettings = { url: supabaseUrl, key: supabaseKey };
    }

    return supabaseInstance;
  } catch (error) {
    console.error('Error initializing Supabase client:', error);
    return null;
  }
}

// Initialize Supabase ADMIN client (using Service Role Key)
export async function getSupabaseAdminClient() {
  try {
    const settings = await getAppSettings();
    const useSupabase = settings.storageType === 'supabase';

    const supabaseUrl = (settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)?.trim();
    const serviceKey = (settings.supabaseServiceKey || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();

    if (!useSupabase || !supabaseUrl || !serviceKey) {
      return null;
    }

    const settingsChanged =
      !lastAdminSettings ||
      lastAdminSettings.url !== supabaseUrl ||
      lastAdminSettings.key !== serviceKey;

    if (!supabaseAdminInstance || settingsChanged) {
      supabaseAdminInstance = createClient(supabaseUrl, serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });

      lastAdminSettings = { url: supabaseUrl, key: serviceKey };
    }

    return supabaseAdminInstance;
  } catch (error) {
    console.error('Error initializing Supabase Admin client:', error);
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

// Ensure the user exists in the Supabase public.users table.
// This satisfies foreign key constraints on scan_configs, scan_history, etc.
// It is a safe upsert — a no-op if the user already exists.
export async function ensureUserInSupabase(user: {
  id: string;
  email: string;
  role?: string;
  hasAccess?: boolean;
  maxJobs?: number;
}): Promise<void> {
  try {
    const supabase = await getSupabaseClient();
    if (!supabase) return;

    const { error } = await (supabase.from('users') as any).upsert(
      {
        id: user.id,
        email: user.email,
        role: user.role || 'user',
        has_access: user.hasAccess ?? false,
        max_jobs: user.maxJobs ?? 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id', ignoreDuplicates: false }
    );

    if (error) {
      console.warn('ensureUserInSupabase: could not upsert user row:', error.message);
    }
  } catch (err) {
    // Non-fatal — log and continue. The FK insert may still succeed if the
    // user row was written by a previous call (e.g. the setup wizard).
    console.warn('ensureUserInSupabase: unexpected error:', err);
  }
}