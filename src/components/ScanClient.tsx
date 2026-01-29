'use client';

import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ScanResult } from '@/lib/scanner';
import {
  Loader2,
  AlertCircle,
  Clock,
  ArrowLeft,
  Key,
  Check,
  X,
  Plus,
  ChevronDown,
  HelpCircle,
  ShieldCheck,
  Globe,
  Settings,
  Activity,
  Rocket,
  Save,
  CheckCircle2,
  FileUp,
  FileCode,

  XCircle
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import ScanResults from '@/components/ScanResults';
import { JSONPreview } from '@/components/JSONPreview';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { TransitionLink } from '@/components/TransitionLink';

// Loading fallback for Suspense
function ScannerLoading() {
  return (
    <div className="w-100 py-5 mt-5 text-center fade-in-up">
      <AnimatedCard className="border-0 shadow-lg">
        <div className="py-5">
          <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3rem', height: '3rem' }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <h2 className="h4 fw-bold text-dark dark:text-light mb-2">Initializing System</h2>
          <p className="text-muted">Preparing the Link Checker Pro engine for your analysis...</p>
        </div>
      </AnimatedCard>
    </div>
  );
}

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

// The main scanner component that uses useSearchParams
function ScannerContent({ scanUrl, scanConfigString, scanId }: { scanUrl?: string, scanConfigString?: string | null, scanId?: string }) {
  const router = useRouter();

  // Use ref to track if we've already initiated a scan for this URL/config combination
  const hasInitiatedScan = useRef(false);

  // Add copy to clipboard function
  const copyJsonToClipboard = (json: any) => {
    const stringified = JSON.stringify(json, null, 2);
    navigator.clipboard.writeText(stringified);
  };

  // Add states for loading scan parameters from ID
  const [paramUrl, setParamUrl] = useState<string | undefined>(scanUrl);
  const [paramConfigString, setParamConfigString] = useState<string | null>(scanConfigString || null);
  const [isLoadingParams, setIsLoadingParams] = useState<boolean>(!!scanId);
  const [loadParamsError, setLoadParamsError] = useState<string | null>(null);

  // Add state for edited configuration
  const [editedConfig, setEditedConfig] = useState<any>(null);
  const [showAdvancedEdit, setShowAdvancedEdit] = useState<boolean>(false);

  // States for exclusion patterns
  const [regexExclusions, setRegexExclusions] = useState<string[]>([""]);
  const [cssSelectors, setCssSelectors] = useState<string[]>([""]);
  const [cssSelectorsForceExclude, setCssSelectorsForceExclude] = useState<boolean>(false);
  const [wildcardExclusions, setWildcardExclusions] = useState<string[]>([""]);

  // Add confirmation state to prevent automatic scan on page refresh
  const [scanConfirmed, setScanConfirmed] = useState<boolean>(false);



  // Refs removed as they are no longer needed with Popover

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
    if (!paramConfigString) return null;
    try {
      return JSON.parse(decodeURIComponent(paramConfigString));
    } catch (e) {
      console.error('Failed to parse scan config:', e);
      return null;
    }
  }, [paramConfigString]);

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

  // Initialize editedConfig and exclusion patterns when scanConfig changes
  useEffect(() => {
    if (scanConfig && !editedConfig) {
      setEditedConfig({ ...scanConfig });

      // Initialize exclusion patterns from config
      if (scanConfig.regexExclusions && Array.isArray(scanConfig.regexExclusions)) {
        setRegexExclusions(scanConfig.regexExclusions.length > 0
          ? scanConfig.regexExclusions
          : [""]
        );
      }

      if (scanConfig.cssSelectors && Array.isArray(scanConfig.cssSelectors)) {
        setCssSelectors(scanConfig.cssSelectors.length > 0
          ? scanConfig.cssSelectors
          : [""]
        );
      }

      setCssSelectorsForceExclude(!!scanConfig.cssSelectorsForceExclude);

      if (scanConfig.wildcardExclusions && Array.isArray(scanConfig.wildcardExclusions)) {
        setWildcardExclusions(scanConfig.wildcardExclusions.length > 0
          ? scanConfig.wildcardExclusions
          : [""]
        );
      }
    }
  }, [scanConfig, editedConfig]);

  // Add useEffect to load parameters from scanId
  useEffect(() => {
    if (!scanId) return;

    const fetchScanParams = async () => {
      setIsLoadingParams(true);
      setLoadParamsError(null);

      try {
        const response = await fetch(`/api/scan-params/${scanId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch scan parameters');
        }

        // Set the parameters for the scan
        setParamUrl(data.url);
        setParamConfigString(JSON.stringify(data.config));
        setIsLoadingParams(false);
      } catch (err) {
        console.error('Error fetching scan parameters:', err);
        setLoadParamsError(err instanceof Error ? err.message : 'Failed to load scan parameters');
        setIsLoadingParams(false);
      }
    };

    fetchScanParams();
  }, [scanId]);

  // Modify the useEffect that starts the scan to check for both loading and confirmation
  useEffect(() => {
    // Exit early if already scanning or if we've already initiated a scan for this URL
    if (isScanning || hasInitiatedScan.current) {
      return;
    }

    // Don't start scan until confirmed and params are loaded
    if (!scanConfirmed || isLoadingParams || !paramUrl) {
      return;
    }

    // Mark that we've initiated a scan for this URL
    hasInitiatedScan.current = true;

    const startScan = async () => {
      setIsScanning(true);
      setScanStatus(prev => ({
        ...prev,
        status: 'initializing',
        message: 'Submitting scan job...',
      }));

      try {
        // Prepare request body
        const requestBody: any = {
          url: paramUrl,
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

        const response = await fetch('/api/jobs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to submit scan job');
        }

        // Use router.replace to prevent back-nav into an already-submitted state
        router.replace(`/history/${data.id}`);

      } catch (error) {
        console.error('Error submitting scan:', error);

        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        setScanStatus(prev => ({
          ...prev,
          status: 'error',
          message: 'Submission error',
          error: errorMessage
        }));
        setIsScanning(false);
      }
    };

    startScan();
  }, [paramUrl, scanConfig, authCredentials, scanConfirmed, isLoadingParams]);

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
  }, [paramUrl, paramConfigString]);



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
      console.log('Preparing save payload for URL:', paramUrl);
      // Prepare the payload for saving
      const savePayload = {
        scanUrl: paramUrl,
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

  // Functions for handling exclusion patterns
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

  const addWildcardExclusion = () => setWildcardExclusions([...wildcardExclusions, ""]);

  const removeWildcardExclusion = (index: number) => {
    const newExclusions = [...wildcardExclusions];
    newExclusions.splice(index, 1);
    setWildcardExclusions(newExclusions);
  };

  const updateWildcardExclusion = (index: number, value: string) => {
    const newExclusions = [...wildcardExclusions];
    newExclusions[index] = value;
    setWildcardExclusions(newExclusions);
  };

  // Add a function to handle configuration editing
  const updateConfigField = (field: string, value: any) => {
    setEditedConfig((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  // Modify the confirm scan function to use the edited config with exclusion patterns
  const handleConfirmScan = () => {
    if (editedConfig) {
      // Filter out empty exclusion patterns
      const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
      const filteredWildcardExclusions = wildcardExclusions.filter(pattern => pattern.trim() !== "");
      const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");

      // Update the config with the edited values
      const updatedConfig = {
        ...editedConfig,
        regexExclusions: filteredRegexExclusions,
        cssSelectors: filteredCssSelectors,
        cssSelectorsForceExclude: cssSelectorsForceExclude,
        wildcardExclusions: filteredWildcardExclusions,
        excludeSubdomains: editedConfig.excludeSubdomains
      };

      // Update the paramConfigString with the edited config
      setParamConfigString(JSON.stringify(updatedConfig));
    }
    setScanConfirmed(true);
  };

  // Modify the confirmation dialog to include scanId info and handle loading states
  if (isLoadingParams) {
    return (
      <div className="w-100 py-5 mt-5 text-center fade-in-up">
        <AnimatedCard className="border-0 shadow-lg">
          <div className="py-5">
            <div className="spinner-border text-primary mb-4" role="status" style={{ width: '3rem', height: '3rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <h2 className="h4 fw-bold text-dark dark:text-light mb-2">Decrypting Configuration</h2>
            <p className="text-muted">Extracting scan parameters from the secure link...</p>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  if (loadParamsError) {
    return (
      <div className="w-100 py-5 mt-5 fade-in-up">
        <AnimatedCard className="border-0 shadow-lg text-center p-5">
          <div className="mb-4">
            <AlertCircle size={64} className="text-danger opacity-75" />
          </div>
          <h2 className="h4 fw-bold mb-3 text-dark dark:text-light">Access Denied / Invalid Link</h2>
          <div className="alert alert-danger border-0 bg-danger bg-opacity-10 mb-4 py-3 mx-auto" style={{ maxWidth: '500px' }}>
            <div className="fw-bold small mb-1">Error Details:</div>
            <div className="small opacity-75">{loadParamsError}</div>
          </div>
          <TransitionLink href="/" className="btn btn-primary px-4 fw-bold">
            Return to Dashboard
          </TransitionLink>
        </AnimatedCard>
      </div>
    );
  }

  if (!scanConfirmed) {
    return (
      <div className="w-100 py-4 fade-in-up">
        <AnimatedCard className="border-0 shadow-lg">
          <div className="card-header bg-transparent border-0 pb-0">
            <h2 className="h4 fw-bold mb-1 text-dark dark:text-light">Confirm Analysis</h2>
            <p className="text-muted small">Verify and adjust scan parameters before proceeding.</p>
          </div>

          <div className="card-body">
            <div className="alert alert-warning border-0 bg-warning bg-opacity-10 d-flex align-items-center mb-4 rounded-3">
              <AlertCircle className="me-3 text-warning" size={24} />
              <div className="text-warning-emphasis">
                <div className="fw-bold">Scan Confirmation Required</div>
                <div className="small">Please review the target URL and configuration below.</div>
              </div>
            </div>

            <div className="bg-light dark:bg-dark p-3 rounded-3 border mb-4">
              <div className="text-muted small mb-1">Target URL</div>
              <div className="fw-bold text-break text-primary">{paramUrl}</div>
            </div>

            {editedConfig && (
              <div className="space-y-4">
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Scan Depth</label>
                    <input
                      type="number"
                      className="form-control"
                      min="0"
                      max="5"
                      value={editedConfig.depth || 0}
                      onChange={(e) => updateConfigField('depth', parseInt(e.target.value) || 0)}
                    />
                    <div className="form-text x-small">0 = current page only, higher = deeper</div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Concurrency</label>
                    <input
                      type="number"
                      className="form-control"
                      min="1"
                      max="50"
                      value={editedConfig.concurrency || 10}
                      onChange={(e) => updateConfigField('concurrency', parseInt(e.target.value) || 10)}
                    />
                    <div className="form-text x-small">Simultaneous requests (1-50)</div>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label fw-semibold small">Timeout (seconds)</label>
                    <input
                      type="number"
                      className="form-control"
                      min="5"
                      max="180"
                      value={(editedConfig.requestTimeout || 30000) / 1000}
                      onChange={(e) => updateConfigField('requestTimeout', (parseInt(e.target.value) || 30) * 1000)}
                    />
                    <div className="form-text x-small">Maximum time per URL</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="scanSameLinkOnce"
                      checked={editedConfig.scanSameLinkOnce !== false}
                      onChange={(e) => updateConfigField('scanSameLinkOnce', e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="scanSameLinkOnce">
                      Unique Check Only
                    </label>
                  </div>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="skipExternalDomains"
                      checked={editedConfig.skipExternalDomains !== false}
                      onChange={(e) => updateConfigField('skipExternalDomains', e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="skipExternalDomains">
                      Skip external
                    </label>
                  </div>

                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="excludeSubdomains"
                      checked={editedConfig.excludeSubdomains !== false}
                      onChange={(e) => updateConfigField('excludeSubdomains', e.target.checked)}
                    />
                    <label className="form-check-label small" htmlFor="excludeSubdomains">
                      Exclude subdomains
                    </label>
                  </div>
                </div>

                <div className="mt-4 border-top pt-3">
                  <button
                    className="btn btn-link link-primary p-0 text-decoration-none fw-semibold d-flex align-items-center"
                    onClick={() => setShowAdvancedEdit(!showAdvancedEdit)}
                  >
                    <Settings size={18} className="me-2" />
                    {showAdvancedEdit ? 'Hide' : 'Show'} Advanced Filter Rules
                  </button>

                  {showAdvancedEdit && (
                    <div className="mt-3 p-3 bg-light dark:bg-dark rounded-3 border">
                      <div className="row g-4 text-start">
                        {/* Wildcard Exclusions - FIRST */}
                        <div className="col-lg-4">
                          <div className="d-flex align-items-center mb-2 position-relative">
                            <span className="fw-bold small me-2">Wildcard Exclusions</span>
                            <div className="position-relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <HelpCircle
                                    size={14}
                                    className="text-muted cursor-pointer"
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-3" side="right" align="start">
                                  <div className="fw-bold small mb-2 text-primary">Wildcard Usage</div>
                                  <div className="text-secondary opacity-75 small space-y-2" style={{ fontSize: '0.75rem' }}>
                                    <p className="mb-2">Simple pattern matching using <code>*</code> for multiple characters and <code>?</code> for one.</p>
                                    <div className="mb-1"><strong>Examples:</strong></div>
                                    <ul className="ps-3 mb-0">
                                      <li><code>/blog/*</code> - All blog posts</li>
                                      <li><code>*.pdf</code> - All PDF files</li>
                                      <li><code>domain.com/admin/*</code> - Specific domain path</li>
                                    </ul>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          {wildcardExclusions.map((pattern, index) => (
                            <div key={`wildcard-${index}`} className="input-group mb-2">
                              <input
                                type="text"
                                className="form-control form-control-sm font-monospace"
                                value={pattern}
                                onChange={(e) => updateWildcardExclusion(index, e.target.value)}
                                placeholder="e.g. /careers/*"
                              />
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => removeWildcardExclusion(index)}
                                disabled={wildcardExclusions.length <= 1}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button className="btn btn-sm btn-outline-primary mt-1" onClick={addWildcardExclusion}>
                            <Plus size={14} className="me-1" /> Add Rule
                          </button>
                        </div>

                        {/* CSS Selectors */}
                        <div className="col-lg-4">
                          <div className="d-flex align-items-center mb-2 position-relative">
                            <span className="fw-bold small me-2">CSS Selectors to skip</span>
                            <div className="position-relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <HelpCircle
                                    size={14}
                                    className="text-muted cursor-pointer"
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-3" side="right" align="start">
                                  <div className="fw-bold small mb-2 text-primary">CSS Exclusion</div>
                                  <div className="text-secondary opacity-75 small" style={{ fontSize: '0.75rem' }}>
                                    <p className="mb-2">Links inside elements matching these selectors will be ignored.</p>
                                    <div className="mb-1"><strong>Examples:</strong></div>
                                    <ul className="ps-3 mb-0">
                                      <li><code>.footer</code> - Ignore navigation in footer</li>
                                      <li><code>#sidebar nav</code> - Ignore sidebar links</li>
                                      <li><code>[aria-hidden="true"]</code> - Ignore hidden links</li>
                                    </ul>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          {cssSelectors.map((selector, index) => (
                            <div key={`selector-${index}`} className="input-group mb-2">
                              <input
                                type="text"
                                className="form-control form-control-sm font-monospace"
                                value={selector}
                                onChange={(e) => updateCssSelector(index, e.target.value)}
                                placeholder="e.g. .footer"
                              />
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => removeCssSelector(index)}
                                disabled={cssSelectors.length <= 1}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <button className="btn btn-sm btn-outline-primary mt-1" onClick={addCssSelector}>
                            <Plus size={14} className="me-1" /> Add Rule
                          </button>
                        </div>

                        {/* Regex Filters - LAST */}
                        <div className="col-lg-4">
                          <div className="d-flex align-items-center mb-2 position-relative">
                            <span className="fw-bold small me-2">Regex Filter rules</span>
                            <div className="position-relative">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <HelpCircle
                                    size={14}
                                    className="text-muted cursor-pointer"
                                  />
                                </PopoverTrigger>
                                <PopoverContent className="w-[280px] p-3" side="left" align="start">
                                  <div className="fw-bold small mb-2 text-primary">Advanced Regex</div>
                                  <div className="text-secondary opacity-75 small" style={{ fontSize: '0.75rem' }}>
                                    <p className="mb-2">Full JavaScript Regular Expression matching against the entire URL.</p>
                                    <div className="alert alert-warning p-2 small mb-2 border-0 bg-warning bg-opacity-10 text-warning-emphasis" style={{ fontSize: '0.7rem' }}>
                                      <div className="fw-bold d-flex align-items-center mb-1">
                                        <Activity size={12} className="me-1" /> Heads up!
                                      </div>
                                      Using <code>*</code> here means "zero or more of the previous character". For path patterns like <code>/blog/*</code>, use <strong>Wildcard Exclusions</strong> instead.
                                    </div>
                                    <div className="mb-1"><strong>Regex Examples:</strong></div>
                                    <ul className="ps-3 mb-0">
                                      <li><code>\/page\/\d+</code> - Numeric pages</li>
                                      <li><code>\.(jpg|png|gif)$</code> - Image files</li>
                                      <li><code>\?.*session=</code> - URLs with session params</li>
                                    </ul>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                          {regexExclusions.map((regex, index) => (
                            <div key={`regex-${index}`} className="input-group mb-2">
                              <input
                                type="text"
                                className={`form-control form-control-sm font-monospace ${regex.includes('*') && !regex.includes('\\*') && !regex.includes('.*') ? 'is-invalid' : ''}`}
                                value={regex}
                                onChange={(e) => updateRegexExclusion(index, e.target.value)}
                                placeholder="e.g. \.pdf$"
                              />
                              <button
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => removeRegexExclusion(index)}
                                disabled={regexExclusions.length <= 1}
                              >
                                <X size={14} />
                              </button>
                              {regex.includes('*') && !regex.includes('\\*') && !regex.includes('.*') && (
                                <div className="invalid-feedback x-small">
                                  Likely error: Did you mean <code>.*</code> or should this be a Wildcard?
                                </div>
                              )}
                            </div>
                          ))}
                          <button className="btn btn-sm btn-outline-primary mt-1" onClick={addRegexExclusion}>
                            <Plus size={14} className="me-1" /> Add Rule
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card-footer bg-transparent border-0 d-flex flex-column flex-sm-row justify-content-between gap-3 pb-4">
            <AnimatedButton variant="outline-secondary" onClick={() => router.push('/')}>
              <ArrowLeft size={18} className="me-2" />
              Cancel Analysis
            </AnimatedButton>
            <AnimatedButton variant="primary" onClick={handleConfirmScan} disabled={isScanning}>
              {isScanning ? (
                <>
                  <Loader2 size={18} className="me-2 spinner-border spinner-border-sm border-0" />
                  Submitting Request...
                </>
              ) : (
                <>
                  <Activity size={18} className="me-2" />
                  Launch Professional Audit
                </>
              )}
            </AnimatedButton>
          </div>
        </AnimatedCard>
      </div>
    );
  }

  return (
    <div className="container py-4 fade-in-up">
      <AnimatedCard className="border-0 shadow-lg">
        <div className="card-header bg-transparent border-0 pb-0 d-flex justify-content-between align-items-center">
          <div>
            <h2 className="h4 fw-bold mb-1 text-dark dark:text-light">
              Audit in Progress
              {paramUrl && <span className="ms-2 fs-6 fw-normal text-muted d-none d-sm-inline">({paramUrl.replace(/^https?:\/\//, '')})</span>}
            </h2>
            <p className="text-muted small">
              {isScanning ? 'Engine is active and analyzing links...' :
                scanStatus.status === 'completed' ? 'Analysis complete.' : 'System notification.'}
            </p>
          </div>
          <TransitionLink href="/" className="btn btn-outline-secondary btn-sm">
            <ArrowLeft size={16} className="me-1" /> Back
          </TransitionLink>
        </div>

        <div className="card-body">
          {/* Progress Indicator */}
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-end mb-2">
              <div>
                <span className="h3 mb-0 fw-bold text-primary">{scanStatus.progress.processed}</span>
                <span className="text-muted ms-2 small">/ {scanStatus.progress.total || '?'} links processed</span>
              </div>
              <div className="text-end">
                <div className="fw-bold text-dark dark:text-light small">{progressPercentage}%</div>
                <div className="text-muted x-small">Audit Completion</div>
              </div>
            </div>

            <div className="progress rounded-pill bg-light dark:bg-dark" style={{ height: '8px' }}>
              <motion.div
                className={`progress-bar rounded-pill ${scanStatus.status === 'error' ? 'bg-danger' : 'bg-primary'}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>

            <div className="d-flex justify-content-between mt-2 x-small text-muted">
              <div><Clock size={12} className="me-1" /> Elapsed: {formatElapsedTime(scanStatus.elapsedSeconds)}</div>
              <div>Rate: {Math.round((scanStatus.progress.processed / (scanStatus.elapsedSeconds || 1)) * 10) / 10} links/s</div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="row g-3 mb-4 text-center">
            <div className="col-6 col-md-3">
              <div className="p-2 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25">
                <div className="fw-bold text-success h5 mb-0">{scanStatus.progress.ok}</div>
                <div className="text-success small x-small fw-semibold">Healthy</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-2 rounded-3 bg-danger bg-opacity-10 border border-danger border-opacity-25">
                <div className="fw-bold text-danger h5 mb-0">{scanStatus.progress.broken}</div>
                <div className="text-danger small x-small fw-semibold">Broken</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-2 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25">
                <div className="fw-bold text-warning h5 mb-0">{scanStatus.progress.skipped}</div>
                <div className="text-warning small x-small fw-semibold">Skipped</div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="p-2 rounded-3 bg-info bg-opacity-10 border border-info border-opacity-25">
                <div className="fw-bold text-info h5 mb-0">{scanStatus.progress.external}</div>
                <div className="text-info small x-small fw-semibold">External</div>
              </div>
            </div>
          </div>

          {/* Error display */}
          {scanStatus.status === 'error' && (
            <div className="alert alert-danger border-0 shadow-sm mb-4 fade-in">
              <div className="d-flex align-items-center">
                <AlertCircle className="me-2" size={20} />
                <div className="fw-bold">Kernel Panic</div>
              </div>
              <div className="mt-2 small opacity-75">
                {scanStatus.error || 'An unexpected error occurred during the heartbeat cycle.'}
              </div>
            </div>
          )}

          {/* Results Area */}
          {(scanStatus.status === 'completed' || results.length > 0) && (
            <div className="mt-4">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-sm-center mb-4 gap-3">
                <h3 className="h5 fw-bold mb-0">Analysis Details</h3>

                <div className="d-flex gap-2">
                  {scanStatus.status !== 'error' && (
                    <>
                      <AnimatedButton
                        variant={saveSuccess ? "success" : "outline-primary"}
                        size="sm"
                        onClick={handleSaveButtonClick}
                        disabled={isSaving || results.length === 0}
                      >
                        {isSaving ? (
                          <><span className="spinner-border spinner-border-sm me-2" /> Saving...</>
                        ) : saveSuccess ? (
                          <><Check size={16} className="me-1" /> Saved</>
                        ) : (
                          <><Save size={16} className="me-1" /> Save Results</>
                        )}
                      </AnimatedButton>

                      {savedScanId && (
                        <button
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => setShowDeleteConfirm(true)}
                          disabled={isDeleting}
                        >
                          {isDeleting ? <span className="spinner-border spinner-border-sm" /> : <XCircle size={16} />}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              <ScanResults
                results={results}
                scanUrl={paramUrl || ''}
                scanId={savedScanId || undefined}
                scanConfig={scanConfig}
              />
            </div>
          )}

          {/* Finalizing Overlay */}
          {isScanning && (
            <div className="text-center py-5 border rounded-3 bg-light bg-opacity-50 mt-4">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Scanning...</span>
              </div>
              <p className="fw-semibold text-muted mb-0">Real-time inspection active...</p>
            </div>
          )}
        </div>
      </AnimatedCard>

      {/* Delete Confirmation Modal (Native Mockup) */}
      {showDeleteConfirm && (
        <div className="modal show d-block bg-black bg-opacity-50" tabIndex={-1} style={{ backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-danger">Discard Scan Results?</h5>
                <button type="button" className="btn-close" onClick={() => setShowDeleteConfirm(false)}></button>
              </div>
              <div className="modal-body py-4">
                <p className="text-muted mb-0">This operation is irreversible. All captured link data and logs for this specific session will be purged from the archive.</p>
              </div>
              <div className="modal-footer border-0 pt-0 pb-4 justify-content-center">
                <button type="button" className="btn btn-light px-4" onClick={() => setShowDeleteConfirm(false)}>Stay in Archive</button>
                <button
                  type="button"
                  className="btn btn-danger px-4"
                  disabled={isDeleting}
                  onClick={() => {
                    handleDeleteScan().then((success) => {
                      setShowDeleteConfirm(false);
                      if (success) router.push('/history');
                    });
                  }}
                >
                  {isDeleting ? 'Purging...' : 'Confirm Purge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main page component with Suspense
export function ScanClient() {
  return (
    <Suspense fallback={<ScannerLoading />}>
      <SearchParamsWrapper />
    </Suspense>
  );
}

function SearchParamsWrapper() {
  const searchParams = useSearchParams();
  const scanUrl = searchParams.get('url') || undefined;
  const scanConfigString = searchParams.get('config');
  const scanId = searchParams.get('id') || undefined;

  // If no URL parameter or scanId provided, show the scan form
  if (!scanUrl && !scanId) {
    return <ScanForm />;
  }

  // If we have a scanId, pass it directly to ScannerContent
  if (scanId) {
    return <ScannerContent scanId={scanId} />;
  }

  // If we have scanUrl and config, pass them directly
  if (scanUrl) {
    return <ScannerContent scanUrl={scanUrl} scanConfigString={scanConfigString} />;
  }

  // Fallback - shouldn't reach here in normal flow
  return <ScanForm />;
}

// New ScanForm component for initiating a scan
function ScanForm() {
  const router = useRouter();
  const [url, setUrl] = useState<string>("");
  const [depth, setDepth] = useState<number>(0);
  const [scanSameLinkOnce, setScanSameLinkOnce] = useState<boolean>(true);
  const [skipExternalDomains, setSkipExternalDomains] = useState<boolean>(true);
  const [excludeSubdomains, setExcludeSubdomains] = useState<boolean>(true);
  const [concurrency, setConcurrency] = useState<number>(10);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [requestTimeout, setRequestTimeout] = useState<number>(30);
  const [regexExclusions, setRegexExclusions] = useState<string[]>([""]);
  const [cssSelectors, setCssSelectors] = useState<string[]>([""]);
  const [cssSelectorsForceExclude, setCssSelectorsForceExclude] = useState<boolean>(false);
  const [wildcardExclusions, setWildcardExclusions] = useState<string[]>([""]);
  const [isCreatingScan, setIsCreatingScan] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Add states for saved scans dropdown
  const [savedConfigs, setSavedConfigs] = useState<any[]>([]);
  const [isLoadingSavedConfigs, setIsLoadingSavedConfigs] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedConfigName, setLoadedConfigName] = useState<string | null>(null);

  // Auth states
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authEnabled, setAuthEnabled] = useState<boolean>(false);
  const [useAuthForAllDomains, setUseAuthForAllDomains] = useState<boolean>(true);

  // Save configuration states
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);
  const [configName, setConfigName] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Add useEffect to fetch saved configurations when component mounts
  useEffect(() => {
    fetchSavedConfigs();
  }, []);

  // Function to fetch saved configurations
  const fetchSavedConfigs = async () => {
    setIsLoadingSavedConfigs(true);
    setLoadError(null);

    try {
      const response = await fetch('/api/saved-configs');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch saved configurations');
      }

      setSavedConfigs(data);
    } catch (error) {
      console.error('Error fetching saved configurations:', error);
      setLoadError(error instanceof Error ? error.message : 'Failed to fetch saved configurations');
    } finally {
      setIsLoadingSavedConfigs(false);
    }
  };

  // Function to load a saved configuration into the form
  const loadSavedConfig = (config: any) => {
    // Set basic fields
    setUrl(config.url || "");
    setLoadedConfigName(config.name || null);

    // Set scan parameters from config
    setDepth(config.config.depth ?? 0);
    setConcurrency(config.config.concurrency ?? 10);
    setRequestTimeout((config.config.requestTimeout ?? 30000) / 1000); // Convert from ms to seconds
    setScanSameLinkOnce(config.config.scanSameLinkOnce !== false);
    setSkipExternalDomains(config.config.skipExternalDomains !== false);
    setExcludeSubdomains(config.config.excludeSubdomains !== false);

    // Set exclusion patterns
    setRegexExclusions(
      config.config.regexExclusions?.length ?
        config.config.regexExclusions : [""]
    );

    setCssSelectors(
      config.config.cssSelectors?.length ?
        config.config.cssSelectors : [""]
    );

    setCssSelectorsForceExclude(!!config.config.cssSelectorsForceExclude);

    setWildcardExclusions(
      config.config.wildcardExclusions?.length ?
        config.config.wildcardExclusions : [""]
    );

    // Set auth if available
    if (config.config.auth) {
      setUsername(config.config.auth.username || '');
      setPassword(config.config.auth.password || '');
      setAuthEnabled(true);
      setUseAuthForAllDomains(config.config.useAuthForAllDomains || false);
    } else {
      setUsername('');
      setPassword('');
      setAuthEnabled(false);
      setUseAuthForAllDomains(true);
    }

    // Show advanced options if any advanced options are set
    if (
      (config.config.regexExclusions && config.config.regexExclusions.length > 0) ||
      (config.config.cssSelectors && config.config.cssSelectors.length > 0) ||
      (config.config.wildcardExclusions && config.config.wildcardExclusions.length > 0)
    ) {
      setShowAdvanced(true);
    }

    // Set an initial name for saving
    if (!configName && config.name) {
      setConfigName(`${config.name} (Copy)`);
    }

    // Clear any errors
    setScanError(null);
  };

  const handleScan = async () => {
    // Basic URL validation
    if (!url || !url.startsWith('http')) {
      alert("Please enter a valid URL (starting with http or https).");
      return;
    }

    setIsCreatingScan(true);
    setScanError(null);

    try {
      // Filter out empty entries
      const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
      const filteredWildcardExclusions = wildcardExclusions.filter(pattern => pattern.trim() !== "");
      const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");

      const config: {
        depth: number;
        scanSameLinkOnce: boolean;
        concurrency: number;
        itemsPerPage: number;
        regexExclusions: string[];
        cssSelectors: string[];
        cssSelectorsForceExclude: boolean;
        wildcardExclusions: string[];
        requestTimeout: number;
        skipExternalDomains: boolean;
        excludeSubdomains: boolean;
        auth?: { username: string; password: string };
        useAuthForAllDomains?: boolean;
      } = {
        depth: depth,
        scanSameLinkOnce: scanSameLinkOnce,
        concurrency: concurrency,
        itemsPerPage: 10,
        regexExclusions: filteredRegexExclusions,
        cssSelectors: filteredCssSelectors,
        cssSelectorsForceExclude: cssSelectorsForceExclude,
        wildcardExclusions: filteredWildcardExclusions,
        requestTimeout: requestTimeout * 1000, // Convert to milliseconds
        skipExternalDomains: skipExternalDomains,
        excludeSubdomains: excludeSubdomains,
      };

      // Add auth credentials if enabled
      if (authEnabled && username && password) {
        config.auth = {
          username,
          password
        };
        config.useAuthForAllDomains = useAuthForAllDomains;
      }

      // Create a new temporary scan ID for this scan
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 10);
      const newScanId = `temp_${timestamp}_${randomId}`;

      // Save the config to a new endpoint that will create a mapping
      const response = await fetch('/api/save-scan-params', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: newScanId,
          url: url,
          config: config
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create scan configuration');
      }

      const result = await response.json();

      // Navigate to the scan page with only the ID parameter
      router.push(`/scan?id=${result.id || newScanId}`);
    } catch (error) {
      console.error('Error creating scan:', error);
      setScanError(error instanceof Error ? error.message : 'An error occurred while creating the scan');
      setIsCreatingScan(false);
    }
  };

  // Save scan configuration
  const saveConfiguration = async () => {
    // Validate configuration name
    if (!configName.trim()) {
      setSaveError('Please provide a name for this scan');
      return;
    }

    // Validate URL
    if (!url) {
      setSaveError('Please provide a URL');
      return;
    }

    try {
      // Try to parse URL to ensure it's valid
      const urlObj = new URL(url);

      // Must be http or https
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        setSaveError('URL must use HTTP or HTTPS protocol');
        return;
      }
    } catch (e) {
      setSaveError('Please provide a valid URL (e.g., https://example.com)');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Filter out empty entries
      const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
      const filteredWildcardExclusions = wildcardExclusions.filter(pattern => pattern.trim() !== "");
      const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");

      // Create config object with proper typing
      const config: {
        depth: number;
        scanSameLinkOnce: boolean;
        concurrency: number;
        itemsPerPage: number;
        regexExclusions: string[];
        cssSelectors: string[];
        cssSelectorsForceExclude: boolean;
        wildcardExclusions: string[];
        requestTimeout: number;
        skipExternalDomains: boolean;
        excludeSubdomains: boolean;
        auth?: { username: string; password: string };
        useAuthForAllDomains?: boolean;
      } = {
        depth: depth,
        scanSameLinkOnce: scanSameLinkOnce,
        concurrency: concurrency,
        itemsPerPage: 10,
        regexExclusions: filteredRegexExclusions,
        cssSelectors: filteredCssSelectors,
        cssSelectorsForceExclude: cssSelectorsForceExclude,
        wildcardExclusions: filteredWildcardExclusions,
        requestTimeout: requestTimeout * 1000, // Convert to milliseconds
        skipExternalDomains: skipExternalDomains,
        excludeSubdomains: excludeSubdomains,
      };

      // Always include auth credentials if they exist
      if (authEnabled && username && password) {
        config.auth = {
          username,
          password
        };
        config.useAuthForAllDomains = useAuthForAllDomains;
      }

      // Send to API
      const response = await fetch('/api/saved-configs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: configName,
          url: url,
          config: config
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save scan configuration');
      }

      setSaveSuccess(true);
      setConfigName('');

      // Close dialog after a short delay
      setTimeout(() => {
        setShowSaveDialog(false);
        setSaveSuccess(false);
      }, 1500);
    } catch (error) {
      console.error('Error saving scan configuration:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to save scan configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleAuthDialog = () => {
    setShowAuthDialog(!showAuthDialog);
  };

  // Toggle save configuration dialog
  const toggleSaveDialog = () => {
    setShowSaveDialog(!showSaveDialog);
    setSaveError(null);
    setSaveSuccess(false);

    if (!showSaveDialog) {
      // Set initial config name based on loaded scan or URL domain
      if (loadedConfigName && !configName) {
        setConfigName(`${loadedConfigName} (Copy)`);
      } else if (!configName && url) {
        // Generate a default name based on URL domain
        try {
          const urlObj = new URL(url);
          setConfigName(`Scan for ${urlObj.hostname}`);
        } catch (e) {
          setConfigName('New Scan');
        }
      }
    }
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

  const addWildcardExclusion = () => setWildcardExclusions([...wildcardExclusions, ""]);

  const removeWildcardExclusion = (index: number) => {
    const newExclusions = [...wildcardExclusions];
    newExclusions.splice(index, 1);
    setWildcardExclusions(newExclusions);
  };

  const updateWildcardExclusion = (index: number, value: string) => {
    const newExclusions = [...wildcardExclusions];
    newExclusions[index] = value;
    setWildcardExclusions(newExclusions);
  };

  // Add a function to reset the form
  const resetLoadedScan = () => {
    setUrl("");
    setDepth(0);
    setConcurrency(10);
    setRequestTimeout(30);
    setScanSameLinkOnce(true);
    setSkipExternalDomains(true);
    setExcludeSubdomains(true);
    setRegexExclusions([""]);
    setCssSelectors([""]);
    setCssSelectorsForceExclude(false);
    setWildcardExclusions([""]);
    setUsername("");
    setPassword("");
    setAuthEnabled(false);
    setUseAuthForAllDomains(true);
    setLoadedConfigName(null);
    setConfigName("");
    setShowAdvanced(false);
    setScanError(null);
  };

  // Add copy to clipboard function
  const copyJsonToClipboard = (json: any) => {
    const stringified = JSON.stringify(json, null, 2);
    navigator.clipboard.writeText(stringified);
  };

  // Add a function to validate and parse JSON
  const validateJsonConfig = (jsonContent: string): any => {
    try {
      // Trim whitespace
      const cleanedJson = jsonContent.trim();

      // Try to parse the JSON
      const parsedJson = JSON.parse(cleanedJson);

      // Handle various formats
      if (typeof parsedJson !== 'object' || parsedJson === null) {
        throw new Error('Invalid configuration: JSON must be an object');
      }

      // Handle nested config structure
      if (parsedJson.config && parsedJson.url) {
        // Validate URL
        try {
          new URL(parsedJson.url);
        } catch (e) {
          throw new Error('Invalid URL format in configuration');
        }

        // This is the preferred format from Copy All
        return parsedJson;
      }
      // Handle flat structure with URL at top level
      else if (parsedJson.url) {
        // Validate URL
        try {
          new URL(parsedJson.url);
        } catch (e) {
          throw new Error('Invalid URL format in configuration');
        }

        return parsedJson;
      }
      // Missing URL
      else {
        throw new Error('Invalid configuration: URL is required');
      }
    } catch (e) {
      // Handle parsing errors
      if (e instanceof SyntaxError) {
        throw new Error(`Invalid JSON syntax: ${e.message}`);
      }

      // Re-throw other errors
      throw e;
    }
  };

  const [showImportDialog, setShowImportDialog] = useState<boolean>(false);
  const [importConfig, setImportConfig] = useState<any>(null);
  const [importJsonContent, setImportJsonContent] = useState<string>("{}");
  const [importJsonError, setImportJsonError] = useState<string | null>(null);

  const toggleImportDialog = () => {
    setShowImportDialog(!showImportDialog);
    // Initialize with empty object when opening the dialog
    if (!showImportDialog) {
      const emptyConfig = {};
      setImportConfig(emptyConfig);
      setImportJsonContent(JSON.stringify(emptyConfig, null, 2));
      setImportJsonError(null);
    }
  };

  const handleImportJsonChange = (content: string) => {
    setImportJsonContent(content);
    setImportJsonError(null);
  };

  const handleSubmitImport = () => {
    try {
      const parsedJson = validateJsonConfig(importJsonContent);
      handleImportConfig(parsedJson);
    } catch (error) {
      console.error('Error importing configuration:', error);
      setImportJsonError(error instanceof Error ? error.message : 'Invalid configuration format');
    }
  };

  const handleImportConfig = (importedData: any) => {
    try {
      // Check if we have a nested structure with a config property
      const hasNestedConfig = importedData.config && typeof importedData.config === 'object';
      const configData = hasNestedConfig ? importedData.config : importedData;

      // Update all the form fields with the imported data
      setUrl(importedData.url || '');
      setDepth(configData.depth ?? 1);
      setConcurrency(configData.concurrency ?? 10);

      // Handle request timeout - might be in seconds or milliseconds
      const timeout = configData.requestTimeout ?? 30000;
      setRequestTimeout(timeout > 1000 ? timeout / 1000 : timeout); // Convert to seconds if in milliseconds

      setScanSameLinkOnce(configData.scanSameLinkOnce ?? true);
      setSkipExternalDomains(configData.skipExternalDomains !== false);
      setExcludeSubdomains(configData.excludeSubdomains !== false);

      if (configData.auth) {
        setUsername(configData.auth.username || '');
        setPassword(configData.auth.password || '');
        setAuthEnabled(true);
        setUseAuthForAllDomains(configData.useAuthForAllDomains ?? true);
      } else {
        setAuthEnabled(false);
        setUsername('');
        setPassword('');
      }

      // Set exclusion patterns if they exist
      if (configData.regexExclusions && Array.isArray(configData.regexExclusions)) {
        setRegexExclusions(configData.regexExclusions.length > 0
          ? configData.regexExclusions
          : [""]
        );
      }

      if (configData.cssSelectors && Array.isArray(configData.cssSelectors)) {
        setCssSelectors(configData.cssSelectors.length > 0
          ? configData.cssSelectors
          : [""]
        );
      }

      setCssSelectorsForceExclude(!!configData.cssSelectorsForceExclude);

      if (configData.wildcardExclusions && Array.isArray(configData.wildcardExclusions)) {
        setWildcardExclusions(configData.wildcardExclusions.length > 0
          ? configData.wildcardExclusions
          : [""]
        );
      }

      // Set config name if available
      if (importedData.name) {
        setConfigName(importedData.name);
      }

      // Close the import dialog
      setShowImportDialog(false);

      // Set a state to show a notification that the config was imported
      setHasImported(true);
      setTimeout(() => setHasImported(false), 5000); // Hide notification after 5 seconds
    } catch (error) {
      console.error('Error importing configuration:', error);
      setImportJsonError(error instanceof Error ? error.message : 'Invalid configuration format');
    }
  };

  // Add hasImported state
  const [hasImported, setHasImported] = useState<boolean>(false);

  // Add states for the other help popups
  const [showUrlExclusionHelp, setShowUrlExclusionHelp] = useState<boolean>(false);
  const [showCssSelectorsHelp, setShowCssSelectorsHelp] = useState<boolean>(false);
  const [showRegexExclusionHelp, setShowRegexExclusionHelp] = useState<boolean>(false);
  const [showWildcardHelp, setShowWildcardHelp] = useState<boolean>(false);

  const urlExclusionHelpRef = useRef<HTMLDivElement>(null);
  const cssSelectorsHelpRef = useRef<HTMLDivElement>(null);
  const regexExclusionHelpRef = useRef<HTMLDivElement>(null);
  const wildcardHelpRef = useRef<HTMLDivElement>(null);

  // Add click outside handlers for all popups
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (urlExclusionHelpRef.current && !urlExclusionHelpRef.current.contains(event.target as Node)) {
        setShowUrlExclusionHelp(false);
      }

      if (cssSelectorsHelpRef.current && !cssSelectorsHelpRef.current.contains(event.target as Node)) {
        setShowCssSelectorsHelp(false);
      }

      if (regexExclusionHelpRef.current && !regexExclusionHelpRef.current.contains(event.target as Node)) {
        setShowRegexExclusionHelp(false);
      }

      if (wildcardHelpRef.current && !wildcardHelpRef.current.contains(event.target as Node)) {
        setShowWildcardHelp(false);
      }
    };

    if (showUrlExclusionHelp || showCssSelectorsHelp || showRegexExclusionHelp || showWildcardHelp) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUrlExclusionHelp, showCssSelectorsHelp, showRegexExclusionHelp, showWildcardHelp]);

  return (
    <div className="w-100 py-5 fade-in-up">
      <div className="d-sm-flex align-items-center justify-content-between mb-4">
        <h1 className="h3 mb-0 fw-bold text-dark dark:text-light">Initiate Link Analysis</h1>
        <div className="mt-2 mt-sm-0 d-flex gap-2">
          <button className="btn btn-outline-primary btn-sm rounded-pill" onClick={toggleImportDialog}>
            <FileCode size={14} className="me-1" /> Import JSON
          </button>
        </div>
      </div>

      <AnimatedCard className="border-0 shadow-lg mb-5 overflow-visible">
        <div className="card-header bg-transparent border-0 pt-4 px-4 pb-0">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            <div>
              <h2 className="h5 fw-bold mb-1">New Audit Configuration</h2>
              <p className="text-muted small mb-0">Define your target and adjust inspection depth.</p>
            </div>

            <div className="d-flex align-items-center gap-2">
              <div className="dropdown">
                <button
                  className="btn btn-outline-secondary dropdown-toggle d-flex align-items-center gap-2"
                  type="button"
                  data-bs-toggle="dropdown"
                  disabled={isLoadingSavedConfigs || savedConfigs.length === 0}
                >
                  {isLoadingSavedConfigs ? (
                    <><span className="spinner-border spinner-border-sm" /> Loading...</>
                  ) : (
                    <><FileUp size={16} /> Load Preset</>
                  )}
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-3">
                  <li className="dropdown-header">Saved Configurations</li>
                  <li><hr className="dropdown-divider" /></li>
                  {savedConfigs.length === 0 ? (
                    <li className="px-3 py-2 text-muted small">No presets found</li>
                  ) : (
                    savedConfigs.map((config) => (
                      <li key={config.id}>
                        <button className="dropdown-item py-2" onClick={() => loadSavedConfig(config)}>
                          <div className="fw-bold small">{config.name}</div>
                          <div className="x-small text-muted text-truncate" style={{ maxWidth: '200px' }}>{config.url}</div>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="card-body p-4">
          {/* Notifications */}
          {hasImported && (
            <div className="alert alert-success border-0 bg-success bg-opacity-10 d-flex align-items-center mb-4 fade-in">
              <CheckCircle2 className="me-2 text-success" size={18} />
              <div className="flex-grow-1 small text-success-emphasis">Configuration imported successfully.</div>
              <button className="btn-close btn-sm" onClick={() => setHasImported(false)}></button>
            </div>
          )}

          {loadedConfigName && (
            <div className="alert alert-info border-0 bg-info bg-opacity-10 d-flex align-items-center mb-4 fade-in">
              <Activity className="me-2 text-info" size={18} />
              <div className="flex-grow-1 small text-info-emphasis">
                Loaded preset: <span className="fw-bold">{loadedConfigName}</span>
              </div>
              <button className="btn btn-sm btn-link text-info p-0 text-decoration-none fw-bold me-2" onClick={resetLoadedScan}>Reset</button>
              <button className="btn-close btn-sm" onClick={() => setLoadedConfigName(null)}></button>
            </div>
          )}

          <div className="mb-4">
            <label className="form-label fw-bold small text-uppercase tracking-wider">Target Resource</label>
            <div className="input-group mb-2">
              <span className="input-group-text bg-light border-end-0">
                <Globe size={18} className="text-muted" />
              </span>
              <input
                type="url"
                className="form-control bg-light border-start-0 ps-0"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-enterprise-app.com"
                required
              />
              <button
                className={`btn ${authEnabled ? 'btn-success' : 'btn-outline-secondary'}`}
                onClick={toggleAuthDialog}
                title="Authentication Settings"
              >
                <Key size={18} />
              </button>
            </div>
            {authEnabled && (
              <div className="text-success x-small fw-semibold mt-1 d-flex align-items-center">
                <Check size={12} className="me-1" /> Authentication layer active
              </div>
            )}
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <label className="form-label fw-semibold small">Scan Depth</label>
              <input
                type="number"
                className="form-control"
                min="0"
                max="5"
                value={depth}
                onChange={(e) => setDepth(parseInt(e.target.value) || 0)}
              />
              <div className="form-text x-small">0 = Landing Page, 1+ = Full Audit</div>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold small">Concurrency</label>
              <input
                type="number"
                className="form-control"
                min="1"
                max="50"
                value={concurrency}
                onChange={(e) => setConcurrency(parseInt(e.target.value) || 10)}
              />
              <div className="form-text x-small">Parallel requests (Default: 10)</div>
            </div>

            <div className="col-md-4">
              <label className="form-label fw-semibold small">Timeout (s)</label>
              <input
                type="number"
                className="form-control"
                min="5"
                max="180"
                value={requestTimeout}
                onChange={(e) => setRequestTimeout(parseInt(e.target.value) || 30)}
              />
              <div className="form-text x-small">Seconds before aborting URL</div>
            </div>
          </div>

          <div className="mb-4 bg-light dark:bg-dark p-3 rounded-3 border">
            <div className="row g-2">
              <div className="col-12 col-md-4">
                <div className="form-check form-switch cursor-pointer">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="scanSameLinkOnce"
                    checked={scanSameLinkOnce}
                    onChange={(e) => setScanSameLinkOnce(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="scanSameLinkOnce">Unique Check Only</label>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="form-check form-switch cursor-pointer">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="skipExternalDomains"
                    checked={skipExternalDomains}
                    onChange={(e) => setSkipExternalDomains(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="skipExternalDomains">Skip External</label>
                </div>
              </div>
              <div className="col-12 col-md-4">
                <div className="form-check form-switch cursor-pointer">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    role="switch"
                    id="excludeSubdomains"
                    checked={excludeSubdomains}
                    onChange={(e) => setExcludeSubdomains(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="excludeSubdomains">No Subdomains</label>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-0">
            <button
              className="btn btn-link link-primary p-0 text-decoration-none fw-semibold d-flex align-items-center mb-3"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings size={18} className="me-2" />
              {showAdvanced ? 'Hide' : 'Configure'} Advanced Filtering
            </button>

            {showAdvanced && (
              <div className="p-3 bg-light dark:bg-dark border rounded-3 text-start mb-4 fade-in">
                <div className="row g-4">
                  {/* Wildcard Exclusions - FIRST */}
                  <div className="col-lg-4">
                    <div className="d-flex align-items-center mb-2 position-relative">
                      <span className="fw-bold small me-2">Wildcard Exclusions</span>
                      <div className="position-relative">
                        <HelpCircle
                          size={14}
                          className="text-muted cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowWildcardHelp(!showWildcardHelp);
                          }}
                        />
                        {showWildcardHelp && (
                          <div
                            ref={wildcardHelpRef}
                            className="position-absolute bg-white dark:bg-dark border rounded shadow-lg p-3 z-index-popover"
                            style={{ width: '280px', top: '24px', left: '0', zIndex: 1060 }}
                          >
                            <div className="fw-bold small mb-2 text-primary">Wildcard Usage</div>
                            <div className="x-small text-muted space-y-2">
                              <p>Simple pattern matching using <code>*</code> for multiple characters and <code>?</code> for one.</p>
                              <div><strong>Examples:</strong></div>
                              <ul className="ps-3 mb-0">
                                <li><code>/blog/*</code> - All blog posts</li>
                                <li><code>*.pdf</code> - All PDF files</li>
                                <li><code>domain.com/admin/*</code> - Specific domain path</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {wildcardExclusions.map((pattern, index) => (
                      <div key={`wildcard-${index}`} className="input-group mb-2">
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          value={pattern}
                          onChange={(e) => updateWildcardExclusion(index, e.target.value)}
                          placeholder="e.g. /careers/*"
                        />
                        <button className="btn btn-outline-danger btn-sm" onClick={() => removeWildcardExclusion(index)} disabled={wildcardExclusions.length <= 1}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-sm btn-outline-primary mt-1" onClick={addWildcardExclusion}>
                      <Plus size={14} className="me-1" /> Add Rule
                    </button>
                  </div>

                  {/* CSS Selectors */}
                  <div className="col-lg-4">
                    <div className="d-flex align-items-center mb-2 position-relative">
                      <span className="fw-bold small me-2">CSS Selectors to skip</span>
                      <div className="position-relative">
                        <HelpCircle
                          size={14}
                          className="text-muted cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowCssSelectorsHelp(!showCssSelectorsHelp);
                          }}
                        />
                        {showCssSelectorsHelp && (
                          <div
                            ref={cssSelectorsHelpRef}
                            className="position-absolute bg-white dark:bg-dark border rounded shadow-lg p-3 z-index-popover"
                            style={{ width: '280px', top: '24px', left: '0', zIndex: 1060 }}
                          >
                            <div className="fw-bold small mb-2 text-primary">CSS Exclusion</div>
                            <div className="x-small text-muted">
                              <p>Links inside elements matching these selectors will be ignored.</p>
                              <div><strong>Examples:</strong></div>
                              <ul className="ps-3 mb-0">
                                <li><code>.footer</code> - Ignore navigation in footer</li>
                                <li><code>#sidebar nav</code> - Ignore sidebar links</li>
                                <li><code>[aria-hidden="true"]</code> - Ignore hidden links</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {cssSelectors.map((selector, index) => (
                      <div key={`selector-${index}`} className="input-group mb-2">
                        <input
                          type="text"
                          className="form-control form-control-sm font-monospace"
                          value={selector}
                          onChange={(e) => updateCssSelector(index, e.target.value)}
                          placeholder="e.g. .footer"
                        />
                        <button className="btn btn-outline-danger btn-sm" onClick={() => removeCssSelector(index)} disabled={cssSelectors.length <= 1}>
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="btn btn-sm btn-outline-primary mt-1" onClick={addCssSelector}>
                      <Plus size={14} className="me-1" /> Add Rule
                    </button>
                  </div>

                  {/* Regex Filters - LAST */}
                  <div className="col-lg-4">
                    <div className="d-flex align-items-center mb-2 position-relative">
                      <span className="fw-bold small me-2">Regex Filter rules</span>
                      <div className="position-relative">
                        <HelpCircle
                          size={14}
                          className="text-muted cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowRegexExclusionHelp(!showRegexExclusionHelp);
                          }}
                        />
                        {showRegexExclusionHelp && (
                          <div
                            ref={regexExclusionHelpRef}
                            className="position-absolute bg-white dark:bg-dark border rounded shadow-lg p-3 z-index-popover"
                            style={{ width: '280px', top: '24px', left: 'auto', right: '0', zIndex: 1060 }}
                          >
                            <div className="fw-bold small mb-2 text-primary">Advanced Regex</div>
                            <div className="x-small text-muted">
                              <p>Full JavaScript Regular Expression matching against the entire URL.</p>
                              <div className="alert alert-warning p-2 x-small mb-2 border-0 bg-warning bg-opacity-10 text-warning-emphasis">
                                <div className="fw-bold d-flex align-items-center mb-1">
                                  <Activity size={12} className="me-1" /> Heads up!
                                </div>
                                Using <code>*</code> here means "zero or more of the previous character". For path patterns like <code>/blog/*</code>, use <strong>Wildcard Exclusions</strong> instead.
                              </div>
                              <div><strong>Regex Examples:</strong></div>
                              <ul className="ps-3 mb-0">
                                <li><code>\/page\/\d+</code> - Numeric pages</li>
                                <li><code>\.(jpg|png|gif)$</code> - Image files</li>
                                <li><code>\?.*session=</code> - URLs with session params</li>
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    {regexExclusions.map((regex, index) => (
                      <div key={`regex-${index}`} className="input-group mb-2">
                        <input
                          type="text"
                          className={`form-control form-control-sm font-monospace ${regex.includes('*') && !regex.includes('\\*') && !regex.includes('.*') ? 'is-invalid' : ''}`}
                          value={regex}
                          onChange={(e) => updateRegexExclusion(index, e.target.value)}
                          placeholder="e.g. \.pdf$"
                        />
                        <button className="btn btn-outline-danger btn-sm" onClick={() => removeRegexExclusion(index)} disabled={regexExclusions.length <= 1}>
                          <X size={14} />
                        </button>
                        {regex.includes('*') && !regex.includes('\\*') && !regex.includes('.*') && (
                          <div className="invalid-feedback x-small">
                            Likely error: Did you mean <code>.*</code> or should this be a Wildcard?
                          </div>
                        )}
                      </div>
                    ))}
                    <button className="btn btn-sm btn-outline-primary mt-1" onClick={addRegexExclusion}>
                      <Plus size={14} className="me-1" /> Add Rule
                    </button>
                  </div>
                </div>

                <div className="mt-4 border-top pt-3">
                  <JSONPreview
                    data={{
                      name: configName || `Scan for ${url ? new URL(url).hostname : "New Domain"}`,
                      url: url,
                      config: {
                        depth: depth,
                        concurrency: concurrency,
                        requestTimeout: requestTimeout * 1000,
                        scanSameLinkOnce: scanSameLinkOnce,
                        skipExternalDomains: skipExternalDomains,
                        excludeSubdomains: excludeSubdomains,
                        regexExclusions: regexExclusions.filter(r => r.trim() !== ""),
                        cssSelectors: cssSelectors.filter(s => s.trim() !== ""),
                        cssSelectorsForceExclude: cssSelectorsForceExclude,
                        wildcardExclusions: wildcardExclusions.filter(w => w.trim() !== ""),
                        ...(authEnabled && {
                          auth: { username: username, password: password },
                          useAuthForAllDomains: useAuthForAllDomains
                        })
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="card-footer bg-transparent border-0 d-flex flex-column flex-sm-row justify-content-between gap-3 p-4">
          <AnimatedButton
            variant="outline-secondary"
            onClick={toggleSaveDialog}
            disabled={!url}
          >
            <Save size={18} className="me-2" /> Archive Configuration
          </AnimatedButton>

          <AnimatedButton
            variant="primary"
            onClick={handleScan}
            disabled={isCreatingScan}
            className="px-5"
          >
            {isCreatingScan ? (
              <><span className="spinner-border spinner-border-sm me-2" /> Building...</>
            ) : (
              <><Rocket size={18} className="me-2" /> Launch Full Inspection</>
            )}
          </AnimatedButton>
        </div>

        {scanError && (
          <div className="mx-4 mb-4 alert alert-danger border-0 shadow-sm fade-in">
            <div className="d-flex align-items-center">
              <AlertCircle size={18} className="me-2 text-danger" />
              <div className="fw-bold">Configuration Error</div>
            </div>
            <div className="small mt-1 opacity-75">{scanError}</div>
          </div>
        )}
      </AnimatedCard>

      {/* Auth Modal Mockup */}
      {showAuthDialog && (
        <div className="modal show d-block bg-black bg-opacity-50" tabIndex={-1} style={{ backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Enterprise Authentication</h5>
                <button type="button" className="btn-close" onClick={() => setShowAuthDialog(false)}></button>
              </div>
              <div className="modal-body py-4">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Identity / Username</label>
                  <input
                    type="text"
                    className="form-control"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="api_key_or_user"
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small fw-bold">Credential / Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
                <div className="form-check py-2 mt-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="useAuthForAllDomains"
                    checked={useAuthForAllDomains}
                    onChange={(e) => setUseAuthForAllDomains(e.target.checked)}
                  />
                  <label className="form-check-label small" htmlFor="useAuthForAllDomains">
                    Broadcast credentials to all sub-requests
                  </label>
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 pb-4 justify-content-between">
                <button type="button" className="btn btn-link text-danger p-0 text-decoration-none small" onClick={clearAuthCredentials}>Purge Credentials</button>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light" onClick={() => setShowAuthDialog(false)}>Discard</button>
                  <button type="button" className="btn btn-primary" onClick={saveAuthCredentials}>Apply Identity</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Config Modal Mockup */}
      {showSaveDialog && (
        <div className="modal show d-block bg-black bg-opacity-50" tabIndex={-1} style={{ backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Archive Configuration</h5>
                <button type="button" className="btn-close" onClick={() => setShowSaveDialog(false)}></button>
              </div>
              <div className="modal-body py-4">
                <div className="mb-3">
                  <label className="form-label small fw-bold">Configuration Label</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Weekly Production Audit"
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                  />
                </div>
                <p className="small text-muted mb-0">This captures the URL, credentials, and all filtering rules for instant recovery.</p>

                {saveError && (
                  <div className="alert alert-danger mt-3 mb-0 small py-2">{saveError}</div>
                )}
                {saveSuccess && (
                  <div className="alert alert-success mt-3 mb-0 small py-2">Configuration archived successfully.</div>
                )}
              </div>
              <div className="modal-footer border-0 pt-0 pb-4 justify-content-center">
                <button type="button" className="btn btn-light" onClick={() => setShowSaveDialog(false)} disabled={isSaving}>Dismiss</button>
                <button
                  type="button"
                  className="btn btn-primary px-4"
                  onClick={saveConfiguration}
                  disabled={isSaving || !configName.trim() || !url}
                >
                  {isSaving ? <><span className="spinner-border spinner-border-sm me-2" /> Archiving...</> : 'Persist Data'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal Mockup */}
      {showImportDialog && (
        <div className="modal show d-block bg-black bg-opacity-50" tabIndex={-1} style={{ backdropFilter: 'blur(4px)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow-lg rounded-4">
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold">Import JSON Payload</h5>
                <button type="button" className="btn-close" onClick={() => setShowImportDialog(false)}></button>
              </div>
              <div className="modal-body py-4">
                <div className="p-3 bg-light rounded-3 mb-3 small border border-primary border-opacity-10">
                  <div className="fw-bold mb-1">Advanced Mode</div>
                  <div className="text-muted">Inject raw JSON configuration to quickly replicate specific scan environments.</div>
                </div>

                {importJsonError && (
                  <div className="alert alert-danger mb-3 small py-2">{importJsonError}</div>
                )}

                <div className="mb-0">
                  <label className="form-label small fw-bold">Raw JSON Structure</label>
                  <textarea
                    className="form-control font-monospace x-small"
                    rows={10}
                    value={importJsonContent}
                    onChange={(e) => handleImportJsonChange(e.target.value)}
                    style={{ backgroundColor: '#fdfdfd' }}
                  />
                </div>
              </div>
              <div className="modal-footer border-0 pt-0 pb-4 justify-content-end gap-2">
                <button type="button" className="btn btn-light" onClick={() => setShowImportDialog(false)}>Cancel</button>
                <button type="button" className="btn btn-primary px-4 fw-bold" onClick={handleSubmitImport}>Execute Import</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 