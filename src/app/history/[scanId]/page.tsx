'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, AlertCircle, ArrowLeft, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { ScanResult } from '@/lib/scanner';
import ScanResults from '@/components/ScanResults';
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

// Main content component that uses useParams
function ScanDetailsContent() {
  const router = useRouter();
  const params = useParams();
  const scanId = params.scanId as string;
  
  const [scan, setScan] = useState<SavedScan | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  
  useEffect(() => {
    // Fetch the scan data
    const fetchScan = async () => {
      setIsLoading(true);
      setError(null);
      
      // Validate scanId
      if (!scanId || scanId === 'null' || scanId === 'undefined') {
        setError('Scan not found');
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/history/${scanId}`);
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || `Failed to fetch scan data (${response.status})`);
        }
        
        setScan(data);
      } catch (err: unknown) {
        console.error(`Failed to fetch scan ${scanId}:`, err);
        setError(
          err instanceof Error 
            ? err.message 
            : 'Failed to load scan details'
        );
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchScan();
  }, [scanId]);
  
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
  
  // Count different types of links
  const okLinks = scan?.results?.filter(r => r.status === 'ok') || [];
  const externalLinks = scan?.results?.filter(r => r.status === 'external') || [];
  const skippedLinks = scan?.results?.filter(r => r.status === 'skipped') || [];
  
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
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
              {error === 'Scan not found' && (
                <div className="mt-4">
                  <p className="mb-2">The scan you're looking for doesn't exist or may have been deleted.</p>
                  <Link href="/history">
                    <Button variant="outline" size="sm">
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Return to Scan History
                    </Button>
                  </Link>
                </div>
              )}
            </Alert>
          ) : scan ? (
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