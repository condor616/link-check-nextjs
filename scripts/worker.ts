import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

import { jobService } from '../src/lib/jobs';
import { processJob } from '../src/lib/worker-core';

const POLLING_INTERVAL_MS = 1000;

async function startWorker() {
    console.log('Worker starting up...');

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

