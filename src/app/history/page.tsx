'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Trash2, AlertCircle, ExternalLink, FileDown, Clock, Calendar, Database, FileJson, Settings, PlayCircle } from 'lucide-react';
import { useNotification } from "@/components/NotificationContext";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";

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

export default function HistoryPage() {
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [isSupabaseError, setIsSupabaseError] = useState<boolean>(false);
  const [settingsType, setSettingsType] = useState<'file' | 'supabase' | null>(null);
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
      toast.success("The scan has been successfully deleted.");
    } catch (err) {
      console.error('Failed to delete scan:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete scan');
    } finally {
      setDeleteId(null);
      setIsDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string, forCard: boolean = false) => {
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

      if (forCard) {
        return (
          <>
            <span className="text-3xl font-extrabold text-green-700">{formattedDate}</span>
            <span className="text-xs text-muted-foreground mt-1">{timeAgo}</span>
          </>
        );
      }

      return (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-sm">{formattedDate}</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
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

  // Get the exact time of the last scan
  const getLastScanDateTime = () => {
    // Combine scans and completed jobs for this metric
    const allCompleted = [...scans];
    // Add completed jobs that aren't already in scans (if any overlap, though usually they are separate sources)
    // For now just use scans as they represent "History"

    if (allCompleted.length === 0) return '-';

    try {
      // Simple approach - sort the scans by date and take the most recent
      const sortedScans = [...allCompleted].sort((a, b) => {
        const dateA = new Date(a.scanDate).getTime();
        const dateB = new Date(b.scanDate).getTime();

        // If either date is invalid, consider it lesser (will be sorted to the end)
        if (isNaN(dateA)) return 1;
        if (isNaN(dateB)) return -1;

        return dateB - dateA; // Descending order (newest first)
      });

      // Find the first scan with a valid date
      for (const scan of sortedScans) {
        const date = new Date(scan.scanDate);
        if (!isNaN(date.getTime())) {
          return formatDate(scan.scanDate, true);
        }
      }

      // Fallback - try the first scan regardless
      if (allCompleted.length > 0) {
        const firstScan = allCompleted[0];
        return formatDate(firstScan.scanDate, true);
      }

      return '-';
    } catch (error) {
      console.error('Error formatting last scan date:', error);
      return '-';
    }
  };

  // Filter active jobs
  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'running');
  // Filter completed/failed jobs to show in list if not already in history (optional, but for now let's show them separately or merge)
  // Actually, let's just show active jobs in a separate card, and history below.
  // We can also show completed jobs in the history list if we want, but they might duplicate if we sync them.
  // For now, let's just show active jobs.

  return (
    <div className="container mx-auto p-4 max-w-none">
      <div className="w-full">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Scan History</h1>
            <p className="text-muted-foreground">
              View and manage your previous scans
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="whitespace-nowrap"
              asChild
            >
              <Link href="/scan">
                <AlertCircle className="h-4 w-4 mr-2" />
                New Scan
              </Link>
            </Button>

            <Button
              onClick={fetchData}
              variant="outline"
              disabled={isLoading}
              className="whitespace-nowrap"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Refresh List
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Scans Card */}
          <Card className="group bg-card border-border shadow-sm hover:border-primary hover:shadow-[0_0_20px_-5px_var(--primary)] transition-all duration-300 rounded-xl cursor-pointer">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="rounded-full bg-purple-50 p-3 group-hover:bg-purple-100 transition-colors">
                  <Database className="h-8 w-8 text-purple-600" />
                </div>
                <div className="flex flex-col items-center justify-center flex-grow">
                  <span className="text-3xl font-extrabold text-purple-700">{scans.length}</span>
                </div>
                <span className="text-sm text-muted-foreground">Total Scans</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Jobs Card */}
          <Card className="group bg-card border-border shadow-sm hover:border-primary hover:shadow-[0_0_20px_-5px_var(--primary)] transition-all duration-300 rounded-xl cursor-pointer">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="rounded-full bg-blue-50 p-3 group-hover:bg-blue-100 transition-colors">
                  <PlayCircle className="h-8 w-8 text-blue-600" />
                </div>
                <div className="flex flex-col items-center justify-center flex-grow">
                  <span className="text-3xl font-extrabold text-blue-700">{activeJobs.length}</span>
                </div>
                <span className="text-sm text-muted-foreground">Active Scans</span>
              </div>
            </CardContent>
          </Card>

          {/* Last Scan Card */}
          <Card className="group bg-card border-border shadow-sm hover:border-primary hover:shadow-[0_0_20px_-5px_var(--primary)] transition-all duration-300 rounded-xl cursor-pointer">
            <CardContent className="p-6">
              <div className="flex flex-col items-center justify-center h-full space-y-6">
                <div className="rounded-full bg-green-50 p-3 group-hover:bg-green-100 transition-colors">
                  <Clock className="h-8 w-8 text-green-600" />
                </div>
                <div className="flex flex-col items-center justify-center flex-grow">
                  {getLastScanDateTime()}
                </div>
                <span className="text-sm text-muted-foreground">Last Scan</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Jobs Section */}
        {activeJobs.length > 0 && (
          <Card className="bg-card border-border shadow-sm mb-8">
            <CardHeader>
              <CardTitle>Active Scans</CardTitle>
              <CardDescription>Currently running or queued scans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeJobs.map(job => (
                  <div key={job.id} className="border rounded-lg p-4 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold truncate max-w-[300px]">{job.scan_url}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <span className={`capitalize px-2 py-0.5 rounded-full text-xs ${job.status === 'running' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                            }`}>
                            {job.status}
                          </span>
                          <span>•</span>
                          <span>Started {formatDate(job.created_at)}</span>
                        </div>
                      </div>
                      <Link href={`/history/${job.id}`}>
                        <Button size="sm" variant="outline">View Progress</Button>
                      </Link>
                    </div>
                    {job.status === 'running' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{job.urls_scanned} URLs scanned</span>
                          <span>{job.progress_percent}%</span>
                        </div>
                        <Progress value={job.progress_percent} className="h-2" />
                        <p className="text-xs text-muted-foreground truncate">Current: {job.current_url}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* History Section */}
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && scans.length === 0 ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : error ? (
              isSupabaseError && settingsType === 'supabase' ? (
                <div className="p-6 border rounded-lg bg-amber-50">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <Database className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-lg font-medium text-amber-800">Database Connection Issue</h3>
                        <p className="mt-1 text-amber-700">
                          Unable to connect to the Supabase database. Your settings are configured to use Supabase, but the connection failed.
                        </p>
                      </div>
                      <div className="space-y-3">
                        <h4 className="font-medium text-amber-800">You have two options:</h4>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Button onClick={switchToFileStorage} variant="outline" className="bg-transparent border-input hover:bg-accent hover:text-accent-foreground">
                            <FileJson className="mr-2 h-4 w-4" />
                            Switch to File Storage
                          </Button>
                          <Button onClick={goToSettings} variant="default">
                            <Settings className="mr-2 h-4 w-4" />
                            Fix Supabase Settings
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )
            ) : scans.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No scan history found</p>
                <Link href="/">
                  <Button variant="purple">Start Your First Scan</Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>URL</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Results</TableHead>
                      <TableHead>Broken Links</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {scans.map((scan) => (
                      <TableRow key={scan.id} className="cursor-pointer">
                        <TableCell className="font-medium truncate max-w-[200px]" title={scan.scanUrl}>
                          {scan.scanUrl}
                        </TableCell>
                        <TableCell>{formatDate(scan.scanDate)}</TableCell>
                        <TableCell>{scan.resultsCount}</TableCell>
                        <TableCell>
                          <span className={scan.brokenLinksCount > 0 ? 'text-red-500 font-semibold' : 'text-green-500'}>
                            {scan.brokenLinksCount}
                          </span>
                        </TableCell>
                        <TableCell>{scan.durationSeconds.toFixed(2)}s</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Link href={`/history/${scan.id}`}>
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </Link>

                          <Link href={`/scan?id=${scan.id}`}>
                            <Button variant="outline" size="sm" className="text-purple-600 border-purple-200 hover:bg-purple-50">
                              <AlertCircle className="h-4 w-4 mr-1" />
                              Scan again
                            </Button>
                          </Link>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-500 border-red-200 hover:bg-red-50"
                                onClick={() => setDeleteId(scan.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete this scan history record. This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteScan(scan.id)}
                                  className="bg-red-500 hover:bg-red-600 text-white"
                                  disabled={isDeleting}
                                >
                                  {isDeleting && deleteId === scan.id ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    'Delete'
                                  )}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}