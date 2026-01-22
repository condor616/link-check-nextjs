import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ScanConfig, ScanResult } from './scanner';
import { v4 as uuidv4 } from 'uuid';
import { historyService, SaveScanPayload } from './history';
import { prisma } from './prisma';

// --- Types ---

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'pausing' | 'paused' | 'stopping' | 'stopped';

export interface ScanJob {
    id: string;
    status: JobStatus;
    scan_url: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    progress_percent: number;
    current_url?: string;
    urls_scanned: number;
    total_urls: number;
    scan_config: ScanConfig;
    error?: string;
    results?: ScanResult[]; // Optional, might be stored separately or here
    state?: string; // Serialized scan state for pause/resume
}

// --- Service ---

export class JobService {
    private supabase: SupabaseClient | null = null;
    private useSupabase: boolean = false;

    constructor() {
        // Initialize Supabase if env vars are present
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (supabaseUrl && supabaseKey) {
            this.supabase = createClient(supabaseUrl, supabaseKey, {
                auth: {
                    persistSession: false
                }
            });
            this.useSupabase = true;
        }
    }

    /**
     * Creates a new scan job.
     */
    async createJob(url: string, config: ScanConfig): Promise<ScanJob> {
        const newJob: ScanJob = {
            id: uuidv4(),
            status: 'queued',
            scan_url: url,
            created_at: new Date().toISOString(),
            progress_percent: 0,
            urls_scanned: 0,
            total_urls: 0,
            scan_config: config,
        };

        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .insert([newJob]);

            if (error) {
                console.error('Supabase createJob error:', error);
                throw new Error(`Failed to create job in Supabase: ${error.message}`);
            }
        } else {
            await prisma.job.create({
                data: {
                    id: newJob.id,
                    status: newJob.status,
                    scan_url: newJob.scan_url,
                    created_at: new Date(newJob.created_at),
                    progress_percent: newJob.progress_percent,
                    urls_scanned: newJob.urls_scanned,
                    total_urls: newJob.total_urls,
                    scan_config: JSON.stringify(newJob.scan_config),
                }
            });
        }

        return newJob;
    }

    /**
     * Retrieves all jobs (ordered by creation date desc).
     */
    async getJobs(): Promise<ScanJob[]> {
        if (this.useSupabase && this.supabase) {
            const { data, error } = await this.supabase
                .from('scan_jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // Limit to 50 most recent

            if (error) {
                console.error('Supabase getJobs error:', error);
                return [];
            }
            return data as ScanJob[];
        } else {
            const jobs = await prisma.job.findMany({
                orderBy: { created_at: 'desc' },
                take: 50
            });

            return jobs.map(this.mapPrismaJobToScanJob);
        }
    }

    /**
     * Retrieves a job by ID.
     */
    async getJob(id: string): Promise<ScanJob | null> {
        if (this.useSupabase && this.supabase) {
            const { data, error } = await this.supabase
                .from('scan_jobs')
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                console.error('Supabase getJob error:', error);
                return null;
            }
            return data as ScanJob;
        } else {
            const job = await prisma.job.findUnique({
                where: { id }
            });
            return job ? this.mapPrismaJobToScanJob(job) : null;
        }
    }

    /**
     * Updates a job's status and optionally other fields.
     */
    async updateJobStatus(id: string, status: JobStatus, updates: Partial<ScanJob> = {}): Promise<void> {
        const updateData: any = {
            status,
            ...updates,
            ...(status === 'running' && !updates.started_at ? { started_at: new Date().toISOString() } : {}),
            ...(status === 'completed' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
            ...(status === 'failed' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
            ...(status === 'stopped' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
        };

        // Prepare Prisma update data
        const prismaUpdate: any = {
            status: updateData.status,
            progress_percent: updateData.progress_percent,
            current_url: updateData.current_url,
            urls_scanned: updateData.urls_scanned,
            total_urls: updateData.total_urls,
            error: updateData.error,
            state: updateData.state,
        };

        if (updateData.started_at) prismaUpdate.started_at = new Date(updateData.started_at);
        if (updateData.completed_at) prismaUpdate.completed_at = new Date(updateData.completed_at);
        if (updateData.scan_config) prismaUpdate.scan_config = JSON.stringify(updateData.scan_config);

        // Handle results serialization
        if (updateData.results) {
            prismaUpdate.results = JSON.stringify(updateData.results.map((r: any) => ({
                ...r,
                foundOn: Array.from(r.foundOn || []),
                htmlContexts: r.htmlContexts ? Object.fromEntries(r.htmlContexts) : undefined
            })));
        }

        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .update(updateData)
                .eq('id', id);

            if (error) {
                throw new Error(`Failed to update job status in Supabase: ${error.message}`);
            }
        } else {
            await prisma.job.update({
                where: { id },
                data: prismaUpdate
            });
        }

        // If the job is completed, save it to history
        if (status === 'completed') {
            try {
                // Fetch the fully updated job to get all fields including results
                const job = await this.getJob(id);

                if (job && job.results) {
                    const payload: SaveScanPayload = {
                        scanUrl: job.scan_url,
                        scanDate: job.created_at,
                        durationSeconds: job.completed_at && job.started_at
                            ? (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
                            : 0,
                        config: job.scan_config,
                        results: job.results
                    };

                    // Save to history using the same ID
                    await historyService.saveScan(payload, job.id);
                    console.log(`Job ${id} automatically saved to history.`);
                }
            } catch (error) {
                console.error(`Failed to save completed job ${id} to history:`, error);
            }
        }
    }

    /**
     * Updates progress specifically.
     */
    async updateJobProgress(id: string, progress: { percent: number; currentUrl: string; scanned: number; total: number }): Promise<void> {
        const updateData = {
            progress_percent: progress.percent,
            current_url: progress.currentUrl,
            urls_scanned: progress.scanned,
            total_urls: progress.total,
        };

        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .update(updateData)
                .eq('id', id);

            if (error) {
                console.error('Failed to update progress in Supabase:', error);
            }
        } else {
            await prisma.job.update({
                where: { id },
                data: updateData
            });
        }
    }

    /**
     * Saves the scan state for a job.
     */
    async updateJobState(id: string, state: string): Promise<void> {
        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .update({ state })
                .eq('id', id);

            if (error) {
                console.error('Failed to update job state in Supabase:', error);
            }
        } else {
            await prisma.job.update({
                where: { id },
                data: { state }
            });
        }
    }

    /**
     * Requests a job to pause.
     */
    async pauseJob(id: string): Promise<void> {
        await this.updateJobStatus(id, 'pausing');
    }

    /**
     * Resumes a paused job.
     */
    async resumeJob(id: string): Promise<void> {
        // Reset status to queued so worker picks it up
        await this.updateJobStatus(id, 'queued');
    }

    /**
     * Requests a job to stop.
     */
    async stopJob(id: string): Promise<void> {
        const job = await this.getJob(id);
        if (!job) return;

        if (job.status === 'paused' || job.status === 'queued') {
            // If not running, stop immediately
            await this.updateJobStatus(id, 'stopped');
        } else {
            // If running, signal to stop
            await this.updateJobStatus(id, 'stopping');
        }
    }

    /**
     * Stops all active jobs.
     */
    async stopAllJobs(): Promise<void> {
        const activeStatuses: JobStatus[] = ['running', 'queued', 'paused', 'pausing'];

        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .update({ status: 'stopping' })
                .in('status', activeStatuses);

            if (error) {
                console.error('Supabase stopAllJobs error:', error);
                throw new Error(`Failed to stop all jobs in Supabase: ${error.message}`);
            }
        } else {
            // Find all active jobs
            const activeJobs = await prisma.job.findMany({
                where: {
                    status: {
                        in: activeStatuses
                    }
                }
            });

            // Update them individually to trigger proper status logic if needed
            // OR do a bulk update. For simplicity and consistency with individual stop:
            for (const job of activeJobs) {
                await this.stopJob(job.id);
            }
        }
    }

    /**
     * Gets the next pending job (queued).
     * Used by the worker.
     */
    async getNextPendingJob(): Promise<ScanJob | null> {
        if (this.useSupabase && this.supabase) {
            // Get the oldest queued job
            const { data, error } = await this.supabase
                .from('scan_jobs')
                .select('*')
                .eq('status', 'queued')
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    return null;
                }
                console.error('Supabase getNextPendingJob error:', error);
                return null;
            }
            return data as ScanJob;
        } else {
            const job = await prisma.job.findFirst({
                where: { status: 'queued' },
                orderBy: { created_at: 'asc' }
            });

            return job ? this.mapPrismaJobToScanJob(job) : null;
        }
    }

    /**
     * Deletes a job.
     */
    async deleteJob(id: string): Promise<void> {
        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Supabase deleteJob error:', error);
                throw new Error(`Failed to delete job from Supabase: ${error.message}`);
            }
        } else {
            await prisma.job.delete({
                where: { id }
            });
        }
    }

    // --- Helpers ---

    private mapPrismaJobToScanJob(prismaJob: any): ScanJob {
        let results: ScanResult[] | undefined;
        if (prismaJob.results) {
            try {
                const parsed = JSON.parse(prismaJob.results);
                results = parsed.map((r: any) => ({
                    ...r,
                    foundOn: new Set(r.foundOn || []),
                    htmlContexts: r.htmlContexts ? new Map(Object.entries(r.htmlContexts)) : undefined
                }));
            } catch (e) {
                console.error('Error parsing results JSON:', e);
            }
        }

        return {
            id: prismaJob.id,
            status: prismaJob.status as JobStatus,
            scan_url: prismaJob.scan_url,
            created_at: prismaJob.created_at.toISOString(),
            started_at: prismaJob.started_at?.toISOString(),
            completed_at: prismaJob.completed_at?.toISOString(),
            progress_percent: prismaJob.progress_percent,
            current_url: prismaJob.current_url || undefined,
            urls_scanned: prismaJob.urls_scanned,
            total_urls: prismaJob.total_urls,
            scan_config: JSON.parse(prismaJob.scan_config),
            error: prismaJob.error || undefined,
            results,
            state: prismaJob.state || undefined,
        };
    }
}

export const jobService = new JobService();
