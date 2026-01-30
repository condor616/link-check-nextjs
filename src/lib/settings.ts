import fs from 'fs/promises';
import path from 'path';
import { AppSettings } from '@/app/api/settings/route';

const SETTINGS_FILE = '.app_settings.json';
const TEMPLATE_FILE = '.app_settings.template.json';

/**
 * Finds the project root directory.
 * When running in standalone mode, process.cwd() might be inside .next/standalone.
 */
export function getProjectRoot(): string {
    const cwd = process.cwd();
    // If we are in .next/standalone, the root is the SAME directory in Docker (WORKDIR /app)
    // Dockerfile copies standalone content directly to /app
    // But let's keep it robust:
    if (cwd.endsWith(path.join('.next', 'standalone'))) {
        return path.dirname(path.dirname(cwd));
    }
    return cwd;
}

export async function getAppSettings(): Promise<AppSettings> {
    const root = getProjectRoot();
    const settingsPath = path.join(root, SETTINGS_FILE);
    const templatePath = path.join(root, TEMPLATE_FILE);

    try {
        const data = await fs.readFile(settingsPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        // If settings file doesn't exist, try to load from template
        try {
            const templateData = await fs.readFile(templatePath, 'utf-8');
            return JSON.parse(templateData);
        } catch (templateError) {
            // Default settings if template also doesn't exist
            return {
                storageType: (process.env.STORAGE_TYPE as any) || 'sqlite',
                supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
                supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
                appUrl: 'http://localhost:3000'
            };
        }
    }
}

export async function getAppUrl(): Promise<string> {
    const settings = await getAppSettings();
    return settings.appUrl || 'http://localhost:3000';
}

