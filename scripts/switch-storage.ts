#!/usr/bin/env tsx
/**
 * npm run switch
 * Interactively switch the active storage backend between SQLite and Supabase.
 * No data is ever deleted — only the storageType field in .app_settings.json changes.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

const SETTINGS_FILE = path.join(process.cwd(), '.app_settings.json');

type StorageType = 'sqlite' | 'supabase';

interface AppSettings {
    storageType: StorageType;
    supabaseUrl?: string;
    supabaseKey?: string;
    supabaseServiceKey?: string;
    appUrl?: string;
    maxScansPerMinute?: number;
    maxConcurrentJobs?: number;
    [key: string]: unknown;
}

function readSettings(): AppSettings {
    if (!fs.existsSync(SETTINGS_FILE)) {
        console.error('❌  .app_settings.json not found. Have you run the Setup Wizard yet?');
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
}

function writeSettings(settings: AppSettings): void {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
}

function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

function banner(current: StorageType) {
    console.log('\n╔══════════════════════════════════════╗');
    console.log('║      Storage Backend Switcher        ║');
    console.log('╚══════════════════════════════════════╝\n');
    const label = current === 'sqlite' ? 'Local SQLite' : 'Supabase';
    console.log(`  Currently active: ${label}\n`);
}

async function main() {
    const settings = readSettings();
    const current = settings.storageType ?? 'sqlite';

    banner(current);

    // Build menu
    const options: Array<{ key: string; label: string; value: StorageType }> = [
        { key: '1', label: 'Local SQLite  (prisma/dev.db)', value: 'sqlite' },
        { key: '2', label: 'Supabase      (cloud PostgreSQL)', value: 'supabase' },
    ];

    options.forEach(o => {
        const active = o.value === current ? '  ← active' : '';
        console.log(`  [${o.key}] ${o.label}${active}`);
    });
    console.log('  [q] Quit — do nothing\n');

    const answer = await prompt('  Switch to (1/2/q): ');

    if (answer.toLowerCase() === 'q' || answer === '') {
        console.log('\n  Nothing changed. Bye!\n');
        process.exit(0);
    }

    const chosen = options.find(o => o.key === answer);
    if (!chosen) {
        console.error('\n  ❌  Invalid choice. Nothing changed.\n');
        process.exit(1);
    }

    const target = chosen.value;

    if (target === current) {
        console.log(`\n  ✅  Already using ${chosen.label.trim()}. Nothing to do.\n`);
        process.exit(0);
    }

    // Validate target has credentials when switching to Supabase
    if (target === 'supabase') {
        const hasUrl = !!settings.supabaseUrl?.trim();
        const hasKey = !!settings.supabaseKey?.trim();

        if (!hasUrl || !hasKey) {
            console.log('\n  ⚠️   Cannot switch to Supabase — credentials are missing.');
            console.log('      Please configure Supabase credentials first:');
            if (!hasUrl) console.log('        • supabaseUrl is not set');
            if (!hasKey) console.log('        • supabaseKey (anon key) is not set');
            console.log('\n      You can set these in the app Settings page, or by running');
            console.log('      the Setup Wizard again (npm run reset, then restart).\n');
            process.exit(1);
        }

        console.log('\n  Supabase credentials found:');
        console.log(`    URL: ${settings.supabaseUrl}`);
        const keyPreview = settings.supabaseKey!.slice(0, 20) + '...' + settings.supabaseKey!.slice(-6);
        console.log(`    Key: ${keyPreview}`);
        if (settings.supabaseServiceKey?.trim()) {
            console.log('    Service Role Key: ✓ present');
        } else {
            console.log('    Service Role Key: ✗ not set (non-admin logins may require email confirmation)');
        }
        console.log('');
    }

    if (target === 'sqlite') {
        const fs2 = await import('fs');
        const dbFile = path.join(process.cwd(), 'prisma', 'dev.db');
        if (!fs2.existsSync(dbFile)) {
            console.log('\n  ⚠️   prisma/dev.db does not exist yet.');
            console.log('      After switching, run: npx prisma db push');
            console.log('      Then restart the dev server and complete the Setup Wizard.\n');
        }
    }

    // Confirm
    const fromLabel = current === 'sqlite' ? 'Local SQLite' : 'Supabase';
    const toLabel = target === 'sqlite' ? 'Local SQLite' : 'Supabase';
    const confirm = await prompt(`  Switch from ${fromLabel} → ${toLabel}? (y/N): `);

    if (confirm.toLowerCase() !== 'y') {
        console.log('\n  Cancelled. Nothing changed.\n');
        process.exit(0);
    }

    // Apply
    const updated: AppSettings = { ...settings, storageType: target };
    writeSettings(updated);

    console.log(`\n  ✅  Switched to ${toLabel}!`);
    console.log('  → Restart your dev server for the change to take effect.');
    console.log('  → NOTE: You will need to log in again in the browser to use the new storage.\n');

    if (target === 'sqlite') {
        const dbFile = path.join(process.cwd(), 'prisma', 'dev.db');
        const fs2 = await import('fs');
        if (!fs2.existsSync(dbFile)) {
            console.log('  ℹ️  No local database found. Run the following and then the Setup Wizard:');
            console.log('     npx prisma db push\n');
        }
    }
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
