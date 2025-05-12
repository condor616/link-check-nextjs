'use client';

import React, { useState, useEffect } from 'react';
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
  Settings,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { TransitionLink } from '@/components/TransitionLink';

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

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scanResponse, setScanResponse] = useState<ApiScanResponse | null>(null);
  
  // Save states
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [lastScan, setLastScan] = useState<{
    url: string;
    date: string;
    brokenLinks: number;
    totalLinks: number;
    id: string;
  } | null>(null);

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

  useEffect(() => {
    const fetchLastScan = async () => {
      try {
        const response = await fetch('/api/last-scan');
        if (response.ok) {
          const data = await response.json();
          // Only set lastScan if the data has a valid ID
          if (data && data.id) {
            setLastScan(data);
          } else {
            // If no valid ID, treat as if no scan was found
            setLastScan(null);
          }
        }
      } catch (error) {
        console.error('Error fetching last scan:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastScan();
  }, []);

  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-8 text-center">Link Checker Pro</h1>
      
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertCircle className="mr-2 h-6 w-6 text-purple-600" />
              New Scan
            </CardTitle>
            <CardDescription>
              Check a website for broken links
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">
              Start a new scan to identify broken links, analyze performance, and get detailed insights.
            </p>
          </CardContent>
          <CardFooter>
            <TransitionLink href="/scan" className="w-full">
              <Button className="w-full">
                Start New Scan
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </TransitionLink>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center">
              <History className="mr-2 h-6 w-6 text-purple-600" />
              View History
            </CardTitle>
            <CardDescription>
              Access your previous scans
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">
              View all your previous scans, review results, compare scans, and export reports.
            </p>
          </CardContent>
          <CardFooter>
            <TransitionLink href="/history" className="w-full">
              <Button className="w-full">
                View History
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </TransitionLink>
          </CardFooter>
        </Card>
      </div>

      <section className="mb-6">
        <h2 className="text-2xl font-bold mb-4">Last Scan</h2>
        {isLoading ? (
          <Card className="p-6 text-center">
            <p>Loading last scan data...</p>
          </Card>
        ) : lastScan ? (
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-xl">
                <LinkIcon className="inline-block mr-2 h-5 w-5 text-purple-600" />
                {lastScan.url}
              </CardTitle>
              <CardDescription className="flex items-center">
                <Clock className="mr-2 h-4 w-4" />
                {new Date(lastScan.date).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-lg font-semibold text-red-500">{lastScan.brokenLinks}</p>
                  <p className="text-sm text-gray-500">Broken Links</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-lg font-semibold">{lastScan.totalLinks}</p>
                  <p className="text-sm text-gray-500">Total Links</p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              {lastScan.id ? (
                <TransitionLink href={`/history/${lastScan.id}`} className="w-full">
                  <Button variant="outline" className="w-full">
                    View Details
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </TransitionLink>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  No Details Available
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          <Card className="p-6 text-center">
            <p>No previous scans found. Start your first scan now!</p>
            <div className="mt-4">
              <TransitionLink href="/scan">
                <Button>
                  Start New Scan
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </TransitionLink>
            </div>
          </Card>
        )}
      </section>
    </main>
  );
}
