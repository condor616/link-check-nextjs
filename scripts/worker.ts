import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

import { jobService } from '../src/lib/jobs';
import { scanWebsite, ScanResult } from '../src/lib/scanner';

const POLLING_INTERVAL_MS = 2000;

async function processJob(job: any) {
    console.log(`Processing job ${job.id} for URL: ${job.scan_url}`);

    try {
        await jobService.updateJobStatus(job.id, 'running');

        let lastProgressUpdate = Date.now();

        const results = await scanWebsite(job.scan_url, job.scan_config, {
            onStart: (estimatedUrls) => {
                console.log(`Scan started. Estimated URLs: ${estimatedUrls}`);
            },
            onProgress: (processedCount, currentUrl) => {
                // Throttle updates to DB to avoid overwhelming it
                const now = Date.now();
                if (now - lastProgressUpdate > 1000) {
                    jobService.updateJobProgress(job.id, {
                        percent: 0, // We don't know total yet really, unless we estimate
                        currentUrl,
                        scanned: processedCount,
                        total: 0 // Unknown
                    }).catch(err => console.error('Failed to update progress:', err));
                    lastProgressUpdate = now;
                }
            },
            onError: (error) => {
                console.error(`Scan error for job ${job.id}:`, error);
            }
        });

        console.log(`Job ${job.id} completed. Found ${results.length} results.`);

        // Save results (we might want to store them in a separate table or file, 
        // but for now let's put them in the job record or handle them as the original app did)
        // The original app saved to file or Supabase `scan_history`.
        // Let's update the job with results for now, as our schema supports it.

        await jobService.updateJobStatus(job.id, 'completed', {
            results: results,
            urls_scanned: results.length,
            total_urls: results.length // Total is what we found
        });

    } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error);
        await jobService.updateJobStatus(job.id, 'failed', {
            error: error.message || 'Unknown error'
        });
    }
}

async function startWorker() {
    console.log('Worker started. Polling for jobs...');

    while (true) {
        try {
            const job = await jobService.getNextPendingJob();

            if (job) {
                await processJob(job);
            } else {
                // No jobs, wait a bit
                await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
            }
        } catch (error) {
            console.error('Worker error:', error);
            // Wait a bit before retrying to avoid tight loop on error
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
