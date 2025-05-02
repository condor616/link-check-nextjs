'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  Save, 
  Check, 
  Plus, 
  X, 
  Clock, 
  Key, 
  Link as LinkIcon,
  History,
  Settings
} from 'lucide-react';
import Link from 'next/link';

// Define the structure for results returned by the API (matching API response)
interface ApiScanResponse {
    message: string;
    durationSeconds: number;
    resultsCount: number;
    results: ScanResult[]; // Assuming results are serialized as array
}

export default function HomePage() {
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

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ApiScanResponse | null>(null);
  
  // Save states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleScan = async () => {
    setIsLoading(true);
    setError(null);
    setScanResponse(null);
    // Reset save states when starting a new scan
    setSaveSuccess(false);
    setSaveError(null);

    // Basic URL validation (optional, API does it too)
    if (!url || !url.startsWith('http')) {
      setError("Please enter a valid URL (starting with http or https).");
      setIsLoading(false);
      return;
    }

    // Filter out empty entries
    const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
    const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");

    const config: ScanConfig = {
      depth: depth,
      scanSameLinkOnce: true,
      concurrency: concurrency,
      itemsPerPage: 10,
      regexExclusions: filteredRegexExclusions,
      cssSelectors: filteredCssSelectors,
      requestTimeout: requestTimeout * 1000, // Convert to milliseconds
    };

    // Add auth credentials if enabled
    const requestBody: any = { url, config };
    if (authEnabled && username && password) {
      requestBody.auth = {
        username,
        password
      };
      // Add useAuthForAllDomains flag if auth is enabled
      requestBody.config.useAuthForAllDomains = useAuthForAllDomains;
    }

    try {
      // Add timeout to the main API fetch request as well
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minute timeout for the API call itself
      
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Check for response status first
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || `HTTP error: ${response.status} ${response.statusText}`;
        } catch {
          // If not JSON, use the raw text
          errorMessage = errorText || `HTTP error: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      setScanResponse(data as ApiScanResponse);

    } catch (err: unknown) {
      console.error("Scan API call failed:", err);
      
      // Handle different types of errors
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setError(
          "Network error: Could not connect to the server. Please check your internet connection and try again."
        );
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        setError(
          "The scan request timed out after 5 minutes. The server might be busy or the website might be too large to scan quickly. Try scanning a smaller section or increasing the timeout."
        );
      } else {
        setError(
          err instanceof Error 
            ? err.message 
            : "An unexpected error occurred."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handler to save scan to history
  const handleSaveScan = async () => {
    if (!scanResponse) return;
    
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      // Filter out empty entries
      const filteredRegexExclusions = regexExclusions.filter(regex => regex.trim() !== "");
      const filteredCssSelectors = cssSelectors.filter(selector => selector.trim() !== "");
      
      // Prepare the payload for saving
      const savePayload = {
        scanUrl: url,
        scanDate: new Date().toISOString(),
        durationSeconds: scanResponse.durationSeconds,
        config: {
          depth,
          scanSameLinkOnce: true,
          concurrency,
          itemsPerPage: 10, // Add default itemsPerPage
          regexExclusions: filteredRegexExclusions,
          cssSelectors: filteredCssSelectors,
          requestTimeout: requestTimeout * 1000, // Convert to milliseconds
        },
        results: scanResponse.results,
      };
      
      // Add timeout to the save fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch('/api/save-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check for response status first
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          // Try to parse as JSON
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || `Failed to save scan (${response.status})`;
        } catch {
          // If not JSON, use the raw text
          errorMessage = errorText || `Failed to save scan (${response.status})`;
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      
      setSaveSuccess(true);
      console.log('Scan saved successfully:', data.scanId);
      
    } catch (err: unknown) {
      console.error('Failed to save scan:', err);
      
      // Handle different types of errors
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        setSaveError(
          "Network error: Could not connect to the server. Please check your internet connection and try again."
        );
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        setSaveError(
          "The save request timed out. The server might be busy or the scan data might be too large."
        );
      } else {
        setSaveError(
          err instanceof Error 
            ? err.message 
            : 'Failed to save scan to history'
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Filter results for display (e.g., only broken links)
  const brokenLinks = scanResponse?.results?.filter(r => r.status === 'broken' || r.status === 'error');

  // Handlers for advanced options
  const addRegexExclusion = () => setRegexExclusions([...regexExclusions, ""]);
  const removeRegexExclusion = (index: number) => {
    if (regexExclusions.length <= 1) return; // Always keep at least one input
    setRegexExclusions(regexExclusions.filter((_, i) => i !== index));
  };
  
  const updateRegexExclusion = (index: number, value: string) => {
    const updated = [...regexExclusions];
    updated[index] = value;
    setRegexExclusions(updated);
  };
  
  const addCssSelector = () => setCssSelectors([...cssSelectors, ""]);
  const removeCssSelector = (index: number) => {
    if (cssSelectors.length <= 1) return; // Always keep at least one input
    setCssSelectors(cssSelectors.filter((_, i) => i !== index));
  };
  
  const updateCssSelector = (index: number, value: string) => {
    const updated = [...cssSelectors];
    updated[index] = value;
    setCssSelectors(updated);
  };

  // Auth dialog functions
  const toggleAuthDialog = () => {
    setShowAuthDialog(!showAuthDialog);
  };
  
  const saveAuthCredentials = () => {
    if (username.trim() || password.trim()) {
      setAuthEnabled(true);
    } else {
      setAuthEnabled(false);
    }
    setShowAuthDialog(false);
  };
  
  const clearAuthCredentials = () => {
    setUsername("");
    setPassword("");
    setAuthEnabled(false);
    setShowAuthDialog(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Link Checker</h1>
        <div className="flex space-x-2">
          <Link href="/history">
            <Button variant="outline" className="flex items-center gap-2">
              <History size={18} />
              <span>View History</span>
            </Button>
          </Link>
        </div>
      </div>
      
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
            variant="purple"
            size="lg"
            onClick={handleScan}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin mr-2" />
                Scanning...
              </>
            ) : (
              <>
                <AlertCircle className="mr-2" />
                Start Scan
              </>
            )}
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
              <Button variant="purple" onClick={saveAuthCredentials}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Display scan error if any */}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Display scan results if available */}
      {scanResponse && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Scan Results</CardTitle>
            <CardDescription>
              Scanned {url} in {scanResponse.durationSeconds.toFixed(2)} seconds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Alert variant={brokenLinks && brokenLinks.length > 0 ? "destructive" : "default"} className={brokenLinks && brokenLinks.length > 0 ? "" : "border-green-500 bg-green-50"}>
                {brokenLinks && brokenLinks.length > 0 ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <AlertTitle>
                  {brokenLinks && brokenLinks.length > 0 ? "Issues Found" : "All Links Working"}
                </AlertTitle>
                <AlertDescription>
                  Found {scanResponse.resultsCount} total URLs.
                  {brokenLinks && (
                    <span className={brokenLinks.length > 0 ? "font-semibold block mt-1" : "text-green-600 font-semibold block mt-1"}>
                      {brokenLinks.length} broken or problematic links identified.
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            </div>
            
            {/* Display broken links if found */}
            {brokenLinks && brokenLinks.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-semibold text-lg flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
                  Broken Links
                </h3>
                
                <div className="max-h-80 overflow-y-auto border rounded-lg">
                  {brokenLinks.map((link, index) => {
                    const foundOnPages = Array.isArray(link.foundOn) ? link.foundOn : Array.from(link.foundOn || []);
                    
                    return (
                      <div 
                        key={link.url} 
                        className={`p-3 text-sm ${index !== brokenLinks.length - 1 ? 'border-b' : ''}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-start gap-2 mb-1">
                              {link.statusCode ? (
                                <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                                  {link.statusCode}
                                </span>
                              ) : (
                                <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded font-mono">
                                  ERROR
                                </span>
                              )}
                              <code className="text-red-600 font-medium break-all">{link.url}</code>
                            </div>
                            
                            {link.errorMessage && (
                              <p className="text-sm text-red-500 mt-1 mb-2">
                                {link.errorMessage}
                              </p>
                            )}
                          </div>
                          
                          <button 
                            onClick={() => navigator.clipboard.writeText(link.url)}
                            className="text-muted-foreground hover:text-foreground"
                            title="Copy URL"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                          </button>
                        </div>
                        
                        {foundOnPages.length > 0 && (
                          <div className="mt-2 bg-gray-50 p-2 rounded text-sm">
                            <p className="text-xs text-gray-500 mb-1">Found on:</p>
                            <ul className="pl-5 space-y-1">
                              {foundOnPages.map((page, i) => (
                                <li key={i} className="list-disc text-xs">
                                  {page === 'initial' ? (
                                    <span>Initial scan page</span>
                                  ) : (
                                    <a 
                                      href={page} 
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline"
                                    >
                                      {page}
                                    </a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={handleSaveScan}
              disabled={isSaving || saveSuccess}
            >
              {isSaving ? (
                <>
                  <Loader2 className="animate-spin mr-2" />
                  Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="mr-2" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="mr-2" />
                  Save to History
                </>
              )}
            </Button>
            
            <Link href="/history">
              <Button variant="ghost">
                <History className="mr-2" size={16} />
                View All History
              </Button>
            </Link>
          </CardFooter>
        </Card>
      )}
      
      {saveError && (
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Save Error</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
