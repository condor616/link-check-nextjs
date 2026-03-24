import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SETTINGS_FILE = '.app_settings.json';
const DB_FILE = 'prisma/dev.db';

async function reset() {
    console.log('🚀 Starting fresh reset...');

    // 1. Delete settings file
    if (fs.existsSync(SETTINGS_FILE)) {
        try {
            fs.unlinkSync(SETTINGS_FILE);
            console.log('✅ Deleted .app_settings.json');
        } catch (err) {
            console.error('❌ Failed to delete .app_settings.json:', err);
        }
    } else {
        console.log('ℹ️  .app_settings.json not found, skipping.');
    }

    // 2. Clear SQLite Databases
    const dbFiles = ['prisma/dev.db', 'prisma/dev-supabase.db'];
    for (const file of dbFiles) {
        if (fs.existsSync(file)) {
            try {
                fs.unlinkSync(file);
                console.log(`✅ Deleted ${file}`);
            } catch (err) {
                console.error(`❌ Failed to delete ${file}:`, err);
            }
        }
    }

    // 3. Re-initialize Database Schema (will use default dev.db since settings were deleted)
    console.log('📦 Re-initializing database schema...');
    try {
        execSync('npx prisma db push', { stdio: 'inherit' });
        console.log('✅ Database schema re-initialized.');
    } catch (err) {
        console.error('❌ Failed to re-initialize database schema:', err);
    }

    console.log('\n✨ Reset complete! The app is now in a "fresh start" state.');
    console.log('👉 Restart your dev server and visit http://localhost:3000 to start the Setup Wizard.');
}

reset();
