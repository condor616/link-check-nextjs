"use client";

import { useEffect, useState, useCallback } from 'react';
import {
    Activity,
    Pause,
    Play,
    RefreshCcw,
    ExternalLink,
    AlertCircle,
    XOctagon,
    Loader2,
    Trash2
} from 'lucide-react';
import { PageTransition } from '@/components/PageTransition';
import { ExpandableUrl } from '@/components/ExpandableUrl';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { SimpleModal } from "@/components/SimpleModal";

interface ScanJob {
    id: string;
    status: string;
    scan_url: string;
    created_at: string;
    progress_percent: number;
    current_url?: string;
    urls_scanned: number;
    total_urls: number;
    broken_links?: number;
}

export function JobsClient() {
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
    }, [fetchJobs]);

    useEffect(() => {
        // Poll every 2 seconds if there are active jobs, otherwise every 20 seconds
        const intervalTime = jobs.length > 0 ? 2000 : 20000;
        const interval = setInterval(fetchJobs, intervalTime);
        return () => clearInterval(interval);
    }, [fetchJobs, jobs.length]);

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
            case 'paused': return 'text-warning';
            case 'pausing':
            case 'stopping': return 'text-warning';
            case 'queued': return 'text-info';
            case 'completed': return 'text-success';
            case 'failed':
            case 'stopped': return 'text-danger';
            default: return 'text-muted';
        }
    };

    return (
        <PageTransition>
            <div className="w-100 py-4">
                <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
                    <div>
                        <h1 className="display-6 fw-bold text-body d-flex align-items-center gap-2">
                            <Activity className="text-primary" /> Active Jobs
                        </h1>
                        <p className="text-muted mt-1 small">
                            Monitor and manage your ongoing scans in real-time.
                        </p>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                        <button
                            onClick={fetchJobs}
                            className="btn btn-outline-secondary d-flex align-items-center justify-content-center p-2"
                            style={{ width: '40px', height: '40px' }}
                        >
                            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
                        </button>

                        <AnimatedButton
                            variant="danger"
                            onClick={() => setShowStopAllConfirm(true)}
                            disabled={jobs.length === 0 || stoppingAll}
                            className="d-flex align-items-center gap-2 bg-danger bg-opacity-10 text-danger border-danger border-opacity-25"
                        >
                            {stoppingAll ? (
                                <Loader2 size={18} className="animate-spin" />
                            ) : (
                                <XOctagon size={18} />
                            )}
                            Stop All
                        </AnimatedButton>
                    </div>
                </div>

                {error && (
                    <div className="alert alert-danger d-flex align-items-center gap-3 mb-4" role="alert">
                        <AlertCircle size={20} />
                        <span>Error: {error}</span>
                    </div>
                )}

                {loading && jobs.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center py-5 bg-light rounded-3 border border-dashed">
                        <Loader2 className="animate-spin text-primary mb-3" size={32} />
                        <p className="text-muted">Initializing access to workers...</p>
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center py-5 bg-light rounded-3 border border-dashed text-center px-4">
                        <div className="p-3 bg-secondary bg-opacity-10 rounded-circle mb-3">
                            <Activity size={32} className="text-muted opacity-50" />
                        </div>
                        <h3 className="h5 fw-medium text-body">No active jobs found</h3>
                        <p className="text-muted text-center max-w-md mt-1 mb-4">
                            When you start a scan, it will appear here. You can then monitor its progress and control it.
                        </p>
                        <AnimatedButton
                            href="/scan"
                            variant="primary"
                        >
                            Start New Scan
                        </AnimatedButton>
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-3">
                        {jobs.map((job) => (
                            <AnimatedCard key={job.id} className="overflow-hidden">
                                <div className="d-flex flex-column flex-md-row gap-4">
                                    {/* Info Section */}
                                    <div className="flex-grow-1 min-w-0">
                                        <div className="d-flex align-items-center justify-content-between mb-2">
                                            <div className="d-flex align-items-center gap-2">
                                                <span className={`badge bg-light text-uppercase tracking-wider px-2 py-1 ${getStatusColor(job.status)}`}>
                                                    {job.status}
                                                </span>
                                                <span className="small text-muted font-monospace">ID: {job.id.slice(0, 8)}...</span>
                                            </div>
                                            <span className="small text-muted">
                                                Started {new Date(job.created_at).toLocaleTimeString()}
                                            </span>
                                        </div>

                                        <h3 className="h5 fw-bold text-body d-flex align-items-center gap-2 text-truncate">
                                            <ExpandableUrl url={job.scan_url} truncateLength={40} showIcon={false} className="text-truncate" />
                                            <a href={job.scan_url} target="_blank" rel="noopener noreferrer" className="opacity-50 hover-opacity-100 transition-opacity">
                                                <ExternalLink size={14} className="text-primary" />
                                            </a>
                                        </h3>

                                        <div className="mt-3 d-flex flex-wrap align-items-center gap-4 small w-100">
                                            <div className="d-flex flex-column">
                                                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Progress</span>
                                                <span className="text-body fw-medium">{Math.round(job.progress_percent)}%</span>
                                            </div>
                                            <div className="vr h-100 bg-secondary opacity-25" style={{ minHeight: '30px' }}></div>
                                            <div className="d-flex flex-column">
                                                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Links Scanned</span>
                                                <span className="text-body fw-medium">{job.urls_scanned} / {job.total_urls || '?'}</span>
                                            </div>
                                            <div className="vr h-100 bg-secondary opacity-25" style={{ minHeight: '30px' }}></div>
                                            <div className="d-flex flex-column">
                                                <span className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem' }}>Broken Links</span>
                                                <span className={`fw-medium ${(job.broken_links || 0) > 0 ? 'text-danger' : 'text-success'}`}>
                                                    {job.broken_links || 0}
                                                </span>
                                            </div>
                                            <div className="d-none d-md-flex flex-column flex-grow-1 min-w-0 ms-2">
                                                <span className="text-muted text-uppercase fw-semibold mb-1" style={{ fontSize: '0.7rem' }}>Current URL</span>
                                                <div className="text-body fw-medium text-truncate w-100">
                                                    <ExpandableUrl url={job.current_url} truncateLength={45} />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="mt-3 w-100 bg-light rounded-pill overflow-hidden" style={{ height: '6px' }}>
                                            <div
                                                className="h-100 bg-primary transition-all duration-500"
                                                style={{ width: `${job.progress_percent}%`, boxShadow: '0 0 10px rgba(var(--bs-primary-rgb), 0.5)' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Action Section */}
                                    <div className="d-flex align-items-center gap-2 align-self-end align-self-md-center">
                                        {job.status === 'paused' ? (
                                            <button
                                                onClick={() => handleJobAction(job.id, 'resume')}
                                                className="btn btn-primary bg-opacity-10 text-primary border-0 p-2 rounded-3 d-flex align-items-center justify-content-center"
                                                style={{ width: '40px', height: '40px' }}
                                                title="Resume Scan"
                                            >
                                                <Play size={20} fill="currentColor" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleJobAction(job.id, 'pause')}
                                                disabled={job.status === 'pausing' || job.status === 'stopping'}
                                                className="btn btn-warning bg-opacity-10 text-warning border-0 p-2 rounded-3 d-flex align-items-center justify-content-center"
                                                style={{ width: '40px', height: '40px' }}
                                                title="Pause Scan"
                                            >
                                                <Pause size={20} fill="currentColor" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => setJobToRemove({ id: job.id, status: job.status })}
                                            className="btn btn-light text-muted border-0 p-2 rounded-3 d-flex align-items-center justify-content-center hover-bg-danger hover-text-white"
                                            style={{ width: '40px', height: '40px' }}
                                            title="Delete Scan"
                                        >
                                            <Trash2 size={20} />
                                        </button>

                                        <AnimatedButton
                                            href={`/history/${job.id}`}
                                            variant="secondary"
                                            className="ms-2"
                                            size="sm"
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
                <SimpleModal
                    isOpen={showStopAllConfirm}
                    onClose={() => setShowStopAllConfirm(false)}
                    title="Stop All Scans?"
                    footer={
                        <div className="d-flex justify-content-end gap-2">
                            <AnimatedButton variant="secondary" onClick={() => setShowStopAllConfirm(false)}>
                                Cancel
                            </AnimatedButton>
                            <AnimatedButton variant="danger" onClick={handleStopAll}>
                                Abort All
                            </AnimatedButton>
                        </div>
                    }
                >
                    <p className="mb-0">Are you sure you want to stop all active jobs? This will immediately abort all workers and you will lose any unsaved progress for ongoing scans.</p>
                </SimpleModal>

                {/* Confirm Remove Job Dialog */}
                <SimpleModal
                    isOpen={!!jobToRemove}
                    onClose={() => setJobToRemove(null)}
                    title="Delete Scan?"
                    footer={
                        <div className="d-flex justify-content-end gap-2">
                            <AnimatedButton variant="secondary" onClick={() => setJobToRemove(null)}>
                                Cancel
                            </AnimatedButton>
                            <AnimatedButton variant="danger" onClick={handleRemoveJob}>
                                Delete
                            </AnimatedButton>
                        </div>
                    }
                >
                    <p className="mb-0">
                        {jobToRemove && ['queued', 'running', 'pausing', 'paused', 'stopping'].includes(jobToRemove.status)
                            ? 'This scan is currently active. Deleting it will stop the worker and abort the scan immediately. Proceed?'
                            : 'Are you sure you want to delete this scan? This action cannot be undone.'}
                    </p>
                </SimpleModal>
            </div>
        </PageTransition>
    );
}
