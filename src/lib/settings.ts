import fs from 'fs/promises';
import path from 'path';
import { AppSettings } from '@/app/api/settings/route';

const SETTINGS_FILE = '.app_settings.json';

export async function getAppSettings(): Promise<AppSettings> {
    const cwd = process.cwd();
    const possiblePaths = [
        path.join(cwd, SETTINGS_FILE),
        path.join(cwd, '.next', 'standalone', SETTINGS_FILE),
        path.join(cwd, '..', SETTINGS_FILE)
    ];

    for (const settingsFilePath of possiblePaths) {
        try {
            const data = await fs.readFile(settingsFilePath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            // Continue to next path
        }
    }

    // Default settings if file doesn't exist anywhere
    return {
        storageType: (process.env.STORAGE_TYPE as any) || 'sqlite',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        appUrl: 'http://localhost:3000'
    };
}

export async function getAppUrl(): Promise<string> {
    const settings = await getAppSettings();
    return settings.appUrl || 'http://localhost:3000';
}
