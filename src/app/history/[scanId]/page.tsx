'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, Trash2, CheckCircle2, XCircle, RefreshCw, Pause, Play, Square } from 'lucide-react';
import { ScanResult } from '@/lib/scanner';
import ScanResults from '@/components/ScanResults';
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
    <main className="container mx-auto p-4 max-w-none">
      <Card className="w-full bg-white shadow">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" className="p-0" asChild>
              <Link href="/history">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to History
              </Link>
            </Button>
          </div>
          <CardTitle className="text-2xl">Loading Scan Details...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
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
      if (job) {
        // We might need a delete endpoint for jobs, or just use the history one if we unify
        // For now, let's assume we can't delete running jobs easily without a specific endpoint
        // But if it's completed, it might be in history?
        // Actually, let's just try the history delete endpoint, or we need a job delete endpoint.
        // I'll assume for now we can't delete running jobs from UI yet.
        alert("Deletion of jobs is not yet implemented.");
        setIsDeleting(false);
        return;
      }

      const response = await fetch(`/api/history/${scanId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || `Failed to delete scan (${response.status})`);
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

      // Optimistic update or just wait for poll
      // For better UX, we could force a fetch immediately
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
      <main className="container mx-auto p-4 max-w-none">
        <Card className="w-full bg-white shadow">
          <CardContent className="pt-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              <div className="mt-4">
                <Link href="/history">
                  <Button variant="outline" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Return to Scan History
                  </Button>
                </Link>
              </div>
            </Alert>
          </CardContent>
        </Card>
      </main>
    );
  }

  // Show Job Progress
  if (job && (job.status === 'queued' || job.status === 'running' || job.status === 'pausing' || job.status === 'paused' || job.status === 'stopping' || job.status === 'stopped')) {
    const isActive = job.status === 'running' || job.status === 'queued';
    const isPaused = job.status === 'paused';
    const isTransient = job.status === 'pausing' || job.status === 'stopping';

    return (
      <main className="container mx-auto p-4 max-w-none">
        <Card className="w-full bg-white shadow">
          <CardHeader>
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" className="p-0" asChild>
                <Link href="/history">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to History
                </Link>
              </Button>

              <div className="flex gap-2">
                {/* Control Buttons */}
                {job.status !== 'stopped' && job.status !== 'stopping' && (
                  <>
                    {!isTransient && (
                      isActive ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleControl('pause')}
                          disabled={isControlling}
                        >
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </Button>
                      ) : isPaused ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleControl('resume')}
                          disabled={isControlling}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          Resume
                        </Button>
                      ) : null
                    )}

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleControl('stop')}
                      disabled={isControlling}
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
            <CardTitle className="text-2xl flex items-center gap-2">
              Scan {isActive ? 'in Progress' : isPaused ? 'Paused' : job.status === 'stopped' ? 'Stopped' : 'Status'}
              <span className="text-sm font-normal text-muted-foreground">
                ({job.scan_url})
              </span>
            </CardTitle>
            <CardDescription>
              Status: <span className="font-semibold capitalize">{job.status}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{job.progress_percent}%</span>
              </div>
              <Progress value={job.progress_percent} className={isPaused ? "opacity-50" : ""} />
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-muted-foreground">Scanned URLs</p>
                <p className="text-xl font-semibold">{job.urls_scanned}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-muted-foreground">Current URL</p>
                <p className="font-medium truncate" title={job.current_url}>{job.current_url || 'Waiting...'}</p>
              </div>
            </div>

            {job.status === 'queued' && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertTitle>{job.urls_scanned > 0 ? "Resuming Scan" : "Queued"}</AlertTitle>
                <AlertDescription>
                  {job.urls_scanned > 0 ? "Worker is picking up the job..." : "Waiting for a worker to pick up the job..."}
                </AlertDescription>
              </Alert>
            )}

            {job.status === 'paused' && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <Pause className="h-4 w-4 text-yellow-600" />
                <AlertTitle className="text-yellow-800">Scan Paused</AlertTitle>
                <AlertDescription className="text-yellow-700">
                  The scan is currently paused. Click Resume to continue.
                </AlertDescription>
              </Alert>
            )}

            {job.status === 'stopped' && (
              <Alert variant="destructive">
                <Square className="h-4 w-4" />
                <AlertTitle>Scan Stopped</AlertTitle>
                <AlertDescription>
                  This scan was manually stopped.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </main>
    );
  }

  // Show Completed Scan
  return (
    <main className="container mx-auto p-4 max-w-none">
      <Card className="w-full bg-white shadow">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" className="p-0" asChild>
              <Link href="/history">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to History
              </Link>
            </Button>

            <div className="flex gap-2">
              {scan && (
                <Link href={`/scan?id=${scanId}`}>
                  <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Scan again
                  </Button>
                </Link>
              )}
            </div>
          </div>

          <CardTitle className="text-2xl flex items-center gap-2">
            Scan Details
            {scan && (
              <span className="text-sm font-normal text-muted-foreground">
                ({scan.scanUrl.replace(/^https?:\/\//, '')})
              </span>
            )}
          </CardTitle>

          {scan && (
            <CardDescription>
              Scanned on {formatDate(scan.scanDate)} •
              Duration: {scan.durationSeconds.toFixed(2)}s •
              Found {scan.results.length} links ({brokenLinks.length} broken)
            </CardDescription>
          )}
        </CardHeader>

        <CardContent>
          {scan ? (
            <div className="space-y-8">
              {/* Configuration Summary */}
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium">Scan Depth:</span> {scan.config.depth === 0 ? 'Unlimited' : scan.config.depth}
                </div>
                <div>
                  <span className="font-medium">Scan Unique URLs Only:</span> {scan.config.scanSameLinkOnce ? 'Yes' : 'No'}
                </div>
                <div>
                  <span className="font-medium">Concurrency:</span> {scan.config.concurrency}
                </div>
              </div>

              {/* Scan Results */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">Results</h3>

                  {scan && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={isDeleting}>
                          {isDeleting ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 mr-2" />
                          )}
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete this scan record. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={deleteScan}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>

                <ScanResults
                  results={scan.results}
                  scanUrl={scan.scanUrl}
                  scanId={scanId}
                  scanConfig={scan.config}
                />
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}

// Main page component with Suspense
export default function ScanDetailsPage() {
  return (
    <Suspense fallback={<ScanDetailsLoading />}>
      <ScanDetailsContent />
    </Suspense>
  );
}