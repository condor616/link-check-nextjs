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
        // The API returns full scan objects, so we need to extract the summary info
        const summaries = data.items.map((item: ScanRecord) => {
          // Count broken links in results
          const brokenLinksCount = item.results ? 
            item.results.filter((r) => 
              r.status === 'broken' || r.status === 'error'
            ).length : 0;
            
          return {
            id: item.id,
            scanUrl: item.scanUrl,
            scanDate: item.scanDate,
            durationSeconds: item.durationSeconds,
            resultsCount: item.results?.length || 0,
            brokenLinksCount
          };
        });
        
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
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // TODO: Export scan function

  return (
    <main className="container mx-auto flex flex-col items-center p-4 md:p-8 min-h-screen">
      <Card className="w-full max-w-5xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Scan History</CardTitle>
              <CardDescription>View and manage your previous scans</CardDescription>
            </div>
            <Link href="/">
              <Button variant="outline" size="sm">
                New Scan
              </Button>
            </Link>
          </div>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : scans.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No saved scans found.</p>
              <Button asChild>
                <Link href="/">Start a New Scan</Link>
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Links</TableHead>
                  <TableHead className="text-right">Broken</TableHead>
                  <TableHead className="w-[160px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <a 
                        href={scan.scanUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center hover:underline"
                      >
                        {scan.scanUrl.replace(/^https?:\/\//, '')}
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </TableCell>
                    <TableCell>{formatDate(scan.scanDate)}</TableCell>
                    <TableCell>{scan.durationSeconds.toFixed(2)}s</TableCell>
                    <TableCell className="text-right">{scan.resultsCount}</TableCell>
                    <TableCell className={`text-right ${scan.brokenLinksCount > 0 ? 'text-destructive font-medium' : ''}`}>
                      {scan.brokenLinksCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        {/* View Details Button */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          title="View Details"
                        >
                          <Link href={`/history/${scan.id}`}>
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        </Button>
                        
                        {/* Export Button - TODO: implement export */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          title="Export Scan"
                          disabled
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        
                        {/* Delete Button */}
                        <AlertDialog open={deleteId === scan.id} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive" 
                              onClick={() => setDeleteId(scan.id)}
                              disabled={isDeleting}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Scan</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this scan? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => deleteScan(scan.id)} 
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                disabled={isDeleting}
                              >
                                {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
} 