'use client';

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
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
  ArrowLeft,
  Key,
  Check,
  X,
  Plus
} from 'lucide-react';
import ScanResults from '@/components/ScanResults';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { motion } from 'framer-motion';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="w-full max-w-6xl"
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Loading Scan...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center items-center py-8">
              <motion.div
                animate={{ 
                  rotate: 360,
                  transition: { 
                    duration: 1,
                    ease: "linear",
                    repeat: Infinity 
                  }
                }}
              >
                <Loader2 className="h-8 w-8 text-primary" />
              </motion.div>
              <motion.span 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5 }}
                className="ml-2 text-lg"
              >
                Initializing...
              </motion.span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}

// The main scanner component that uses useSearchParams
function ScannerContent({ scanUrl, scanConfigString }: { scanUrl: string, scanConfigString: string | null }) {
  const router = useRouter();
  
  // Use ref to track if we've already initiated a scan for this URL/config combination
  const hasInitiatedScan = useRef(false);
  
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
  
  // Add a ref to track if auto-save has been attempted
  const hasAttemptedAutoSave = useRef(false);
  
  // Add state to track deletion status
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // At the top of the ScannerContent component, add a state for the confirmation dialog
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  
  // Parse the scan config - use useMemo to avoid creating new objects on every render
  const scanConfig = useMemo(() => {
    if (!scanConfigString) return null;
    try {
      return JSON.parse(decodeURIComponent(scanConfigString));
    } catch (e) {
      console.error('Failed to parse scan config:', e);
      return null;
    }
  }, [scanConfigString]);
  
  // Extract auth credentials if present in the config - use useMemo to prevent recreation on every render
  const authCredentials = useMemo(() => {
    return scanConfig?.auth;
  }, [scanConfig]);
  
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
    // Exit early if already scanning or if we've already initiated a scan for this URL
    if (isScanning || hasInitiatedScan.current) {
      return;
    }
    
    // Mark that we've initiated a scan for this URL
    hasInitiatedScan.current = true;
    
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
        
        // Prepare request body
        const requestBody: any = {
          url: scanUrl,
          config: scanConfig
        };
        
        // Add auth credentials if present
        if (authCredentials?.username && authCredentials?.password) {
          requestBody.auth = {
            username: authCredentials.username,
            password: authCredentials.password
          };
          // Pass the useAuthForAllDomains flag if present
          if ('useAuthForAllDomains' in scanConfig) {
            requestBody.config.useAuthForAllDomains = scanConfig.useAuthForAllDomains;
          }
        }
        
        const response = await fetch('/api/scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
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
        
        console.log('Scan completed with', data.results.length, 'results');
        
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
  }, [scanUrl, scanConfig, authCredentials]);
  
  // Add a separate useEffect for auto-saving that triggers when scan status changes to 'completed'
  useEffect(() => {
    // Check if scan is completed and has results and we haven't attempted an auto-save yet
    if (
      scanStatus.status === 'completed' && 
      results.length > 0 && 
      !hasAttemptedAutoSave.current && 
      !isSaving && 
      !saveSuccess
    ) {
      console.log('Auto-save triggered from status change useEffect');
      hasAttemptedAutoSave.current = true;
      
      // Use a timeout to ensure all state updates have been processed
      const autoSaveTimeout = setTimeout(async () => {
        try {
          console.log('Executing auto-save...');
          await handleSaveScan();
          console.log('Auto-save completed successfully');
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 1000);
      
      // Clean up timeout if component unmounts
      return () => clearTimeout(autoSaveTimeout);
    }
  }, [scanStatus.status, results.length, isSaving, saveSuccess]);
  
  // Reset the scan ref when URL or config changes
  useEffect(() => {
    hasInitiatedScan.current = false;
    hasAttemptedAutoSave.current = false;
  }, [scanUrl, scanConfigString]);
  
  // Modify the save scan function to be more reliable
  const handleSaveScan = async () => {
    console.log('handleSaveScan called with', results.length, 'results');
    if (results.length === 0) {
      console.log('No results to save, exiting handleSaveScan');
      return;
    }
    
    // Prevent concurrent save operations
    if (isSaving) {
      console.log('Already saving, exiting handleSaveScan');
      return;
    }
    
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      console.log('Preparing save payload for URL:', scanUrl);
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
      
      // Add auth credentials if present
      if (authCredentials?.username && authCredentials?.password) {
        savePayload.config = {
          ...savePayload.config,
          auth: {
            username: authCredentials.username,
            password: authCredentials.password
          }
        };
      }
      
      console.log('Sending save request to API...');
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
      console.log('Save API response:', data);
      
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
      
      // Rethrow to allow caller to catch it
      throw err;
    } finally {
      setIsSaving(false);
    }
  };
  
  // Add a function to handle scan deletion
  const handleDeleteScan = async () => {
    if (!savedScanId) return;
    
    setIsDeleting(true);
    setDeleteError(null);
    
    try {
      console.log('Deleting scan with ID:', savedScanId);
      
      const response = await fetch(`/api/delete-scan?id=${savedScanId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete scan (${response.status})`);
      }
      
      console.log('Scan deleted successfully');
      // Reset saved state
      setSaveSuccess(false);
      setSavedScanId(null);
      hasAttemptedAutoSave.current = false;
      
      return true; // Return true on success
      
    } catch (err) {
      console.error('Failed to delete scan:', err);
      let errorMessage = 'Failed to delete scan';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setDeleteError(errorMessage);
      return false; // Return false on error
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Modify the save scan button to show the dialog instead of saving again if already saved
  const handleSaveButtonClick = () => {
    if (saveSuccess) {
      // If already saved, just show the dialog
      console.log('Scan already saved, showing info dialog');
    } else {
      // Otherwise, save the scan
      handleSaveScan();
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
                        size="default"
                        onClick={handleSaveButtonClick}
                        disabled={isSaving || results.length === 0}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : saveSuccess ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                            Auto-saved
                          </>
                        ) : (
                          <>
                            <Save className="h-4 w-4 mr-2" />
                            Save to History
                          </>
                        )}
                      </Button>
                      
                      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="default"
                            disabled={!savedScanId}
                            className="flex items-center"
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Scan</AlertDialogTitle>
                          </AlertDialogHeader>
                          <div className="mb-4">
                            <div className="text-sm text-muted-foreground">
                              Are you sure you want to delete this scan? This action cannot be undone.
                            </div>
                          </div>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <Button
                              variant="destructive"
                              onClick={() => {
                                handleDeleteScan().then((success) => {
                                  // Close the dialog
                                  setShowDeleteConfirm(false);
                                  // Redirect to history page after successful deletion
                                  if (success) {
                                    router.push('/history');
                                  }
                                });
                              }}
                              disabled={isDeleting}
                            >
                              {isDeleting ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </Button>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
                </AlertDialogHeader>
                
                {/* Use divs instead of AlertDialogDescription to avoid p tag nesting issues */}
                <div className="mb-4">
                  <div className="text-sm text-muted-foreground mb-2">
                    Your scan has been automatically saved to history and can be accessed later.
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Scans are now automatically saved when completed so you won't lose your results.
                  </div>
                  
                  {/* Show delete error if any */}
                  {deleteError && (
                    <div className="mt-2 text-sm text-red-500">
                      Error: {deleteError}
                    </div>
                  )}
                </div>
                
                <AlertDialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-4">
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteScan}
                    disabled={isDeleting}
                    className="w-full sm:w-auto order-2 sm:order-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 mr-2" />
                        Delete Scan
                      </>
                    )}
                  </Button>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto order-1 sm:order-2">
                    <Button asChild className="w-full sm:w-auto">
                      <Link href={`/history/${savedScanId}`}>
                        View Saved Scan
                      </Link>
                    </Button>
                    <AlertDialogCancel className="w-full sm:w-auto">Close</AlertDialogCancel>
                  </div>
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
      <ScanPageContent />
    </Suspense>
  );
}

// Intermediate component to handle the decision between scan form and results
function ScanPageContent() {
  const searchParams = useSearchParams();
  const scanUrl = searchParams.get('url');
  
  // If no URL parameter is provided, show the scan form
  if (!scanUrl) {
    return <ScanForm />;
  }
  
  // If URL is provided, show the scanner content
  return <ScannerContent scanUrl={scanUrl} scanConfigString={searchParams.get('config')} />;
}

// New ScanForm component for initiating a scan
function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState<string>("");
  const [depth, setDepth] = useState<number>(0);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [requestTimeout, setRequestTimeout] = useState<number>(30);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Auth states
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authEnabled, setAuthEnabled] = useState<boolean>(false);
  const [useAuthForAllDomains, setUseAuthForAllDomains] = useState<boolean>(true);
  
  // Exclusion states
  const [regexExclusions, setRegexExclusions] = useState<string[]>([""]);
  const [cssSelectors, setCssSelectors] = useState<string[]>([""]);
  
  const handleScan = () => {
    // Basic URL validation
    if (!url || !url.startsWith('http')) {
      alert("Please enter a valid URL (starting with http or https).");
      return;
    }
    
    // Filter out empty entries
    const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
    const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");
    
    const config: any = {
      depth: depth,
      scanSameLinkOnce: true,
      concurrency: concurrency,
      itemsPerPage: 10,
      regexExclusions: filteredRegexExclusions,
      cssSelectors: filteredCssSelectors,
      requestTimeout: requestTimeout * 1000, // Convert to milliseconds
    };
    
    // Add auth credentials if enabled
    if (authEnabled && username && password) {
      config.auth = {
        username,
        password
      };
      config.useAuthForAllDomains = useAuthForAllDomains;
    }
    
    // Encode the config object for the URL
    const configParam = encodeURIComponent(JSON.stringify(config));
    
    // Navigate to the scan page with parameters
    router.push(`/scan?url=${encodeURIComponent(url)}&config=${configParam}`);
  };
  
  const toggleAuthDialog = () => {
    setShowAuthDialog(!showAuthDialog);
  };
  
  const saveAuthCredentials = () => {
    setAuthEnabled(username.trim() !== '' && password.trim() !== '');
    setShowAuthDialog(false);
  };
  
  const clearAuthCredentials = () => {
    setUsername('');
    setPassword('');
    setAuthEnabled(false);
    setShowAuthDialog(false);
  };
  
  const addRegexExclusion = () => setRegexExclusions([...regexExclusions, ""]);
  
  const removeRegexExclusion = (index: number) => {
    const newExclusions = [...regexExclusions];
    newExclusions.splice(index, 1);
    setRegexExclusions(newExclusions);
  };
  
  const updateRegexExclusion = (index: number, value: string) => {
    const newExclusions = [...regexExclusions];
    newExclusions[index] = value;
    setRegexExclusions(newExclusions);
  };
  
  const addCssSelector = () => setCssSelectors([...cssSelectors, ""]);
  
  const removeCssSelector = (index: number) => {
    const newSelectors = [...cssSelectors];
    newSelectors.splice(index, 1);
    setCssSelectors(newSelectors);
  };
  
  const updateCssSelector = (index: number, value: string) => {
    const newSelectors = [...cssSelectors];
    newSelectors[index] = value;
    setCssSelectors(newSelectors);
  };
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Scan</h1>
      
      {/* Main scan card */}
      <Card>
        <CardHeader>
          <CardTitle>Scan Website for Broken Links</CardTitle>
          <CardDescription>Enter a URL to scan for broken links and other issues</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="url">Website URL</Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="url"
                  placeholder="https://example.com"
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 h-10"
                />
                <Button 
                  variant={authEnabled ? "secondary" : "outline"} 
                  size="icon" 
                  onClick={toggleAuthDialog}
                  title="HTTP Basic Authentication"
                  className="h-10 w-10 flex items-center justify-center"
                >
                  <Key className="h-4 w-4" />
                </Button>
              </div>
              {authEnabled && (
                <div className="text-xs text-muted-foreground mt-1 flex items-center">
                  <Check className="h-3 w-3 mr-1 text-green-500" />
                  Basic Auth credentials set
                </div>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="depth">Scan Depth (0 for current page only)</Label>
                <Input
                  id="depth"
                  type="number"
                  min="0"
                  max="5"
                  value={depth}
                  onChange={(e) => setDepth(parseInt(e.target.value))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="concurrency">Concurrency (1-50)</Label>
                <Input
                  id="concurrency"
                  type="number"
                  min="1"
                  max="50"
                  value={concurrency}
                  onChange={(e) => setConcurrency(parseInt(e.target.value) || 10)}
                />
              </div>
            </div>
            
            {/* Button to toggle advanced options */}
            <Button 
              variant="link" 
              className="p-0 h-auto text-purple-600" 
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              {showAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>
            
            {/* Advanced options */}
            {showAdvanced && (
              <div className="border border-border rounded-lg p-4 space-y-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="requestTimeout">Request Timeout (seconds)</Label>
                  <Input
                    id="requestTimeout"
                    type="number"
                    min="5"
                    max="180"
                    value={requestTimeout}
                    onChange={(e) => setRequestTimeout(parseInt(e.target.value) || 30)}
                  />
                  <p className="text-xs text-muted-foreground">Time before giving up on a single URL (5-180 seconds)</p>
                </div>
                
                {/* Regex Exclusion Rules */}
                <div className="space-y-2">
                  <Label htmlFor="regexExclusions">Regex Exclusion Patterns</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Links matching these patterns will be skipped
                  </p>
                  
                  {regexExclusions.map((regex, index) => (
                    <div key={`regex-${index}`} className="flex gap-2 items-center mb-2">
                      <Input
                        value={regex}
                        onChange={(e) => updateRegexExclusion(index, e.target.value)}
                        placeholder="e.g. \/assets\/.*\.pdf$"
                      />
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRegexExclusion(index)}
                        disabled={regexExclusions.length <= 1}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addRegexExclusion}
                    className="mt-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pattern
                  </Button>
                </div>
                
                {/* CSS Selector Exclusions */}
                <div className="space-y-2">
                  <Label htmlFor="cssSelectors">CSS Selector Exclusions</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Links within these CSS selectors will be skipped
                  </p>
                  
                  {cssSelectors.map((selector, index) => (
                    <div key={`selector-${index}`} className="flex gap-2 items-center mb-2">
                      <Input
                        value={selector}
                        onChange={(e) => updateCssSelector(index, e.target.value)}
                        placeholder="e.g. .footer, #navigation, [data-skip]"
                      />
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCssSelector(index)}
                        disabled={cssSelectors.length <= 1}
                        className="shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button" 
                    variant="outline"
                    size="sm"
                    onClick={addCssSelector}
                    className="mt-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Selector
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="default"
            size="lg"
            onClick={handleScan}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            <AlertCircle className="mr-2" />
            Start Scan
          </Button>
        </CardFooter>
      </Card>
      
      {/* Auth Dialog */}
      {showAuthDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">HTTP Basic Authentication</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="useAuthForAllDomains"
                  checked={useAuthForAllDomains}
                  onCheckedChange={(checked) => setUseAuthForAllDomains(!!checked)}
                />
                <Label htmlFor="useAuthForAllDomains" className="cursor-pointer text-sm font-normal">
                  Use auth for all domains
                </Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={clearAuthCredentials}>
                Clear
              </Button>
              <Button variant="ghost" onClick={() => setShowAuthDialog(false)}>
                Cancel
              </Button>
              <Button variant="default" onClick={saveAuthCredentials}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 