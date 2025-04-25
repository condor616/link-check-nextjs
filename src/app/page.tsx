'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { AlertCircle, CheckCircle2, Loader2, Save, Check } from 'lucide-react';
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
  const [scanSameLinkOnce, setScanSameLinkOnce] = useState<boolean>(true);
  const [concurrency, setConcurrency] = useState<number>(10); // Add concurrency state
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

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

    const config: ScanConfig = {
      depth: depth,
      scanSameLinkOnce: scanSameLinkOnce,
      concurrency: concurrency,
      // TODO: Add exclusions from advanced options later
    };

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, config }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setScanResponse(data as ApiScanResponse);

    } catch (err: unknown) {
      console.error("Scan API call failed:", err);
      setError(
        err instanceof Error 
          ? err.message 
          : "An unexpected error occurred."
      );
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
      // Prepare the payload for saving
      const savePayload = {
        scanUrl: url,
        scanDate: new Date().toISOString(), // Current time when saving
        durationSeconds: scanResponse.durationSeconds,
        config: {
          depth,
          scanSameLinkOnce,
          concurrency,
        },
        results: scanResponse.results,
      };
      
      const response = await fetch('/api/save-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(savePayload),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `Failed to save scan (${response.status})`);
      }
      
      setSaveSuccess(true);
      console.log('Scan saved successfully:', data.scanId);
      
    } catch (err: unknown) {
      console.error('Failed to save scan:', err);
      setSaveError(
        err instanceof Error 
          ? err.message 
          : 'Failed to save scan to history'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Filter results for display (e.g., only broken links)
  const brokenLinks = scanResponse?.results?.filter(r => r.status === 'broken' || r.status === 'error');

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
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isLoading}
            />
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
                 <div className="flex items-center space-x-2 pt-6 sm:pt-8"> {/* Adjust alignment */} 
                   <Checkbox 
                    id="scanTwice" 
                    checked={!scanSameLinkOnce} // Checkbox means "Allow re-scanning" 
                    onCheckedChange={(checked) => setScanSameLinkOnce(!checked)} 
                    disabled={isLoading} 
                   />
                   <Label htmlFor="scanTwice">Re-scan same link multiple times</Label>
                 </div>
             </div>
             {/* Button to toggle advanced options */}
             <Button variant="link" className="p-0 h-auto" onClick={() => setShowAdvanced(!showAdvanced)} disabled={isLoading}>
                {showAdvanced ? 'Hide' : 'Show'} Advanced Options
             </Button>
          </div>

          {/* Advanced Configuration (Conditionally Rendered) */}
          {showAdvanced && (
            <div className="space-y-4 p-4 border rounded bg-card-foreground/5">
                <h3 className="text-lg font-medium">Advanced Configuration</h3>
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
                {/* TODO: Add UI for exclusions (URL, Regex, CSS Selector) */}
                <p className="text-sm text-muted-foreground">Exclusion rules (URL, Regex, CSS) coming soon...</p>
                {/* TODO: Add UI for Output Format selection ? (Maybe only on export?) */}
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

           {/* Show list of broken links */} 
           {brokenLinks && brokenLinks.length > 0 && (
            <div className="mt-4 border-t pt-4">
                <h4 className="font-semibold mb-2">Broken / Error Links:</h4>
                <ul className="list-disc pl-5 space-y-1 max-h-60 overflow-y-auto">
                    {brokenLinks.map(link => (
                        <li key={link.url} className="text-sm">
                            <code className="text-destructive break-all">{link.url}</code>
                            <span className="text-muted-foreground"> (Status: {link.statusCode || link.status}{link.errorMessage ? ` - ${link.errorMessage}` : ''})</span>
                            {/* TODO: Show foundOn pages */} 
                        </li>
                    ))}
                </ul>
            </div>
           )}

        </CardFooter>
      </Card>
    </main>
  );
}
