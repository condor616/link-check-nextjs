import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // Fallback to .env

import { jobService } from '../src/lib/jobs';
import { WebsiteScanner, ScanResult, ScanState } from '../src/lib/scanner';

const POLLING_INTERVAL_MS = 1000;

async function processJob(job: any) {
    console.log(`Processing job ${job.id} for URL: ${job.scan_url}`);

    try {
        // If we are resuming, the status might already be 'queued' (set by resumeJob)
        // We update to 'running'
        await jobService.updateJobStatus(job.id, 'running');

        let lastProgressUpdate = Date.now();
        let lastStatusCheck = Date.now();
        let stopReason: 'paused' | 'stopped' | null = null;

        // Parse initial state if it exists (for resume)
        let initialState: ScanState | undefined;
        if (job.state) {
            try {
                initialState = JSON.parse(job.state);
                console.log(`Resuming job ${job.id} from saved state.`);
            } catch (e) {
                console.error(`Failed to parse job state for ${job.id}, starting fresh:`, e);
            }
        }

        const scanner = new WebsiteScanner(job.scan_url, job.scan_config, {
            onStart: (estimatedUrls) => {
                console.log(`Scan started. Estimated URLs: ${estimatedUrls}`);
            },
            onProgress: async (processedCount, currentUrl) => {
                const now = Date.now();

                // Throttle DB updates and checks
                if (now - lastProgressUpdate > 1000) {
                    // Update progress
                    jobService.updateJobProgress(job.id, {
                        percent: 0,
                        currentUrl,
                        scanned: processedCount,
                        total: 0
                    }).catch(err => console.error('Failed to update progress:', err));

                    lastProgressUpdate = now;
                }

                // Check for status changes (pause/stop signals)
                if (now - lastStatusCheck > 1000) {
                    try {
                        const currentJob = await jobService.getJob(job.id);
                        if (currentJob) {
                            if (currentJob.status === 'pausing') {
                                console.log(`Job ${job.id} pause requested.`);
                                stopReason = 'paused';
                                // Pause the scanner and get state
                                const state = await scanner.pause();
                                // Save state and update status
                                await jobService.updateJobState(job.id, JSON.stringify(state));
                                await jobService.updateJobStatus(job.id, 'paused');
                            } else if (currentJob.status === 'stopping') {
                                console.log(`Job ${job.id} stop requested.`);
                                stopReason = 'stopped';
                                await scanner.pause(); // Stop scanning cleanly
                                await jobService.updateJobStatus(job.id, 'stopped');
                            }
                        }
                    } catch (err) {
                        console.error('Error checking job status:', err);
                    }
                    lastStatusCheck = now;
                }
            },
            onError: (error) => {
                console.error(`Scan error for job ${job.id}:`, error);
            }
        }, initialState);

        const results = await scanner.scan();

        // If we stopped or paused, don't mark as completed
        if (stopReason) {
            console.log(`Job ${job.id} ${stopReason}. Exiting processing loop.`);
            return;
        }

        console.log(`Job ${job.id} completed. Found ${results.length} results.`);

        await jobService.updateJobStatus(job.id, 'completed', {
            results: results,
            urls_scanned: results.length,
            total_urls: results.length
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
