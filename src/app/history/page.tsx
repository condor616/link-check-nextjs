'use client';

import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/navigation';
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
import { Loader2, Trash2, AlertCircle, ExternalLink, FileDown } from 'lucide-react';
import { Input } from "@/components/ui/input";

// Define the scan summary structure (from API response)
interface ScanSummary {
  id: string;
  scanUrl: string;
  scanDate: string;
  durationSeconds: number;
  resultsCount: number;
  brokenLinksCount: number;
}

// Define the full scan record structure received from the API
interface ScanRecord {
  id: string;
  scanUrl: string;
  scanDate: string;
  durationSeconds: number;
  results: Array<{
    url: string;
    status: string;
    statusCode?: number;
    errorMessage?: string;
    foundOn?: string[] | Set<string>;
  }>;
  config: {
    depth: number;
    scanSameLinkOnce: boolean;
    concurrency: number;
  };
}

export default function HistoryPage() {
  // const router = useRouter(); // Uncomment when needed for navigation
  const [scans, setScans] = useState<ScanSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Load scans on initial render
  useEffect(() => {
    fetchScans();
  }, []);

  // Function to fetch all scans
  const fetchScans = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/history');
      const data = await response.json();

      if (!response.ok) {
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
          brokenLinksCount: item.brokenLinksCount ?? 0
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
    } finally {
      setIsLoading(false);
    }
  };

  // Function to delete a scan
  const deleteScan = async (id: string) => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/history/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to delete scan (${response.status})`);
      }
      
      // Remove the deleted scan from the list
      setScans(scans.filter(scan => scan.id !== id));
      
    } catch (err: unknown) {
      console.error(`Failed to delete scan ${id}:`, err);
      setError(
        err instanceof Error
          ? err.message 
          : 'Failed to delete scan'
      );
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      
      // Check if date is valid before formatting
      if (isNaN(date.getTime())) {
        return 'Invalid date';
      }
      
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  // Get the exact time of the last scan
  const getLastScanDateTime = () => {
    if (scans.length === 0) return '-';
    
    try {
      // Simple approach - sort the scans by date and take the most recent
      // First attempt to just sort and use the first result
      const sortedScans = [...scans].sort((a, b) => {
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
          return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(date);
        }
      }
      
      // Fallback - try the first scan regardless
      if (scans.length > 0) {
        const firstScan = scans[0];
        const date = new Date(firstScan.scanDate);
        if (!isNaN(date.getTime())) {
          return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }).format(date);
        }
      }
      
      return '-';
    } catch (error) {
      console.error('Error formatting last scan date:', error);
      return '-';
    }
  };

  // TODO: Export scan function

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
              onClick={fetchScans} 
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-white shadow">
            <CardContent className="py-4 px-5">
              <h3 className="text-4xl font-bold text-purple-600">{scans.length}</h3>
              <p className="text-sm text-muted-foreground">Total Scans</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow">
            <CardContent className="py-4 px-5">
              <h3 className="text-4xl font-bold text-purple-600">
                {scans.reduce((sum, scan) => sum + scan.brokenLinksCount, 0)}
              </h3>
              <p className="text-sm text-muted-foreground">Total Broken Links</p>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow">
            <CardContent className="py-4 px-5">
              <h3 className="text-4xl font-bold text-purple-600 break-words">
                {getLastScanDateTime()}
              </h3>
              <p className="text-sm text-muted-foreground">Last Scan</p>
            </CardContent>
          </Card>
        </div>
        
        <Card className="bg-white shadow">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
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
                      <TableRow key={scan.id}>
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