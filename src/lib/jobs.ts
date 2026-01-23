import { getSupabaseClient, isUsingSupabase } from './supabase';
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
    broken_links: number;
    total_links: number;
    scan_config: ScanConfig;
    error?: string;
    results?: ScanResult[]; // Optional, might be stored separately or here
    state?: string; // Serialized scan state for pause/resume
}

// --- Service ---

export class JobService {
    constructor() {
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
            broken_links: 0,
            total_links: 0,
            scan_config: config,
        };

        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client is not available or not configured');
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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
                    broken_links: newJob.broken_links,
                    total_links: newJob.total_links,
                    scan_config: JSON.stringify(newJob.scan_config),
                }
            });
        }

        return newJob;
    }

    /**
     * Retrieves all jobs (minimal metadata for list views).
     */
    async getJobsMinimal(): Promise<Partial<ScanJob>[]> {
        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                console.error('Supabase client is not available or not configured');
                return [];
            }
            const { data, error } = await (supabase
                .from('scan_jobs') as any)
                .select('id, status, scan_url, created_at, started_at, completed_at, progress_percent, urls_scanned, total_urls, broken_links, total_links')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) {
                console.error('Supabase getJobsMinimal error:', error);
                return [];
            }
            return (data as any[]).map(this.mapDatabaseRowToScanJob);
        } else {
            const jobs = await prisma.job.findMany({
                select: {
                    id: true,
                    status: true,
                    scan_url: true,
                    created_at: true,
                    started_at: true,
                    completed_at: true,
                    progress_percent: true,
                    urls_scanned: true,
                    total_urls: true,
                    broken_links: true,
                    total_links: true
                },
                orderBy: { created_at: 'desc' },
                take: 50
            });

            return jobs.map((j: any) => ({
                ...j,
                created_at: j.created_at.toISOString(),
                started_at: j.started_at?.toISOString(),
                completed_at: j.completed_at?.toISOString(),
            }));
        }
    }

    /**
     * Retrieves all jobs.
     */
    async getJobs(): Promise<ScanJob[]> {
        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                console.error('Supabase client is not available or not configured');
                return [];
            }
            const { data, error } = await (supabase
                .from('scan_jobs') as any)
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50); // Limit to 50 most recent

            if (error) {
                console.error('Supabase getJobs error:', error);
                return [];
            }
            return (data as any[]).map(this.mapDatabaseRowToScanJob);
        } else {
            const jobs = await prisma.job.findMany({
                orderBy: { created_at: 'desc' },
                take: 50
            });

            return jobs.map(this.mapDatabaseRowToScanJob);
        }
    }

    /**
     * Retrieves a job by ID.
     */
    async getJob(id: string): Promise<ScanJob | null> {
        const useSupabase = await isUsingSupabase();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                console.error('Supabase client is not available or not configured');
                return null;
            }
            const { data, error } = await (supabase
                .from('scan_jobs') as any)
                .select('*')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') { // No rows found
                    return null;
                }
                console.error('Supabase getJob error:', error);
                throw new Error(`Supabase getJob error: ${error.message}`);
            }
            return this.mapDatabaseRowToScanJob(data);
        } else {
            const job = await prisma.job.findUnique({
                where: { id }
            });
            return job ? this.mapDatabaseRowToScanJob(job) : null;
        }
    }

    /**
     * Retrieves only the status of a job. Optimized for frequent polling.
     */
    async getJobStatus(id: string): Promise<JobStatus | null> {
        const useSupabase = await isUsingSupabase();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) return null;

            const { data, error } = await (supabase
                .from('scan_jobs') as any)
                .select('status')
                .eq('id', id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return null;
                throw new Error(`Supabase getJobStatus error: ${error.message}`);
            }
            return data.status as JobStatus;
        } else {
            const job = await prisma.job.findUnique({
                where: { id },
                select: { status: true }
            });
            return job ? job.status as JobStatus : null;
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
            broken_links: updateData.broken_links,
            total_links: updateData.total_links,
            error: updateData.error,
            state: updateData.state,
        };

        if (updateData.started_at) prismaUpdate.started_at = new Date(updateData.started_at);
        if (updateData.completed_at) prismaUpdate.completed_at = new Date(updateData.completed_at);
        if (updateData.scan_config) prismaUpdate.scan_config = JSON.stringify(updateData.scan_config);

        // Handle results serialization and count calculation
        if (updateData.results) {
            const brokenCount = updateData.results.filter((r: any) =>
                r.status === 'broken' || r.status === 'error' || (r.statusCode !== undefined && r.statusCode >= 400)
            ).length;

            updateData.broken_links = brokenCount;
            updateData.total_links = updateData.results.length;

            // Serialize results for database storage
            const serializedResults = this.serializeScanResults(updateData.results);

            // For Supabase, we send the serialized object/array directly (PostgREST handles JSONB)
            updateData.results = serializedResults;

            // For Prisma, we also update the fields and stringify
            prismaUpdate.broken_links = brokenCount;
            prismaUpdate.total_links = updateData.results.length;
            prismaUpdate.results = JSON.stringify(serializedResults);
        }

        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client is not available or not configured');
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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
                        results: job.results,
                        brokenLinksCount: job.broken_links,
                        totalLinksCount: job.total_links
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
    async updateJobProgress(id: string, progress: { percent: number; currentUrl: string; scanned: number; total: number; brokenLinks?: number; totalLinks?: number }): Promise<void> {
        const updateData: any = {
            progress_percent: progress.percent,
            current_url: progress.currentUrl,
            urls_scanned: progress.scanned,
            total_urls: progress.total,
        };

        if (progress.brokenLinks !== undefined) updateData.broken_links = progress.brokenLinks;
        if (progress.totalLinks !== undefined) updateData.total_links = progress.totalLinks;

        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                console.error('Failed to update progress: Supabase client is not available');
                return;
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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
        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                console.error('Failed to update job state: Supabase client is not available');
                return;
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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

        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client is not available or not configured');
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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
        const useSupabase = await isUsingSupabase();
        const supabase = await getSupabaseClient();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                return null;
            }
            // Get the oldest queued job
            const { data, error } = await (supabase
                .from('scan_jobs') as any)
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

            return job ? this.mapDatabaseRowToScanJob(job) : null;
        }
    }

    /**
     * Deletes a job.
     */
    async deleteJob(id: string): Promise<void> {
        const useSupabase = await isUsingSupabase();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                throw new Error('Supabase client is not available or not configured');
            }
            const { error } = await (supabase
                .from('scan_jobs') as any)
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

    private serializeScanResults(results: ScanResult[]): any[] {
        return results.map(r => ({
            ...r,
            foundOn: Array.from(r.foundOn || []),
            htmlContexts: r.htmlContexts ? Object.fromEntries(r.htmlContexts) : undefined
        }));
    }

    private mapDatabaseRowToScanJob = (row: any): ScanJob => {
        let results: ScanResult[] | undefined;
        if (row.results) {
            try {
                // Supabase might return data as object/array already, Prisma returns string
                const parsed = typeof row.results === 'string' ? JSON.parse(row.results) : row.results;
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
            id: row.id,
            status: row.status as JobStatus,
            scan_url: row.scan_url,
            created_at: typeof row.created_at === 'string' ? row.created_at : row.created_at.toISOString(),
            started_at: row.started_at ? (typeof row.started_at === 'string' ? row.started_at : row.started_at.toISOString()) : undefined,
            completed_at: row.completed_at ? (typeof row.completed_at === 'string' ? row.completed_at : row.completed_at.toISOString()) : undefined,
            progress_percent: row.progress_percent,
            current_url: row.current_url || undefined,
            urls_scanned: row.urls_scanned,
            total_urls: row.total_urls,
            broken_links: row.broken_links || 0,
            total_links: row.total_links || 0,
            scan_config: typeof row.scan_config === 'string' ? JSON.parse(row.scan_config) : row.scan_config,
            error: row.error || undefined,
            results,
            state: row.state || undefined,
        };
    }
}

export const jobService = new JobService();
