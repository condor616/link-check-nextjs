import fs from 'fs/promises';
import path from 'path';
import { AppSettings } from '@/app/api/settings/route';

const SETTINGS_FILE = '.app_settings.json';

export async function getAppSettings(): Promise<AppSettings> {
    try {
        const settingsFilePath = path.join(process.cwd(), SETTINGS_FILE);
        const data = await fs.readFile(settingsFilePath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // Return default settings if file doesn't exist or is corrupted
        return {
            storageType: 'file',
            appUrl: 'http://localhost:3000'
        };
    }
}

export async function getAppUrl(): Promise<string> {
    const settings = await getAppSettings();
    return settings.appUrl || 'http://localhost:3000';
}
