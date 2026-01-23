"use client";

import { useEffect, useState, useCallback } from 'react';
import {
    Activity,
    Pause,
    Play,
    Square,
    RefreshCcw,
    ExternalLink,
    AlertCircle,
    XOctagon,
    Loader2,
    Trash2
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ScanJob {
    id: string;
    status: string;
    scan_url: string;
    created_at: string;
    progress_percent: number;
    current_url?: string;
    urls_scanned: number;
    total_urls: number;
}

export default function ActiveJobsPage() {
    const [jobs, setJobs] = useState<ScanJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [stoppingAll, setStoppingAll] = useState(false);
    const [jobToRemove, setJobToRemove] = useState<{ id: string, status: string } | null>(null);
    const [showStopAllConfirm, setShowStopAllConfirm] = useState(false);

    const fetchJobs = useCallback(async () => {
        try {
            const response = await fetch('/api/jobs');
            if (!response.ok) throw new Error('Failed to fetch jobs');
            const data = await response.json();

            // Show jobs that are active ONLY
            const activeStatuses = ['queued', 'running', 'pausing', 'paused', 'stopping'];
            const activeJobs = data.filter((job: ScanJob) => activeStatuses.includes(job.status));

            setJobs(activeJobs);
            setError(null);
        } catch (err: any) {
            console.error('Error fetching jobs:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchJobs();
        const interval = setInterval(fetchJobs, 2000); // Poll every 2 seconds
        return () => clearInterval(interval);
    }, [fetchJobs]);

    const handleJobAction = async (id: string, action: 'pause' | 'resume' | 'stop') => {
        try {
            const response = await fetch(`/api/jobs/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: action === 'stop' ? 'stop' : action })
            });

            if (!response.ok) throw new Error(`Failed to ${action} job`);

            // Refresh local state immediately
            fetchJobs();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleStopAll = async () => {
        setShowStopAllConfirm(false);
        setStoppingAll(true);
        try {
            const response = await fetch('/api/jobs/stop-all', { method: 'POST' });
            if (!response.ok) throw new Error('Failed to stop all jobs');
            fetchJobs();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setStoppingAll(false);
        }
    };

    const handleRemoveJob = async () => {
        if (!jobToRemove) return;
        const { id } = jobToRemove;
        setJobToRemove(null);

        try {
            const response = await fetch(`/api/jobs/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) throw new Error('Failed to remove job');

            // Refresh local state immediately
            fetchJobs();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'running': return 'text-primary';
            case 'paused': return 'text-yellow-500';
            case 'pausing':
            case 'stopping': return 'text-orange-500';
            case 'queued': return 'text-blue-400';
            case 'completed': return 'text-green-500';
            case 'failed':
            case 'stopped': return 'text-destructive';
            default: return 'text-muted-foreground';
        }
    };

    return (
        <PageTransition>
            <div className="container mx-auto py-8 px-4 max-w-6xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Activity className="text-primary" /> Active Jobs
                        </h1>
                        <p className="text-muted-foreground mt-1 text-sm">
                            Monitor and manage your ongoing scans in real-time.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchJobs}
                            className="p-2 rounded-md border border-border hover:bg-sidebar-accent transition-colors"
                        >
                            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
                        </button>

                        <AnimatedButton
                            variant="destructive"
                            onClick={() => setShowStopAllConfirm(true)}
                            disabled={jobs.length === 0 || stoppingAll}
                            className="bg-destructive/10 text-destructive hover:bg-destructive hover:text-white border-destructive/20"
                        >
                            {stoppingAll ? (
                                <Loader2 size={18} className="animate-spin mr-2" />
                            ) : (
                                <XOctagon size={18} className="mr-2" />
                            )}
                            Stop All
                        </AnimatedButton>
                    </div>
                </div>

                {error && (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-lg mb-6 flex items-center gap-3">
                        <AlertCircle size={20} />
                        <span>Error: {error}</span>
                    </div>
                )}

                {loading && jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-sidebar/30 rounded-xl border border-dashed border-border/50">
                        <Loader2 className="animate-spin text-primary mb-4" size={32} />
                        <p className="text-muted-foreground">Initializing access to workers...</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-sidebar/30 rounded-xl border border-dashed border-border/50 text-center px-10">
                        <div className="w-16 h-16 bg-sidebar-accent/50 rounded-full flex items-center justify-center mb-4">
                            <Activity size={32} className="text-muted-foreground opacity-50" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No active jobs found</h3>
                        <p className="text-muted-foreground max-w-md mt-2">
                            When you start a scan, it will appear here. You can then monitor its progress and control it.
                        </p>
                        <AnimatedButton
                            href="/scan"
                            className="mt-6"
                        >
                            Start New Scan
                        </AnimatedButton>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {jobs.map((job) => (
                            <AnimatedCard key={job.id} className="group overflow-hidden">
                                <div className="p-5 flex flex-col md:flex-row gap-6">
                                    {/* Info Section */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-xs font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-sidebar-accent ${getStatusColor(job.status)}`}>
                                                    {job.status}
                                                </span>
                                                <span className="text-xs text-muted-foreground font-mono">ID: {job.id.slice(0, 8)}...</span>
                                            </div>
                                            <span className="text-xs text-muted-foreground">
                                                Started {new Date(job.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                                            {job.scan_url}
                                            <a href={job.scan_url} target="_blank" rel="noopener noreferrer" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ExternalLink size={14} className="text-primary hover:scale-110 transition-transform" />
                                            </a>
                                        </h3>

                                        <div className="mt-4 flex items-center gap-4 text-sm w-full min-w-0">
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground text-xs uppercase font-semibold">Progress</span>
                                                <span className="text-foreground font-medium">{Math.round(job.progress_percent)}%</span>
                                            </div>
                                            <div className="h-8 w-px bg-border/50" />
                                            <div className="flex flex-col">
                                                <span className="text-muted-foreground text-xs uppercase font-semibold">Links Scanned</span>
                                                <span className="text-foreground font-medium">{job.urls_scanned} / {job.total_urls || '?'}</span>
                                            </div>
                                            <div className="hidden md:flex flex-col flex-1 min-w-0">
                                                <span className="text-muted-foreground text-xs uppercase font-semibold">Current URL</span>
                                                <span className="text-foreground font-medium truncate italic block" title={job.current_url}>
                                                    {job.current_url || 'Initializing...'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-4 w-full h-1.5 bg-sidebar-accent rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                                                style={{ width: `${job.progress_percent}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Section */}
                                    <div className="flex items-center gap-2 self-end md:self-center">
                                        {job.status === 'paused' ? (
                                            <button
                                                onClick={() => handleJobAction(job.id, 'resume')}
                                                className="p-3 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition-all"
                                                title="Resume Scan"
                                            >
                                                <Play size={20} fill="currentColor" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleJobAction(job.id, 'pause')}
                                                disabled={job.status === 'pausing' || job.status === 'stopping'}
                                                className="p-3 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500 hover:text-white rounded-lg transition-all disabled:opacity-50"
                                                title="Pause Scan"
                                            >
                                                <Pause size={20} fill="currentColor" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setJobToRemove({ id: job.id, status: job.status })}
                                            className="p-3 bg-sidebar-accent text-muted-foreground hover:bg-destructive hover:text-white rounded-lg transition-all"
                                            title="Delete Scan"
                                        >
                                            <Trash2 size={20} />
                                        </button>

                                        <AnimatedButton
                                            href={`/history/${job.id}`}
                                            variant="secondary"
                                            className="ml-2"
                                        >
                                            View Details
                                        </AnimatedButton>
                                    </div>
                                </div>
                            </AnimatedCard>
                        ))}
                    </div>
                )}

                {/* Confirm Stop All Dialog */}
                <AlertDialog open={showStopAllConfirm} onOpenChange={setShowStopAllConfirm}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Stop All Scans?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to stop all active jobs? This will immediately abort all workers and you will lose any unsaved progress for ongoing scans.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleStopAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Abort All
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* Confirm Remove Job Dialog */}
                <AlertDialog open={!!jobToRemove} onOpenChange={(open) => !open && setJobToRemove(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete Scan?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {jobToRemove && ['queued', 'running', 'pausing', 'paused', 'stopping'].includes(jobToRemove.status)
                                    ? 'This scan is currently active. Deleting it will stop the worker and abort the scan immediately. Proceed?'
                                    : 'Are you sure you want to delete this scan? This action cannot be undone.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleRemoveJob} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PageTransition>
    );
}
