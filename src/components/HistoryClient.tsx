'use client';

import React, { useState, useEffect } from 'react';
import {
    Loader2,
    Trash2,
    AlertCircle,
    Clock,
    Calendar,
    Database,
    FileJson,
    Settings,
    Activity,
    History as HistoryIcon,
    ChevronUp,
    ChevronDown,
    ChevronsUpDown,
    Eye,
    Play,
    Plus
} from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { SimpleModal } from '@/components/SimpleModal';
import { useNotification } from "@/components/NotificationContext";
import { useRouter } from "next/navigation";

// Define the scan summary structure (from API response)
interface ScanSummary {
    id: string;
    scanUrl: string;
    scanDate: string;
    durationSeconds: number;
    resultsCount: number;
    brokenLinksCount: number;
    status?: string; // Add status for unified view
}

interface ScanJob {
    id: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    scan_url: string;
    created_at: string;
    started_at?: string;
    completed_at?: string;
    progress_percent: number;
    current_url?: string;
    urls_scanned: number;
    total_urls: number;
    scan_config: any;
    error?: string;
}

export function HistoryClient() {
    const [scans, setScans] = useState<ScanSummary[]>([]);
    const [jobs, setJobs] = useState<ScanJob[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [isSupabaseError, setIsSupabaseError] = useState<boolean>(false);
    const [settingsType, setSettingsType] = useState<'file' | 'supabase' | null>(null);

    // Sorting state
    const [sortField, setSortField] = useState<keyof ScanSummary>('scanDate');
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

    const { addNotification } = useNotification();
    const router = useRouter();

    // Load scans and jobs on initial render
    useEffect(() => {
        fetchData();
    }, []);

    // Poll for job updates with a dynamic interval
    useEffect(() => {
        // Determine interval: 5 seconds if there are active jobs, otherwise 30 seconds
        const hasActiveJobs = jobs.some(j => j.status === 'queued' || j.status === 'running');
        const intervalTime = hasActiveJobs ? 5000 : 30000;

        const interval = setInterval(() => {
            fetchJobs();
        }, intervalTime);

        return () => clearInterval(interval);
    }, [jobs]); // Re-run effect when jobs array changes to update interval

    const fetchData = async () => {
        setIsLoading(true);
        await Promise.all([fetchScans(), fetchJobs()]);
        setIsLoading(false);
    };

    const fetchJobs = async () => {
        try {
            const response = await fetch('/api/jobs');
            if (response.ok) {
                const data = await response.json();
                setJobs(data);
            }
        } catch (e) {
            console.error("Failed to fetch jobs", e);
        }
    };

    // Function to fetch all scans (history)
    const fetchScans = async () => {
        setError(null);
        setIsSupabaseError(false);

        try {
            // First get current settings to know if we're using Supabase
            const settingsResponse = await fetch('/api/settings');
            if (settingsResponse.ok) {
                const settingsData = await settingsResponse.json();
                setSettingsType(settingsData.storageType || 'file');
            }

            const response = await fetch('/api/history');
            const data = await response.json();

            if (!response.ok) {
                // Check if this is a Supabase connection error
                if (data.error && typeof data.error === 'string' &&
                    (data.error.includes('Supabase') ||
                        data.error.includes('database') ||
                        data.error.includes('connection'))) {
                    setIsSupabaseError(true);
                    throw new Error(`Database connection error: ${data.error}`);
                }
                throw new Error(data.error || `Failed to fetch scan history (${response.status})`);
            }

            // Transform the API response (items) into our expected format (scans)
            if (data.items && Array.isArray(data.items)) {
                // Use the summary values directly from the API
                const summaries = data.items.map((item: any) => ({
                    id: item.id,
                    scanUrl: item.scanUrl,
                    scanDate: item.scanDate,
                    durationSeconds: item.durationSeconds,
                    resultsCount: item.resultsCount ?? 0,
                    brokenLinksCount: item.brokenLinksCount ?? 0,
                    status: 'completed'
                }));
                setScans(summaries);
            } else {
                setScans(data.scans || []);
            }
        } catch (err: unknown) {
            console.error('Failed to fetch scan history:', err);
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to load scan history'
            );
        }
    };

    // Function to switch to file-based storage
    const switchToFileStorage = async () => {
        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    storageType: 'file',
                }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to update settings');
            }

            addNotification('success', 'Successfully switched to file-based storage');
            setSettingsType('file');
            // Refetch scans with the new storage type
            fetchScans();
        } catch (error) {
            console.error('Error switching to file storage:', error);
            addNotification('error', error instanceof Error ? error.message : 'Failed to switch storage type');
        }
    };

    // Navigate to settings page
    const goToSettings = () => {
        router.push('/settings');
    };

    // Function to delete a scan
    const deleteScan = async (id: string) => {
        setDeleteId(id);
        setIsDeleting(true);

        try {
            const response = await fetch(`/api/delete-scan?id=${id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete scan');
            }

            // Remove the deleted scan from the state
            setScans(scans.filter(scan => scan.id !== id));

            // Show success notification
            addNotification("success", "The scan has been successfully deleted.");
        } catch (err) {
            console.error('Failed to delete scan:', err);
            addNotification("error", err instanceof Error ? err.message : 'Failed to delete scan');
        } finally {
            setDeleteId(null);
            setIsDeleting(false);
        }
    };

    // Format date for display
    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return 'Invalid date';
            }

            const options: Intl.DateTimeFormatOptions = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };

            const formattedDate = new Intl.DateTimeFormat('en-US', options).format(date);
            const timeAgo = calculateTimeAgo(date);

            return (
                <div className="d-flex flex-column gap-1 py-1">
                    <div className="d-flex align-items-center gap-2 text-dark dark:text-light">
                        <Calendar size={14} className="text-primary opacity-75" />
                        <span className="text-sm fw-bold">{formattedDate.split(' at ')[0]}</span>
                    </div>
                    <div className="d-flex align-items-center gap-2 text-muted opacity-75">
                        <Clock size={14} />
                        <span className="small fw-medium">{timeAgo}</span>
                    </div>
                </div>
            );
        } catch (error) {
            console.error('Error formatting date:', error);
            return 'Invalid date';
        }
    };

    const calculateTimeAgo = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);

        if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
        if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
        if (weeks > 0) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        return `${seconds} second${seconds > 1 ? 's' : ''} ago`;
    };

    // Sorting logic
    const handleSort = (field: keyof ScanSummary) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const sortedScans = [...scans].sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (sortField === 'scanDate') {
            valA = new Date(valA as string).getTime();
            valB = new Date(valB as string).getTime();
        }

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });

    const SortIcon = ({ field }: { field: keyof ScanSummary }) => {
        if (sortField !== field) return <ChevronsUpDown size={14} className="ms-1 opacity-20 group-hover:opacity-50 transition-opacity" />;

        return sortDirection === 'asc'
            ? <ChevronUp size={14} className="ms-1 text-primary" />
            : <ChevronDown size={14} className="ms-1 text-primary" />;
    };

    return (
        <div className="w-100 py-4 fade-in-up">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-5 mt-3">
                <div>
                    <h1 className="display-6 fw-bold text-dark dark:text-light mb-1">
                        <HistoryIcon size={32} className="text-primary me-2 mb-1" />
                        Scan <span className="text-primary">History</span>
                    </h1>
                </div>
                <div className="d-flex gap-2">
                    <AnimatedButton onClick={() => router.push('/scan')} variant="outline-primary" className="px-4">
                        <Plus size={18} className="me-2" /> New Scan
                    </AnimatedButton>
                    <AnimatedButton onClick={fetchData} variant="primary" disabled={isLoading} className="px-4">
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Activity size={18} className="me-2" />
                        )}
                        {isLoading ? 'Refreshing...' : 'Refresh'}
                    </AnimatedButton>
                </div>
            </div>

            {/* Active Operations Section */}
            {jobs.filter(j => j.status === 'queued' || j.status === 'running').length > 0 && (
                <div className="mb-5">
                    <div className="d-flex align-items-center gap-2 mb-4">
                        <div className="p-2 bg-warning bg-opacity-10 text-warning rounded-3 border border-warning border-opacity-10">
                            <Activity size={20} />
                        </div>
                        <h4 className="fw-black m-0">Live <span className="text-warning">Operations</span></h4>
                    </div>
                    <div className="row g-4">
                        {jobs.filter(j => j.status === 'queued' || j.status === 'running').map(job => (
                            <div key={job.id} className="col-12 col-lg-6">
                                <AnimatedCard className="border-0 shadow-sm p-4 bg-white dark:bg-dark border-bottom border-4 border-warning">
                                    <div className="d-flex justify-content-between align-items-start mb-4">
                                        <div className="d-flex align-items-center gap-3">
                                            <div className="p-3 bg-light rounded-4 border">
                                                <Activity size={24} className="text-warning animate-pulse" />
                                            </div>
                                            <div>
                                                <h5 className="fw-black mb-1">{job.scan_url}</h5>
                                                <div className="badge rounded-pill bg-warning bg-opacity-10 text-warning px-3 py-2 x-small fw-bold border border-warning border-opacity-10">
                                                    {job.status === 'running' ? 'Active Processing' : 'In Queue'}
                                                </div>
                                            </div>
                                        </div>
                                        <AnimatedButton
                                            size="sm"
                                            variant="outline-primary"
                                            onClick={() => router.push(`/history/${job.id}`)}
                                        >
                                            Audit View
                                        </AnimatedButton>
                                    </div>
                                    {job.status === 'running' && (
                                        <div className="space-y-3">
                                            <div className="d-flex justify-content-between align-items-center mb-1">
                                                <span className="small fw-bold text-muted">{job.urls_scanned} Nodes Scanned</span>
                                                <span className="small fw-black text-primary">{job.progress_percent}%</span>
                                            </div>
                                            <div className="progress h-8 px-1 mb-2 rounded-pill bg-light border border-opacity-25" style={{ height: '10px' }}>
                                                <div
                                                    className="progress-bar progress-bar-striped progress-bar-animated bg-primary rounded-pill"
                                                    role="progressbar"
                                                    style={{ width: `${job.progress_percent}%` }}
                                                ></div>
                                            </div>
                                            <p className="x-small text-muted text-truncate opacity-75 m-0 italic">Probing: {job.current_url}</p>
                                        </div>
                                    )}
                                </AnimatedCard>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* History Repository */}
            <div className="card border-0 shadow-sm rounded-4 overflow-hidden bg-white dark:bg-dark">
                <div className="card-body p-0">
                    {isLoading && scans.length === 0 ? (
                        <div className="text-center py-5">
                            <Loader2 size={64} className="text-primary animate-spin mb-3 opacity-25" />
                            <h5 className="text-muted fw-bold">Connecting to repository...</h5>
                        </div>
                    ) : error ? (
                        isSupabaseError && settingsType === 'supabase' ? (
                            <div className="p-5">
                                <div className="alert border-0 bg-warning bg-opacity-10 p-4 rounded-4 shadow-sm border-start border-4 border-warning">
                                    <div className="d-flex align-items-start gap-4">
                                        <div className="p-3 bg-warning bg-opacity-10 rounded-circle text-warning border border-warning border-opacity-25">
                                            <Database size={24} />
                                        </div>
                                        <div>
                                            <h3 className="h5 fw-black text-warning-emphasis mb-1">Cloud Synchronization Offline</h3>
                                            <p className="text-muted small mb-3">
                                                We're unable to connect to your Supabase instance. This prevents access to cloud-stored audits.
                                            </p>
                                            <div className="d-flex flex-wrap gap-2">
                                                <AnimatedButton onClick={switchToFileStorage} variant="outline-dark" size="sm">
                                                    <FileJson size={14} className="me-2" /> Offline Mode
                                                </AnimatedButton>
                                                <AnimatedButton onClick={goToSettings} variant="primary" size="sm">
                                                    <Settings size={14} className="me-2" /> Sync Engine
                                                </AnimatedButton>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-5">
                                <div className="alert alert-danger border-0 rounded-4 p-4 d-flex align-items-center shadow-sm">
                                    <AlertCircle size={24} className="me-3" />
                                    <div className="fw-semibold">System Critical: {error}</div>
                                </div>
                            </div>
                        )
                    ) : scans.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="mb-4 opacity-25">
                                <HistoryIcon size={80} className="text-muted" />
                            </div>
                            <h4 className="fw-black text-dark dark:text-light mb-2">No Historical Data Found</h4>
                            <p className="text-muted mb-4 max-w-lg mx-auto">Your configuration vault is currently empty. Define your first scan setup to start monitoring site health.</p>
                            <AnimatedButton onClick={() => router.push('/scan')} variant="primary" className="px-4">
                                Launch Initial Setup
                            </AnimatedButton>
                        </div>
                    ) : (
                        <>
                            <div className="table-responsive d-none d-md-block">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-[#eaedf0] dark:bg-[#121417] border-bottom-2 border-primary/20">
                                        <tr>
                                            <th className="px-4 py-3 border-0 x-small fw-black text-uppercase text-muted cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all group" onClick={() => handleSort('scanUrl')}>
                                                <div className="d-flex align-items-center">Website <SortIcon field="scanUrl" /></div>
                                            </th>
                                            <th className="px-4 py-3 border-0 x-small fw-black text-uppercase text-muted cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all group" onClick={() => handleSort('scanDate')}>
                                                <div className="d-flex align-items-center">Execution Date <SortIcon field="scanDate" /></div>
                                            </th>
                                            <th className="px-4 py-3 border-0 x-small fw-black text-uppercase text-muted cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all group" onClick={() => handleSort('resultsCount')}>
                                                <div className="d-flex align-items-center">Links <SortIcon field="resultsCount" /></div>
                                            </th>
                                            <th className="px-4 py-3 border-0 x-small fw-black text-uppercase text-muted cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-all group" onClick={() => handleSort('durationSeconds')}>
                                                <div className="d-flex align-items-center">Duration <SortIcon field="durationSeconds" /></div>
                                            </th>
                                            <th className="px-4 py-3 border-0 x-small fw-black text-uppercase text-muted text-end bg-[#eaedf0] dark:bg-[#121417]"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedScans.map((scan) => (
                                            <tr key={scan.id} className="border-bottom hover:bg-light/50 dark:hover:bg-dark/50 transition-colors">
                                                <td className="px-4 py-4 font-medium text-truncate max-w-[250px]" title={scan.scanUrl}>
                                                    <div className="fw-bold text-dark dark:text-light fs-6">{scan.scanUrl}</div>
                                                </td>
                                                <td className="px-4 py-4 text-muted">
                                                    {formatDate(scan.scanDate)}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-10 fw-bold px-3 py-2 rounded-3">{scan.resultsCount}</span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="d-flex align-items-center gap-2 text-muted small fw-bold">
                                                        <Activity size={14} className="opacity-50" />
                                                        {scan.durationSeconds.toFixed(1)}s
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-end">
                                                    <div className="d-flex gap-2 justify-content-end align-items-center">
                                                        <AnimatedButton
                                                            onClick={() => router.push(`/history/${scan.id}`)}
                                                            variant="outline-primary"
                                                            size="sm"
                                                            className="px-3"
                                                            title="View Scan Report"
                                                        >
                                                            <Eye size={14} className="me-2" /> View
                                                        </AnimatedButton>
                                                        <AnimatedButton
                                                            onClick={() => router.push(`/scan?id=${scan.id}`)}
                                                            variant="outline-dark"
                                                            size="sm"
                                                            className="px-3"
                                                            title="Execute Scan"
                                                        >
                                                            <Play size={14} className="me-2" /> Execute
                                                        </AnimatedButton>
                                                        <AnimatedButton
                                                            onClick={() => setDeleteId(scan.id)}
                                                            variant="outline-danger"
                                                            size="sm"
                                                            className="px-3"
                                                            title="Delete Scan"
                                                        >
                                                            <Trash2 size={14} className="me-2" /> Delete
                                                        </AnimatedButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View (Cards) */}
                            <div className="d-md-none">
                                {sortedScans.map((scan) => (
                                    <div key={scan.id} className="border-bottom p-4">
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div className="flex-grow-1 min-w-0 me-3">
                                                <div className="fw-bold text-dark dark:text-light fs-6 text-break mb-1">{scan.scanUrl}</div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-10 fw-bold px-2 py-1 rounded-2 x-small">
                                                        {scan.resultsCount} links
                                                    </span>
                                                    <span className="text-muted small">•</span>
                                                    <span className="text-muted small fw-medium">{scan.durationSeconds.toFixed(1)}s</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mb-3 bg-light dark:bg-dark/50 p-2 rounded-3 border border-light dark:border-dark">
                                            {formatDate(scan.scanDate)}
                                        </div>

                                        <div className="d-flex gap-2 w-100">
                                            <AnimatedButton
                                                onClick={() => router.push(`/history/${scan.id}`)}
                                                variant="outline-primary"
                                                size="sm"
                                                className="flex-grow-1 justify-content-center"
                                            >
                                                <Eye size={14} className="me-2" /> View
                                            </AnimatedButton>
                                            <AnimatedButton
                                                onClick={() => router.push(`/scan?id=${scan.id}`)}
                                                variant="outline-dark"
                                                size="sm"
                                                className="flex-grow-1 justify-content-center"
                                            >
                                                <Play size={14} />
                                            </AnimatedButton>
                                            <AnimatedButton
                                                onClick={() => setDeleteId(scan.id)}
                                                variant="outline-danger"
                                                size="sm"
                                                className="flex-grow-1 justify-content-center"
                                            >
                                                <Trash2 size={14} />
                                            </AnimatedButton>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            <SimpleModal
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                title="Sanitize Archive Node"
                size="md"
                footer={
                    <>
                        <AnimatedButton variant="outline-secondary" onClick={() => setDeleteId(null)}>
                            Abort Cleanup
                        </AnimatedButton>
                        <AnimatedButton
                            variant="outline-danger"
                            onClick={() => deleteId && deleteScan(deleteId)}
                            disabled={isDeleting}
                            className="px-4"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 size={16} className="animate-spin me-2" />
                                    Sanitizing...
                                </>
                            ) : (
                                <>
                                    <Trash2 size={16} className="me-2" />
                                    Execute Deletion
                                </>
                            )}
                        </AnimatedButton>
                    </>
                }
            >
                <div className="text-center py-3">
                    <div className="p-4 bg-danger bg-opacity-10 rounded-circle d-inline-block text-danger mb-4 border border-danger border-opacity-25 shadow-sm">
                        <AlertCircle size={48} />
                    </div>
                    <h4 className="fw-black text-dark dark:text-light mb-2">Irreversible Deletion</h4>
                    <p className="text-muted mb-0">
                        You are about to purge this historical record from the permanent repository. This action cannot be undone and will terminate all audit telemetry for this execution.
                    </p>
                </div>
            </SimpleModal>
        </div >
    );
}
