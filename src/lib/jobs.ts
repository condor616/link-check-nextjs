import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { ScanConfig, ScanResult } from './scanner';
import { v4 as uuidv4 } from 'uuid';
import { historyService, SaveScanPayload } from './history';

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

// --- Constants ---

const JOBS_DIR = path.join(process.cwd(), '.scan_jobs');

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

        // Ensure local jobs directory exists if we might use it (or always as fallback)
        if (!fs.existsSync(JOBS_DIR)) {
            fs.mkdirSync(JOBS_DIR, { recursive: true });
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
                // Fallback to local file? Or throw? 
                // For now, let's throw to be explicit about failure if Supabase is configured
                throw new Error(`Failed to create job in Supabase: ${error.message}`);
            }
        } else {
            this.saveJobLocal(newJob);
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
            // Read all files in .scan_jobs
            const files = fs.readdirSync(JOBS_DIR);
            const jobs: ScanJob[] = [];

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
                    const job = JSON.parse(content) as ScanJob;
                    jobs.push(job);
                } catch (e) {
                    console.error(`Error reading job file ${file}:`, e);
                }
            }

            // Sort by created_at desc
            return jobs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
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
            return this.getJobLocal(id);
        }
    }

    /**
     * Updates a job's status and optionally other fields.
     */
    async updateJobStatus(id: string, status: JobStatus, updates: Partial<ScanJob> = {}): Promise<void> {
        const updateData = {
            status,
            ...updates,
            ...(status === 'running' && !updates.started_at ? { started_at: new Date().toISOString() } : {}),
            ...(status === 'completed' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
            ...(status === 'failed' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
            ...(status === 'stopped' && !updates.completed_at ? { completed_at: new Date().toISOString() } : {}),
        };

        if (this.useSupabase && this.supabase) {
            const { error } = await this.supabase
                .from('scan_jobs')
                .update(updateData)
                .eq('id', id);

            if (error) {
                throw new Error(`Failed to update job status in Supabase: ${error.message}`);
            }
        } else {
            const job = this.getJobLocal(id);
            if (job) {
                const updatedJob = { ...job, ...updateData };
                this.saveJobLocal(updatedJob);
            }
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
                // We don't throw here to avoid failing the job update itself, 
                // but we log the error.
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
            const job = this.getJobLocal(id);
            if (job) {
                const updatedJob = { ...job, ...updateData };
                this.saveJobLocal(updatedJob);
            }
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
            const job = this.getJobLocal(id);
            if (job) {
                const updatedJob = { ...job, state };
                this.saveJobLocal(updatedJob);
            }
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
            // Read all files in .scan_jobs, find oldest queued
            const files = fs.readdirSync(JOBS_DIR);
            let oldestJob: ScanJob | null = null;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;
                try {
                    const content = fs.readFileSync(path.join(JOBS_DIR, file), 'utf-8');
                    const job = JSON.parse(content) as ScanJob;

                    if (job.status === 'queued') {
                        if (!oldestJob || new Date(job.created_at) < new Date(oldestJob.created_at)) {
                            oldestJob = job;
                        }
                    }
                } catch (e) {
                    console.error(`Error reading job file ${file}:`, e);
                }
            }
            return oldestJob;
        }
    }

    // --- Local File Helpers ---

    private getJobLocal(id: string): ScanJob | null {
        const filePath = path.join(JOBS_DIR, `${id}.json`);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                return JSON.parse(content) as ScanJob;
            } catch (e) {
                console.error(`Error reading local job ${id}:`, e);
                return null;
            }
        }
        return null;
    }

    private saveJobLocal(job: ScanJob): void {
        const filePath = path.join(JOBS_DIR, `${job.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(job, null, 2));
    }
}

export const jobService = new JobService();
