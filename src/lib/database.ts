import path from 'path';
import fs from 'fs';
import { getAppSettingsSync } from './settings';

/**
 * Robustly resolves the database URL based on the current storage settings.
 * This ensures that 'sqlite' mode and 'supabase' mode use strictly isolated databases.
 */
export function getDatabaseUrl(): string {
    // Default from environment
    let dbUrl = process.env.DATABASE_URL || 'file:./dev.db';

    // Only attempt file system operations in Node.js environment
    if (typeof window === 'undefined' && process.env.NEXT_RUNTIME !== 'edge') {
        try {
            const settings = getAppSettingsSync();
            const isSupabase = settings.storageType === 'supabase';

            if (isSupabase) {
                // If in supabase mode, prioritize SUPABASE_DATABASE_URL if set
                const supabaseDbUrl = process.env.SUPABASE_DATABASE_URL;
                if (supabaseDbUrl) {
                    dbUrl = supabaseDbUrl;
                } else if (dbUrl.startsWith('file:') && dbUrl.includes('dev.db')) {
                    // Fallback: use a separate SQLite file for Supabase mode to keep data completely separate
                    dbUrl = dbUrl.replace('dev.db', 'dev-supabase.db');
                }
            } else {
                // In local mode, ensure we ARE using dev.db and NOT a supabase fallback
                if (dbUrl.startsWith('file:') && dbUrl.includes('dev-supabase.db')) {
                    dbUrl = dbUrl.replace('dev-supabase.db', 'dev.db');
                }
            }

            // Handle relative SQLite paths
            if (dbUrl.startsWith('file:')) {
                const relativePath = dbUrl.replace('file:', '');
                if (!path.isAbsolute(relativePath)) {
                    const root = process.cwd().endsWith(path.join('.next', 'standalone')) 
                        ? path.dirname(path.dirname(process.cwd())) 
                        : process.cwd();
                    
                    let currentDir = root;
                    let absolutePath = '';

                    // Look up to 3 levels up for a 'prisma' directory
                    for (let i = 0; i < 3; i++) {
                        const checkPath = path.resolve(currentDir, 'prisma', relativePath.replace('./', ''));
                        const prismaDir = path.resolve(currentDir, 'prisma');
                        if (fs.existsSync(prismaDir)) {
                            absolutePath = checkPath;
                            break;
                        }
                        currentDir = path.dirname(currentDir);
                    }

                    if (absolutePath) {
                        dbUrl = `file:${absolutePath}`;
                    }
                }
            }
        } catch (err) {
            console.error('Failed to resolve database URL:', err);
        }
    }

    return dbUrl;
}
