import { jobService, ScanJob } from './jobs';
import { WebsiteScanner, ScanResult, ScanState } from './scanner';
import { getAppSettings } from './settings';

export async function processJob(job: ScanJob) {
    console.log(`Processing job ${job.id} for URL: ${job.scan_url}`);

    try {
        // Get global settings to check for rate limiting
        const appSettings = await getAppSettings();

        // Merge global rate limit setting into job config if not present or override it
        // We prioritize the global setting for safety, or we could check if job has it.
        // For now, let's inject it.
        if (appSettings.maxScansPerMinute) {
            job.scan_config.maxScansPerMinute = appSettings.maxScansPerMinute;
            console.log(`Applying global rate limit: ${appSettings.maxScansPerMinute} scans/minute`);
        }

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
                initialState = typeof job.state === 'string' ? JSON.parse(job.state) : job.state;
                console.log(`Resuming job ${job.id} from saved state.`);
            } catch (e) {
                console.error(`Failed to parse job state for ${job.id}, starting fresh:`, e);
            }
        }

        const scanner = new WebsiteScanner(job.scan_url, job.scan_config, {
            onStart: (estimatedUrls) => {
                console.log(`Scan started. Estimated URLs: ${estimatedUrls}`);
            },
            onProgress: async (processedCount, currentUrl, brokenCount, totalCount) => {
                const now = Date.now();

                // Throttle DB updates and checks
                if (now - lastProgressUpdate > 1000) {
                    lastProgressUpdate = now; // Set early
                    const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0;

                    // Update progress
                    jobService.updateJobProgress(job.id, {
                        percent: progressPercent,
                        currentUrl,
                        scanned: processedCount,
                        total: totalCount,
                        brokenLinks: brokenCount,
                        totalLinks: totalCount
                    }).catch(err => console.error('Failed to update progress:', err));

                    lastProgressUpdate = now;
                }

                // Check for status changes (pause/stop signals)
                if (now - lastStatusCheck > 1000) {
                    lastStatusCheck = now;
                    try {
                        const status = await jobService.getJobStatus(job.id);
                        if (!status) {
                            console.log(`Job ${job.id} no longer exists. Aborting scanner.`);
                            stopReason = 'stopped';
                            await scanner.stop();
                            return;
                        }

                        if (status === 'pausing') {
                            console.log(`Job ${job.id} pause requested.`);
                            stopReason = 'paused';
                            const state = await scanner.pause();
                            await jobService.updateJobState(job.id, JSON.stringify(state));
                            await jobService.updateJobStatus(job.id, 'paused');
                        } else if (status === 'stopping') {
                            console.log(`Job ${job.id} stop requested.`);
                            stopReason = 'stopped';
                            await scanner.stop();
                            await jobService.updateJobStatus(job.id, 'stopped');
                        }
                    } catch (err) {
                        console.error('Error checking job status (will retry):', err);
                    }
                }
            },
            onError: (error: Error) => {
                console.error(`Scan error for job ${job.id}:`, error);
            },
            onLog: (log) => {
                // Determine if we should log based on config (though scanner checks too)
                if (job.scan_config.enableLogging) {
                    // We don't await this to avoid blocking the scan process
                    // Using prisma.scanLog.create
                    import('./prisma').then(({ prisma }) => {
                        prisma.scanLog.create({
                            data: {
                                jobId: job.id,
                                level: log.level,
                                message: log.message,
                                data: log.data ? JSON.stringify(log.data) : null,
                                createdAt: new Date(log.timestamp)
                            }
                        }).catch(err => console.error('Failed to write log to DB:', err));
                    });
                }
            }
        }, initialState);

        const results = await scanner.scan();

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

        return results;

    } catch (error: any) {
        console.error(`Job ${job.id} failed:`, error);
        await jobService.updateJobStatus(job.id, 'failed', {
            error: error.message || 'Unknown error'
        });
        throw error;
    }
}
