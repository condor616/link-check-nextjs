'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanResult } from '@/lib/scanner';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Save, 
  FileDown, 
  Download, 
  Home,
  ArrowLeft
} from 'lucide-react';
import ScanResults from '@/components/ScanResults';
import ExportScanButton from '@/components/ExportScanButton';
import Link from 'next/link';
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

// Define the scan status interface
interface ScanStatus {
  status: 'initializing' | 'running' | 'completed' | 'error';
  progress: {
    processed: number;
    total: number;
    broken: number;
    ok: number;
    external: number;
    skipped: number;
  };
  message: string;
  elapsedSeconds: number;
  error?: string;
}

// Define SerializedScanResult for JSON storage
interface SerializedScanResult extends Omit<ScanResult, 'foundOn' | 'htmlContexts'> {
  foundOn: string[]; // Instead of Set<string>
  htmlContexts?: Record<string, string[]>; // Instead of Map<string, string[]>
}

// Loading fallback for Suspense
function ScannerLoading() {
  return (
    <main className="container mx-auto flex flex-col items-center p-4 md:p-8 min-h-screen">
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle className="text-2xl">Loading Scan...</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-lg">Initializing...</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

// The main scanner component that uses useSearchParams
function ScannerContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scanUrl = searchParams.get('url');
  const scanConfigString = searchParams.get('config');
  
  const [scanStatus, setScanStatus] = useState<ScanStatus>({
    status: 'initializing',
    progress: {
      processed: 0,
      total: 0,
      broken: 0,
      ok: 0,
      external: 0,
      skipped: 0
    },
    message: 'Initializing scan...',
    elapsedSeconds: 0
  });
  
  const [results, setResults] = useState<SerializedScanResult[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedScanId, setSavedScanId] = useState<string | null>(null);
  
  // Parse the scan config
  const scanConfig = scanConfigString ? JSON.parse(decodeURIComponent(scanConfigString)) : null;
  
  // Calculate progress percentage
  const progressPercentage = scanStatus.progress.total > 0 
    ? Math.min(100, Math.round((scanStatus.progress.processed / scanStatus.progress.total) * 100)) 
    : 0;
  
  // Format elapsed time
  const formatElapsedTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  
  // Start scan when component mounts
  useEffect(() => {
    if (!scanUrl) {
      router.push('/');
      return;
    }
    
    const startScan = async () => {
      setIsScanning(true);
      setScanStatus(prev => ({
        ...prev,
        status: 'running',
        message: 'Scan started',
      }));
      
      const startTime = Date.now();
      
      try {
        // Add a long timeout for the fetch request - 10 minutes
        // This is much longer than the default browser timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minute timeout
        
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: scanUrl,
            config: scanConfig
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to perform scan');
        }
        
        // Update state with scan results
        setResults(data.results);
        
        // Calculate broken, ok, external, and skipped from results
        const brokenCount = data.results.filter((r: SerializedScanResult) => r.status === 'broken' || r.status === 'error').length;
        const okCount = data.results.filter((r: SerializedScanResult) => r.status === 'ok').length;
        const externalCount = data.results.filter((r: SerializedScanResult) => r.status === 'external').length;
        const skippedCount = data.results.filter((r: SerializedScanResult) => r.status === 'skipped').length;
        
        setScanStatus({
          status: 'completed',
          message: 'Scan completed',
          progress: {
            processed: data.results.length,
            total: data.results.length,
            broken: brokenCount,
            ok: okCount,
            external: externalCount,
            skipped: skippedCount
          },
          elapsedSeconds: data.durationSeconds || (Date.now() - startTime) / 1000
        });
      } catch (error) {
        console.error('Error during scan:', error);
        
        // Handle different error types appropriately
        let errorMessage = 'Unknown scan error';
        
        if (error instanceof DOMException && error.name === 'AbortError') {
          errorMessage = 'The scan request timed out after 10 minutes. The website might be too large to scan in one go. Try scanning a specific section or increase the timeout.';
        } else if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        setScanStatus(prev => ({
          ...prev,
          status: 'error',
          message: 'Scan error',
          error: errorMessage
        }));
      } finally {
        setIsScanning(false);
      }
    };
    
    startScan();
  }, [scanUrl, scanConfig, scanConfigString, router]);
  
  // Save scan results
  const handleSaveScan = async () => {
    if (results.length === 0) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      // Prepare the payload for saving
      const savePayload = {
        scanUrl,
        scanDate: new Date().toISOString(),
        durationSeconds: scanStatus.elapsedSeconds,
        config: scanConfig || {
          depth: 0,
          scanSameLinkOnce: true,
          concurrency: 10,
          itemsPerPage: 10,
        },
        results,
      };
      
      // Add timeout for the save request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minute timeout
      
      const response = await fetch('/api/save-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to save scan (${response.status})`);
      }
      
      setSaveSuccess(true);
      setSavedScanId(data.scanId);
      console.log('Scan saved successfully:', data.scanId);
      
    } catch (err: unknown) {
      console.error('Failed to save scan:', err);
      
      // Handle different error types
      let errorMessage = 'Failed to save scan to history';
      
      if (err instanceof DOMException && err.name === 'AbortError') {
        errorMessage = 'The save request timed out. The scan data might be too large.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setSaveError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <main className="container mx-auto flex flex-col items-center p-4 md:p-8 min-h-screen">
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" className="p-0" asChild>
              <Link href="/">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Home
              </Link>
            </Button>
          </div>
          
          <CardTitle className="text-2xl flex items-center gap-2">
            Scan Progress
            {scanUrl && (
              <span className="text-sm font-normal text-muted-foreground">
                ({scanUrl.replace(/^https?:\/\//, '')})
              </span>
            )}
          </CardTitle>
          
          <CardDescription>
            {isScanning && 'Scanning in progress...'}
            {!isScanning && scanStatus.status === 'completed' && 'Scan completed'}
            {!isScanning && scanStatus.status === 'error' && 'Scan error'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Progress Indicator */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="text-sm font-medium">
                {scanStatus.progress.processed} / {scanStatus.progress.total || '?'} URLs processed
              </div>
              <div className="text-sm text-muted-foreground">
                {isScanning ? 'Scanning...' : `${progressPercentage}%`}
              </div>
            </div>
            
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full ${scanStatus.status === 'error' ? 'bg-destructive' : 'bg-primary'}`}
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <div>Time elapsed: {formatElapsedTime(scanStatus.elapsedSeconds)}</div>
            </div>
          </div>
          
          {/* Error display */}
          {scanStatus.status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {scanStatus.error || 'An error occurred during the scan'}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Statistics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-muted/50 p-4 rounded-md">
              <div className="text-xs text-muted-foreground">OK Links</div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                {scanStatus.progress.ok}
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <div className="text-xs text-muted-foreground">Broken Links</div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                <XCircle className="w-5 h-5 text-destructive" />
                {scanStatus.progress.broken}
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <div className="text-xs text-muted-foreground">External Links</div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                {scanStatus.progress.external}
              </div>
            </div>
            
            <div className="bg-muted/50 p-4 rounded-md">
              <div className="text-xs text-muted-foreground">Skipped Links</div>
              <div className="text-2xl font-semibold flex items-center gap-2">
                {scanStatus.progress.skipped}
              </div>
            </div>
          </div>
          
          {/* Scan Results (if scan is completed or has some results) */}
          {(scanStatus.status === 'completed' || results.length > 0) && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Results</h3>
                
                <div className="flex items-center gap-2">
                  {scanStatus.status !== 'error' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveScan}
                        disabled={isSaving || saveSuccess || results.length === 0}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : saveSuccess ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save to History
                          </>
                        )}
                      </Button>
                      
                      <ExportScanButton
                        results={results}
                        scanUrl={scanUrl || ''}
                      />
                    </>
                  )}
                </div>
              </div>
              
              <ScanResults 
                results={results} 
                scanUrl={scanUrl || ''} 
                itemsPerPage={10}
              />
            </div>
          )}
          
          {/* Loading indicator during scan */}
          {isScanning && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2 text-lg">Scanning in progress...</span>
            </div>
          )}
          
          {/* Save Success Dialog */}
          {saveSuccess && savedScanId && (
            <AlertDialog defaultOpen>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Scan Saved Successfully</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your scan has been saved to history and can be accessed later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <Button asChild>
                    <Link href={`/history/${savedScanId}`}>
                      View Saved Scan
                    </Link>
                  </Button>
                  <AlertDialogCancel>Close</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          
          {/* Save Error Dialog */}
          {saveError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Save Failed</AlertTitle>
              <AlertDescription>
                {saveError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

// Main page component with Suspense
export default function ScanPage() {
  return (
    <Suspense fallback={<ScannerLoading />}>
      <ScannerContent />
    </Suspense>
  );
} 