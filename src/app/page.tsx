'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { AlertCircle, CheckCircle2, Loader2, Save, Check, Plus, X, Clock, Key } from 'lucide-react';
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
  const [requestTimeout, setRequestTimeout] = useState<number>(30); // Increase default from 10 to 30 seconds
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // New states for basic auth
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [authEnabled, setAuthEnabled] = useState<boolean>(false);
  const [useAuthForAllDomains, setUseAuthForAllDomains] = useState<boolean>(true);
  
  // New states for regex and CSS selector exclusions
  const [regexExclusions, setRegexExclusions] = useState<string[]>([""]);
  const [cssSelectors, setCssSelectors] = useState<string[]>([""]);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ApiScanResponse | null>(null);
  
  // New states for save functionality
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
      const timeoutId = setTimeout(() => controller.abort(), 5 * 60 * 1000); // 5 minute timeout for the API call itself (up from 60 seconds)
      
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
  
  // NEW: Handler to save scan to history
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

  // Handlers for adding/removing regex and CSS selector inputs
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

  // NEW: Function to toggle auth dialog
  const toggleAuthDialog = () => {
    setShowAuthDialog(!showAuthDialog);
  };
  
  // NEW: Function to save auth credentials
  const saveAuthCredentials = () => {
    if (username.trim() || password.trim()) {
      setAuthEnabled(true);
    } else {
      setAuthEnabled(false);
    }
    setShowAuthDialog(false);
  };
  
  // NEW: Function to clear auth credentials
  const clearAuthCredentials = () => {
    setUsername("");
    setPassword("");
    setAuthEnabled(false);
    setShowAuthDialog(false);
  };

  return (
    <main className="container mx-auto flex flex-col items-center p-4 md:p-8 min-h-screen">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl">Website Link Checker</CardTitle>
              <CardDescription>Enter a URL to scan for broken links.</CardDescription>
            </div>
            
            {/* Add history link */}
            <Link href="/history">
              <Button variant="outline" size="sm">
                View History
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* URL Input */}
          <div className="space-y-2">
            <Label htmlFor="url">Website URL</Label>
            <div className="flex gap-2">
              <Input
                id="url"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                className="flex-1"
              />
              <Button 
                variant={authEnabled ? "secondary" : "outline"} 
                size="icon" 
                onClick={toggleAuthDialog}
                title="HTTP Basic Authentication"
                disabled={isLoading}
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

          {/* Basic Configuration */}
          <div className="space-y-4">
             <h3 className="text-lg font-medium">Configuration</h3>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="depth">Scan Depth (0 for unlimited)</Label>
                  <Input
                    id="depth"
                    type="number"
                    min="0"
                    value={depth}
                    onChange={(e) => setDepth(parseInt(e.target.value, 10) || 0)}
                    disabled={isLoading}
                  />
                </div>
             </div>
             {/* Button to toggle advanced options */}
             <Button variant="link" className="p-0 h-auto" onClick={() => setShowAdvanced(!showAdvanced)} disabled={isLoading}>
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
             </Button>
          </div>

          {/* Auth Dialog */}
          {showAuthDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-background rounded-lg p-6 w-full max-w-md">
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
                      Use auth for all domains (may improve performance)
                    </Label>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Performance tip: Using auth for all domains reduces connection setup time. 
                    Only disable if external sites don't accept the credentials.
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" onClick={clearAuthCredentials}>
                    Clear
                  </Button>
                  <Button variant="ghost" onClick={() => setShowAuthDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={saveAuthCredentials}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Configuration (Conditionally Rendered) */}
          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded bg-card-foreground/5">
                <h3 className="text-lg font-medium">Advanced Configuration</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="concurrency">Concurrency (Max simultaneous requests)</Label>
                      <Input
                          id="concurrency"
                          type="number"
                          min="1"
                          max="50" // Set a reasonable max
                          value={concurrency}
                          onChange={(e) => setConcurrency(parseInt(e.target.value, 10) || 1)}
                          disabled={isLoading}
                      />
                  </div>
                  <div className="space-y-2">
                      <Label htmlFor="requestTimeout">Request Timeout (seconds)</Label>
                      <Input
                          id="requestTimeout"
                          type="number"
                          min="5"
                          max="180" // Allow up to 3 minutes per request (up from 60 seconds)
                          value={requestTimeout}
                          onChange={(e) => setRequestTimeout(parseInt(e.target.value, 10) || 30)}
                          disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Time before giving up on a single URL request (5-180 seconds)</p>
                  </div>
                </div>
                
                {/* Regex Exclusion Rules */}
                <div className="space-y-2 mt-4">
                  <Label htmlFor="regexExclusions">Regex Exclusion Patterns</Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Links matching these patterns will be skipped during scanning
                  </p>
                  
                  {regexExclusions.map((regex, index) => (
                    <div key={`regex-${index}`} className="flex gap-2 items-center mb-2">
                      <Input
                        value={regex}
                        onChange={(e) => updateRegexExclusion(index, e.target.value)}
                        placeholder="e.g. \/assets\/.*\.pdf$"
                        disabled={isLoading}
                      />
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeRegexExclusion(index)}
                        disabled={isLoading || regexExclusions.length <= 1}
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
                    disabled={isLoading}
                    className="mt-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Pattern
                  </Button>
                </div>
                
                {/* CSS Selector Exclusions */}
                <div className="space-y-2 mt-4">
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
                        disabled={isLoading}
                      />
                      
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCssSelector(index)}
                        disabled={isLoading || cssSelectors.length <= 1}
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
                    disabled={isLoading}
                    className="mt-1"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Selector
                  </Button>
                </div>
            </div>
          )}

        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-4">
          {/* Scan Button */}
          <Button onClick={handleScan} disabled={isLoading} size="lg">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Scanning...' : 'Start Scan'}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Summary */} 
          {scanResponse && !error && (
            <>
              <Alert variant="default">
                  {brokenLinks && brokenLinks.length > 0 ? <AlertCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  <AlertTitle>Scan Complete</AlertTitle>
                  <AlertDescription>
                      Finished in {scanResponse.durationSeconds.toFixed(2)} seconds. Found {scanResponse.resultsCount} total URLs.
                      <br />
                      <span className={brokenLinks && brokenLinks.length > 0 ? 'text-destructive font-semibold' : 'text-green-500 font-semibold'}>
                          {brokenLinks ? brokenLinks.length : 0} broken or problematic links identified.
                      </span>
                  </AlertDescription>
              </Alert>
              
              {/* NEW: Save to History Button */}
              <div className="flex items-center gap-2 justify-end">
                {saveSuccess ? (
                  <Alert variant="default" className="border-green-500 bg-green-500/10">
                    <Check className="h-4 w-4 text-green-500" />
                    <AlertTitle>Saved</AlertTitle>
                    <AlertDescription>
                      Scan saved to history.
                      <Button variant="link" className="p-0 h-auto ml-2" asChild>
                        <Link href="/history">View All</Link>
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Button 
                    onClick={handleSaveScan} 
                    disabled={isSaving} 
                    variant="outline"
                    className="ml-auto"
                  >
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSaving ? 'Saving...' : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save to History
                      </>
                    )}
                  </Button>
                )}
              </div>
              
              {/* Save Error Display */}
              {saveError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Save Error</AlertTitle>
                  <AlertDescription>{saveError}</AlertDescription>
                </Alert>
              )}
            </>
           )}

           {/* Show list of broken links with enhanced details */} 
           {brokenLinks && brokenLinks.length > 0 && (
            <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive mr-1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    Broken / Error Links ({brokenLinks.length}):
                </h4>
                <div className="max-h-96 overflow-y-auto border rounded-md">
                    {brokenLinks.map((link, index) => {
                        // Convert foundOn from Set to Array
                        const foundOnPages = Array.from(link.foundOn || []);
                        // Extract domain for display
                        const urlDomain = (() => {
                            try {
                                return new URL(link.url).hostname;
                            } catch {
                                return link.url;
                            }
                        })();
                        
                        return (
                            <div 
                                key={link.url} 
                                className={`p-3 text-sm ${index !== brokenLinks.length - 1 ? 'border-b' : ''}`}
                            >
                                <div className="flex justify-between items-start gap-2 mb-1.5">
                                    <div className="flex items-start gap-1.5">
                                        {link.statusCode ? (
                                            <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5">
                                                {link.statusCode}
                                            </span>
                                        ) : (
                                            <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5">
                                                ERR
                                            </span>
                                        )}
                                        <code className="text-destructive font-medium break-all">
                                            {urlDomain}{link.url.replace(/^https?:\/\/[^\/]+/, '')}
                                        </code>
                                    </div>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(link.url)}
                                        className="text-muted-foreground hover:text-foreground shrink-0"
                                        title="Copy URL"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                                    </button>
                                </div>
                                
                                {link.errorMessage && (
                                    <div className="text-muted-foreground mb-2">
                                        <span className="inline-flex items-center bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs">
                                            {link.errorMessage}
                                        </span>
                                    </div>
                                )}
                                
                                {foundOnPages.length > 0 && (
                                    <div className="mt-2 bg-muted/40 p-2 rounded-sm">
                                        <p className="text-xs text-muted-foreground mb-1.5 flex items-center">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                                            Found on:
                                        </p>
                                        <ul className="space-y-1.5 pl-4 text-xs">
                                            {foundOnPages.map((page, i) => {
                                                // Format found-on page display
                                                let displayText = page;
                                                try {
                                                    if (page !== 'initial') {
                                                        const url = new URL(page);
                                                        displayText = url.pathname || url.hostname;
                                                    } else {
                                                        displayText = 'Initial scan page';
                                                    }
                                                } catch {
                                                    // Keep original if parsing fails
                                                }
                                                
                                                return (
                                                    <li key={i} className="list-disc">
                                                        {page === 'initial' ? (
                                                            <span className="text-muted-foreground">
                                                                {displayText}
                                                            </span>
                                                        ) : (
                                                            <a
                                                                href={page}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-blue-600 hover:underline inline-flex items-center"
                                                                title={page}
                                                            >
                                                                {displayText}
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                                                            </a>
                                                        )}
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
           )}

        </CardFooter>
      </Card>
    </main>
  );
}
