'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  AlertCircle,
  ArrowLeft,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Pause,
  Play,
  Square,
  ExternalLink,
  Activity,
  Shield,
  Clock,
  Database,
  Terminal,
  ChevronLeft,
  Zap,
  LayoutGrid,
  Info,
  Check,
  X,
  Search
} from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { SimpleModal } from '@/components/SimpleModal';
import { ExpandableUrl } from '@/components/ExpandableUrl';
import ScanResults from '@/components/ScanResults';
import { ScanResult } from '@/lib/scanner';

// Define SerializedScanResult for JSON storage
interface SerializedScanResult extends Omit<ScanResult, 'foundOn' | 'htmlContexts'> {
  foundOn: string[]; // Instead of Set<string>
  htmlContexts?: Record<string, string[]>; // Instead of Map<string, string[]>
}

// Define the expected structure from the saved scan
interface SavedScan {
  id: string;
  scanUrl: string;
  scanDate: string;
  durationSeconds: number;
  config: {
    depth: number;
    scanSameLinkOnce: boolean;
    concurrency: number;
    itemsPerPage?: number;
  };
  results: SerializedScanResult[];
}

interface ScanJob {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'pausing' | 'paused' | 'stopping' | 'stopped';
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
  results?: SerializedScanResult[];
}

// Loading fallback for Suspense
function ScanDetailsLoading() {
  return (
    <main className="w-100 py-4">
      <AnimatedCard className="w-100">
        <div className="card-body p-4 p-md-5">
          <div className="d-flex align-items-center justify-content-between mb-4">
            <AnimatedButton variant="link" className="p-0 border-0" href="/history">
              <div className="d-flex align-items-center">
                <ArrowLeft className="me-2" size={18} />
                <span className="fw-medium">Back to History</span>
              </div>
            </AnimatedButton>
          </div>
          <div className="text-center py-5">
            <Loader2 className="spinner-border text-primary border-0 animate-spin mb-3" size={40} />
            <h2 className="fs-4 fw-bold mb-2">Analyzing Scan Artifacts...</h2>
            <p className="text-muted">Retrieving intelligence patterns and scan metadata.</p>
          </div>
        </div>
      </AnimatedCard>
    </main>
  );
}

function ScanDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const scanId = params.scanId as string;

  const [scan, setScan] = useState<SavedScan | null>(null);
  const [job, setJob] = useState<ScanJob | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isControlling, setIsControlling] = useState<boolean>(false);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const fetchScanOrJob = async () => {
      try {
        // Try fetching as a job first
        const jobResponse = await fetch(`/api/jobs/${scanId}`);

        if (jobResponse.ok) {
          const jobData = await jobResponse.json();
          setJob(jobData);

          if (jobData.status === 'completed' && jobData.results) {
            // Map job to SavedScan format for display
            setScan({
              id: jobData.id,
              scanUrl: jobData.scan_url,
              scanDate: jobData.created_at,
              durationSeconds: jobData.completed_at && jobData.started_at
                ? (new Date(jobData.completed_at).getTime() - new Date(jobData.started_at).getTime()) / 1000
                : 0,
              config: jobData.scan_config,
              results: jobData.results
            });
            setIsLoading(false);
            return; // Stop polling if completed
          } else if (jobData.status === 'failed') {
            setError(jobData.error || 'Scan failed');
            setIsLoading(false);
            return; // Stop polling if failed
          } else {
            // Still running or queued, keep polling
            setIsLoading(false);
          }
        } else if (jobResponse.status === 404) {
          // Not a job, try fetching as history (legacy)
          const historyResponse = await fetch(`/api/history/${scanId}`);

          if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            setScan(historyData);
            setIsLoading(false);
            return; // No need to poll for history
          } else if (historyResponse.status === 404) {
            // Definitely not found in either jobs or history
            setJob(null);
            setScan(null);
            setError('Scan not found');
            setIsLoading(false);
            return;
          } else {
            throw new Error('Failed to fetch scan history');
          }
        } else {
          throw new Error(`Failed to fetch job: ${jobResponse.statusText}`);
        }
      } catch (err: unknown) {
        console.error(`Failed to fetch scan ${scanId}:`, err);

        const errorMessage = err instanceof Error ? err.message : 'Failed to load scan details';

        // Only set error if we haven't loaded anything yet and it's not a transient error
        // If we have a job/scan, we might just want to retry silently
        if (!job && !scan) {
          setError(errorMessage);
        }
        setIsLoading(false);
      }
    };

    fetchScanOrJob();

    // Set up polling if job is active or paused (to catch resume)
    pollInterval = setInterval(() => {
      if (job && (job.status === 'queued' || job.status === 'running' || job.status === 'pausing' || job.status === 'stopping' || job.status === 'paused')) {
        fetchScanOrJob();
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [scanId, job?.status]); // Re-run effect if job status changes to potentially stop polling

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  // Delete the scan
  const deleteScan = async () => {
    setIsDeleting(true);
    try {
      // Try deleting as job first
      const jobResponse = await fetch(`/api/jobs/${scanId}`, {
        method: 'DELETE',
      });

      if (jobResponse.ok) {
        router.push('/history');
        return;
      }

      // If not found in jobs, it might be in history (already completed)
      const historyResponse = await fetch(`/api/history/${scanId}`, {
        method: 'DELETE',
      });

      if (!historyResponse.ok) {
        const data = await historyResponse.json();
        throw new Error(data.error || `Failed to delete scan (${historyResponse.status})`);
      }

      router.push('/history');
    } catch (err: unknown) {
      console.error(`Failed to delete scan ${scanId}:`, err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to delete scan'
      );
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  // Filter broken links
  const brokenLinks = scan?.results?.filter(r => r.status === 'broken' || r.status === 'error') || [];

  // Handle job control actions
  const handleControl = async (action: 'pause' | 'resume' | 'stop') => {
    setIsControlling(true);
    try {
      const response = await fetch(`/api/jobs/${scanId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to ${action} job`);
      }
    } catch (err: unknown) {
      console.error(`Failed to ${action} job:`, err);
      alert(`Failed to ${action} job: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsControlling(false);
    }
  };

  if (isLoading) {
    return <ScanDetailsLoading />;
  }

  if (error) {
    return (
      <main className="w-100 py-4">
        <AnimatedCard className="w-100 border-danger border-opacity-25">
          <div className="card-body p-4 p-md-5">
            <div className="alert alert-danger d-flex align-items-start p-4 mb-4 rounded-3 shadow-sm border-0 bg-danger bg-opacity-10 text-danger">
              <AlertCircle className="me-3 mt-1 shrink-0" size={24} />
              <div className="flex-grow-1">
                <h4 className="alert-heading fw-bold mb-2">Audit Access Failure</h4>
                <p className="mb-0 fs-6">{error}</p>
              </div>
            </div>

            <div className="d-flex justify-content-center pt-2">
              <AnimatedButton variant="outline-primary" className="px-4" href="/history">
                <ArrowLeft className="me-2" size={18} />
                Return to Intelligence Archive
              </AnimatedButton>
            </div>
          </div>
        </AnimatedCard>
      </main>
    );
  }

  // Common Header Section
  const DetailHeader = ({ title, status, icon: Icon, isJob = false }: { title: string, status?: string, icon: any, isJob?: boolean }) => (
    <div className="card-header bg-transparent border-bottom-0 pt-4 px-4 px-md-5">
      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3 mb-4">
        <AnimatedButton variant="link" className="p-0 border-0 text-muted text-decoration-none" href="/history">
          <div className="d-flex align-items-center">
            <ChevronLeft className="me-2" size={18} />
            <span className="fw-medium">Back to History</span>
          </div>
        </AnimatedButton>

        <div className="d-flex align-items-center gap-2">
          {isJob ? (
            <>
              {!isTransient && (
                isActive ? (
                  <AnimatedButton variant="outline-secondary" size="sm" onClick={() => handleControl('pause')} disabled={isControlling}>
                    <Pause className="me-2" size={14} /> Pause Audit
                  </AnimatedButton>
                ) : isPaused ? (
                  <AnimatedButton variant="primary" size="sm" onClick={() => handleControl('resume')} disabled={isControlling}>
                    <Play className="me-2" size={14} /> Resume Audit
                  </AnimatedButton>
                ) : null
              )}
              <AnimatedButton variant="outline-danger" size="sm" onClick={() => setShowDeleteModal(true)} disabled={isDeleting || isControlling}>
                {isDeleting ? <Loader2 className="me-2 animate-spin" size={14} /> : <Trash2 className="me-2" size={14} />}
                Abort Audit
              </AnimatedButton>
            </>
          ) : (
            <>
              {scan && (
                <AnimatedButton variant="outline-primary" size="sm" href={`/scan?id=${scanId}`}>
                  <RefreshCw className="me-2" size={14} /> Execute New Audit
                </AnimatedButton>
              )}
              <AnimatedButton variant="outline-danger" size="sm" onClick={() => setShowDeleteModal(true)} disabled={isDeleting}>
                <Trash2 className="me-2" size={14} /> Delete Archive
              </AnimatedButton>
            </>
          )}

          <SimpleModal
            isOpen={showDeleteModal}
            onClose={() => setShowDeleteModal(false)}
            title={isJob ? "Abort Core Intelligence Audit?" : "Sanitize Intelligence Archive?"}
            footer={
              <div className="d-flex gap-2">
                <AnimatedButton variant="outline-secondary" onClick={() => setShowDeleteModal(false)}>Cancel</AnimatedButton>
                <AnimatedButton variant="danger" onClick={deleteScan} disabled={isDeleting}>
                  {isDeleting ? <Loader2 className="me-2 animate-spin" size={14} /> : <Trash2 className="me-2" size={14} />}
                  Confirm {isJob ? "Abort" : "Deletion"}
                </AnimatedButton>
              </div>
            }
          >
            <div className="p-2 text-muted">
              {isJob && (job?.status === 'running' || job?.status === 'queued')
                ? "This audit is currently active. Aborting will immediately cease all worker operations and discard any unsaved ephemeral state."
                : "Are you sure you want to permanently delete this audit record from the intelligence archive?"}
              <p className="mt-2 fw-bold text-danger">This action is IRREVERSIBLE.</p>
            </div>
          </SimpleModal>
        </div>
      </div>

      <h1 className="fs-3 fw-bold d-flex flex-wrap align-items-center gap-2 mb-2">
        <Icon className="text-primary" size={28} />
        <span className="text-truncate">{title}</span>
        <span className="fs-6 fw-normal text-muted font-monospace opacity-75">
          [ {scanId.substring(0, 8)}... ]
        </span>
      </h1>

      <div className="d-flex flex-wrap align-items-center gap-3 text-muted fs-6">
        <Database size={16} />
        <span className="text-truncate" style={{ maxWidth: '400px' }}>
          {isJob ? job?.scan_url : scan?.scanUrl}
        </span>
        {scan && !isJob && (
          <>
            <div className="d-flex align-items-center gap-2 border-start ps-3 d-none d-sm-flex">
              <Clock size={16} />
              <span>{formatDate(scan.scanDate)}</span>
            </div>
            <div className="d-flex align-items-center gap-2 border-start ps-3 d-none d-md-flex">
              <Zap size={16} />
              <span>{scan.durationSeconds.toFixed(2)}s Execution</span>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const isActive = job?.status === 'running' || job?.status === 'queued';
  const isPaused = job?.status === 'paused';
  const isTransient = job?.status === 'pausing' || job?.status === 'stopping';

  // Render Active Job Progress
  if (job && (job.status === 'queued' || job.status === 'running' || job.status === 'pausing' || job.status === 'paused' || job.status === 'stopping' || job.status === 'stopped')) {
    return (
      <main className="w-100 py-4">
        <AnimatedCard className="w-100 overflow-hidden shadow-lg border-opacity-10">
          <DetailHeader title={`Audit ${isActive ? 'Execution' : isPaused ? 'Suspended' : job.status === 'stopped' ? 'Termination' : 'Status'}`} icon={Activity} isJob={true} />

          <div className="card-body p-4 p-md-5">
            <div className="mb-5">
              <div className="d-flex justify-content-between align-items-end mb-3">
                <div className="d-flex align-items-center gap-2">
                  <Zap className={isActive ? "text-warning animate-pulse" : "text-muted"} size={18} />
                  <span className="fw-bold fs-5">Audit Intelligence Progress</span>
                </div>
                <span className="fw-bold fs-4 text-primary">{job.progress_percent}%</span>
              </div>
              <div className="progress shadow-sm" style={{ height: '12px', borderRadius: '6px' }}>
                <div
                  className={`progress-bar progress-bar-striped ${isActive ? 'progress-bar-animated' : ''} ${isPaused ? 'bg-warning' : 'bg-primary'}`}
                  role="progressbar"
                  style={{ width: `${job.progress_percent}%` }}
                ></div>
              </div>
            </div>

            <div className="row g-4 mb-5">
              <div className="col-12 col-md-6">
                <div className="p-4 rounded-4 bg-light border border-light-subtle h-100 shadow-sm">
                  <div className="d-flex align-items-center gap-2 mb-3 text-muted">
                    <LayoutGrid size={18} />
                    <span className="text-uppercase fw-bold ls-wider" style={{ fontSize: '0.75rem' }}>Indexed Artifacts</span>
                  </div>
                  <div className="d-flex align-items-baseline gap-2">
                    <span className="fs-2 fw-black text-dark">{job.urls_scanned}</span>
                    <span className="text-muted">/ {job.total_urls || '...'} URLs</span>
                  </div>
                </div>
              </div>
              <div className="col-12 col-md-6">
                <div className="p-4 rounded-4 bg-light border border-light-subtle h-100 shadow-sm">
                  <div className="d-flex align-items-center gap-2 mb-3 text-muted">
                    <Clock size={18} />
                    <span className="text-uppercase fw-bold ls-wider" style={{ fontSize: '0.75rem' }}>Current Operation</span>
                  </div>
                  <div className="font-monospace text-primary text-truncate-2" style={{ fontSize: '0.9rem', lineHeight: '1.4' }}>
                    {job.current_url || 'Initializing patterns...'}
                  </div>
                </div>
              </div>
            </div>

            {job.status === 'queued' && (
              <div className="alert alert-info border-0 shadow-sm d-flex align-items-center p-4 rounded-4 bg-info bg-opacity-10 text-info">
                <Loader2 className="me-3 animate-spin" size={24} />
                <div>
                  <h5 className="alert-heading fw-bold mb-1">{job.urls_scanned > 0 ? "Re-initializing Audit" : "Audit Queued"}</h5>
                  <p className="mb-0 fs-6">{job.urls_scanned > 0 ? "Intelligence worker is re-establishing the audit context..." : "Waiting for a specialized worker to initiate the audit process..."}</p>
                </div>
              </div>
            )}
            {/* ... other status alerts (paused, stopped) can be added here if needed ... */}
          </div>
        </AnimatedCard>
      </main>
    );
  }

  // Render Completed Scan
  return (
    <main className="w-100 py-4">
      <AnimatedCard className="w-100 overflow-hidden shadow-lg border-opacity-10">
        <DetailHeader title="Audit Detail Report" icon={Shield} />

        <div className="card-body p-4 p-md-5">
          {scan ? (
            <div className="space-y-5">
              <div className="row g-3 mb-5 text-sm">
                <div className="col-auto">
                  <div className="d-flex align-items-center gap-2 px-3 py-2 bg-light rounded-pill border">
                    <Terminal size={14} className="text-primary" />
                    <span className="text-muted fw-medium">Depth:</span>
                    <span className="fw-bold">{scan.config.depth === 0 ? 'Unlimited' : scan.config.depth}</span>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="d-flex align-items-center gap-2 px-3 py-2 bg-light rounded-pill border">
                    <Shield size={14} className="text-primary" />
                    <span className="text-muted fw-medium">Unique Only:</span>
                    <span className="fw-bold">{scan.config.scanSameLinkOnce ? 'Active' : 'Bypassed'}</span>
                  </div>
                </div>
                <div className="col-auto">
                  <div className="d-flex align-items-center gap-2 px-3 py-2 bg-light rounded-pill border">
                    <Activity size={14} className="text-primary" />
                    <span className="text-muted fw-medium">Concurrency:</span>
                    <span className="fw-bold">{scan.config.concurrency}</span>
                  </div>
                </div>

                <div className="col-12 col-lg-auto ms-lg-auto">
                  <div className="position-relative">
                    <div className="position-absolute top-50 start-0 translate-middle-y ps-3 text-muted">
                      <Search size={16} />
                    </div>
                    <input
                      type="text"
                      className="form-control form-control-sm ps-5 pe-5 py-2 rounded-pill border shadow-sm bg-white"
                      placeholder="Search links..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ minWidth: '250px' }}
                    />
                    {searchQuery && (
                      <button
                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y pe-3 text-muted p-0 border-0"
                        onClick={() => setSearchQuery('')}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>



              <div className="pt-4 border-top">
                <div className="d-flex align-items-center gap-2 mb-4">
                  <LayoutGrid size={20} className="text-primary" />
                  <h3 className="fs-4 fw-bold mb-0">Intel Pattern Results</h3>
                </div>
                <ScanResults results={scan.results} scanUrl={scan.scanUrl} scanId={scanId} scanConfig={scan.config} searchQuery={searchQuery} />
              </div>
            </div>
          ) : (
            <div className="text-center py-5">
              <Loader2 className="spinner-border text-primary border-0 animate-spin mb-3" size={40} />
              <p className="text-muted">Extracting intelligence patterns...</p>
            </div>
          )}
        </div>
      </AnimatedCard>
    </main>
  );
}

export default function ScanDetailsPage() {
  return <ScanDetailsContent />;
}