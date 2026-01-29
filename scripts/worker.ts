import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

import fs from 'fs/promises';
import path from 'path';
import { jobService } from '../src/lib/jobs';
import { processJob } from '../src/lib/worker-core';
import { isUsingSupabase, getSupabaseClient } from '../src/lib/supabase';
import { prisma } from '../src/lib/prisma';

import { getAppSettings } from '../src/lib/settings';

const POLLING_INTERVAL_MS = 1000;
const SETUP_CHECK_INTERVAL_MS = 5000;

async function checkSetup() {
    try {
        const settings = await getAppSettings();

        // If we don't have a settings file yet, we are definitely NOT setup
        // (Wait for the user to finish the wizard)
        const cwd = process.cwd();
        const settingsFileExists = await fs.access(path.join(cwd, '.app_settings.json')).then(() => true).catch(() => false) ||
            await fs.access(path.join(cwd, '..', '.app_settings.json')).then(() => true).catch(() => false);

        if (!settingsFileExists) return false;

        const useSupabase = settings.storageType === 'supabase';
        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) return false;
            // Check if tables exist
            const { error } = await supabase.from('scan_jobs').select('id').limit(1);
            if (error) return false;
        } else {
            // SQLite: Check if the database file exists
            const dbUrl = process.env.DATABASE_URL || 'file:./prisma/dev.db';
            let dbFileExists = false;
            if (dbUrl.startsWith('file:')) {
                const relativePath = dbUrl.replace('file:', '');
                // Check common locations
                const possiblePaths = [
                    path.resolve(cwd, relativePath),
                    path.resolve(cwd, 'prisma', relativePath.replace('./', '')),
                    path.resolve(cwd, '..', '..', 'prisma', relativePath.replace('./', '')),
                ];
                for (const p of possiblePaths) {
                    try {
                        await fs.access(p);
                        dbFileExists = true;
                        break;
                    } catch { }
                }
            }

            if (!dbFileExists) return false;

            // Final check: Can we actually query?
            await prisma.job.count();
        }
        return true;
    } catch (e) {
        return false;
    }
}

async function startWorker() {
    console.log('Worker starting up...');

    let setupLogged = false;
    while (!(await checkSetup())) {
        if (!setupLogged) {
            console.log('Worker waiting for application setup to complete...');
            setupLogged = true;
        }
        await new Promise(resolve => setTimeout(resolve, SETUP_CHECK_INTERVAL_MS));
    }

    console.log('Setup detected! Cleaning up orphaned jobs...');

    // Clean up orphaned jobs
    try {
        const jobs = await jobService.getJobs();
        const orphanedJobs = jobs.filter(j => ['running', 'pausing', 'stopping'].includes(j.status));

        if (orphanedJobs.length > 0) {
            console.log(`Found ${orphanedJobs.length} orphaned jobs. Resetting to 'queued'.`);
            for (const job of orphanedJobs) {
                await jobService.updateJobStatus(job.id, 'queued');
            }
        }
    } catch (err) {
        console.error('Failed to cleanup orphaned jobs:', err);
    }

    console.log('Worker ready. Polling for jobs...');

    while (true) {
        try {
            const job = await jobService.getNextPendingJob();

            if (job) {
                await processJob(job);
            } else {
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }
        } catch (error) {
            console.error('Worker error:', error);
            await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('Worker shutting down...');
    process.exit(0);
});

startWorker();

