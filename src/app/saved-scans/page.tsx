'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SavedScanConfig } from '@/app/api/saved-configs/route';
import {
  Loader2,
  AlertCircle,
  Download,
  Edit,
  Trash2,
  Play,
  Check,
  X,
  Save,
  ArrowLeft,
  Plus,
  Copy,
  Database,
  FileJson,
  Settings
} from 'lucide-react';
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
import { Checkbox } from "@/components/ui/checkbox";
import JSONPreview from '@/components/JSONPreview';
import { useNotification } from '@/components/NotificationContext';

export default function SavedScansPage() {
  const [configs, setConfigs] = useState<SavedScanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSupabaseError, setIsSupabaseError] = useState<boolean>(false);
  const [settingsType, setSettingsType] = useState<'file' | 'supabase' | null>(null);

  // Editing state
  const [editingConfig, setEditingConfig] = useState<SavedScanConfig | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editUseAuth, setEditUseAuth] = useState(false);
  const [editUseAuthForAllDomains, setEditUseAuthForAllDomains] = useState(false);

  // Save/delete state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Confirm dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Add additional state variables for scan options
  const [editDepth, setEditDepth] = useState<number>(0);
  const [editConcurrency, setEditConcurrency] = useState<number>(10);
  const [editRequestTimeout, setEditRequestTimeout] = useState<number>(30);
  const [editScanSameLinkOnce, setEditScanSameLinkOnce] = useState<boolean>(true);
  const [editShowAdvanced, setEditShowAdvanced] = useState<boolean>(false);
  const [editRegexExclusions, setEditRegexExclusions] = useState<string[]>([""]);
  const [editCssSelectors, setEditCssSelectors] = useState<string[]>([""]);
  const [editCssSelectorsForceExclude, setEditCssSelectorsForceExclude] = useState<boolean>(false);
  const [editWildcardExclusions, setEditWildcardExclusions] = useState<string[]>([""]);
  const [editSkipExternalDomains, setEditSkipExternalDomains] = useState<boolean>(true);
  const [editExcludeSubdomains, setEditExcludeSubdomains] = useState<boolean>(true);

  const router = useRouter();
  const { addNotification } = useNotification();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    setError(null);
    setIsSupabaseError(false);

    try {
      // First get current settings to know if we're using Supabase
      const settingsResponse = await fetch('/api/settings');
      if (settingsResponse.ok) {
        const settingsData = await settingsResponse.json();
        setSettingsType(settingsData.storageType || 'file');
      }

      const response = await fetch('/api/saved-configs');
      const data = await response.json();

      if (!response.ok) {
        // Check if this is a Supabase connection error
        if (data.error && typeof data.error === 'string' &&
          (data.error.includes('Supabase') ||
            data.error.includes('database') ||
            data.error.includes('connection'))) {
          setIsSupabaseError(true);
          throw new Error(`Database connection error: ${data.error}`);
        }
        throw new Error(data.error || 'Failed to fetch saved configurations');
      }

      setConfigs(data);
    } catch (error) {
      console.error('Error fetching saved configurations:', error);
      setError(error instanceof Error ? error.message : 'Failed to fetch saved configurations');
    } finally {
      setLoading(false);
    }
  };

  // Function to switch to file-based storage
  const switchToFileStorage = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageType: 'file',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      addNotification('success', 'Successfully switched to file-based storage');
      setSettingsType('file');
      // Refetch configs with the new storage type
      fetchConfigs();
    } catch (error) {
      console.error('Error switching to file storage:', error);
      addNotification('error', error instanceof Error ? error.message : 'Failed to switch storage type');
    }
  };

  // Navigate to settings page
  const goToSettings = () => {
    router.push('/settings');
  };

  const handleStartScan = (config: SavedScanConfig) => {
    // Navigate to scan page with config parameters
    const configString = encodeURIComponent(JSON.stringify(config.config));
    router.push(`/scan?url=${encodeURIComponent(config.url)}&config=${configString}`);
  };

  const handleEdit = (config: SavedScanConfig) => {
    setEditingConfig(config);
    setEditName(config.name);
    setEditUrl(config.url);

    // Initialize depth
    setEditDepth(config.config.depth ?? 0);

    // Initialize concurrency
    setEditConcurrency(config.config.concurrency ?? 10);

    // Initialize request timeout (convert from ms to seconds)
    setEditRequestTimeout((config.config.requestTimeout ?? 30000) / 1000);

    // Initialize scan same link once option
    setEditScanSameLinkOnce(config.config.scanSameLinkOnce !== false);

    // Initialize skip external domains option
    setEditSkipExternalDomains(config.config.skipExternalDomains !== false);

    // Initialize exclude subdomains option
    setEditExcludeSubdomains(config.config.excludeSubdomains !== false);

    // Initialize exclusion patterns
    setEditRegexExclusions(
      config.config.regexExclusions?.length ?
        config.config.regexExclusions : [""]
    );

    setEditCssSelectors(
      config.config.cssSelectors?.length ?
        config.config.cssSelectors : [""]
    );

    setEditCssSelectorsForceExclude(!!config.config.cssSelectorsForceExclude);

    setEditWildcardExclusions(
      config.config.wildcardExclusions?.length ?
        config.config.wildcardExclusions : [""]
    );

    // Set auth if available
    if (config.config.auth) {
      setEditUsername(config.config.auth.username || '');
      setEditPassword(config.config.auth.password || '');
      setEditUseAuth(true);
      setEditUseAuthForAllDomains(config.config.useAuthForAllDomains || false);
    } else {
      setEditUsername('');
      setEditPassword('');
      setEditUseAuth(false);
      setEditUseAuthForAllDomains(false);
    }

    setShowEditDialog(true);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSaveEdit = async () => {
    if (!editingConfig) return;

    if (!editName.trim()) {
      setSaveError('Please provide a name for this configuration');
      return;
    }

    if (!editUrl.trim()) {
      setSaveError('Please provide a URL');
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Filter out empty entries
      const filteredRegexExclusions = editRegexExclusions.filter(regex => regex.trim() !== "");
      const filteredCssSelectors = editCssSelectors.filter(selector => selector.trim() !== "");
      const filteredWildcardExclusions = editWildcardExclusions.filter(pattern => pattern.trim() !== "");

      // Create a copy of the config to update
      const updatedConfig = { ...editingConfig };
      updatedConfig.name = editName;
      updatedConfig.url = editUrl;

      // Update scan configuration options
      updatedConfig.config = {
        ...updatedConfig.config,
        depth: editDepth,
        concurrency: editConcurrency,
        requestTimeout: editRequestTimeout * 1000, // Convert seconds to milliseconds
        scanSameLinkOnce: editScanSameLinkOnce,
        regexExclusions: filteredRegexExclusions,
        cssSelectors: filteredCssSelectors,
        cssSelectorsForceExclude: editCssSelectorsForceExclude,
        wildcardExclusions: filteredWildcardExclusions,
        skipExternalDomains: editSkipExternalDomains,
        excludeSubdomains: editExcludeSubdomains,
      };

      // Update auth settings
      if (editUseAuth && editUsername && editPassword) {
        updatedConfig.config.auth = {
          username: editUsername,
          password: editPassword
        };
        updatedConfig.config.useAuthForAllDomains = editUseAuthForAllDomains;
      } else if (!editUseAuth) {
        // Remove auth if disabled
        const { auth, useAuthForAllDomains, ...configWithoutAuth } = updatedConfig.config;
        updatedConfig.config = configWithoutAuth;
      }

      // Send to API
      const response = await fetch(`/api/saved-configs/${editingConfig.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: updatedConfig.name,
          url: updatedConfig.url,
          config: updatedConfig.config
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update configuration');
      }

      setSaveSuccess(true);

      // Update the configs list
      setConfigs(configs.map(config =>
        config.id === editingConfig.id ? { ...updatedConfig, updatedAt: new Date().toISOString() } : config
      ));

      // Close dialog after a short delay
      setTimeout(() => {
        setShowEditDialog(false);
        setSaveSuccess(false);
        setEditingConfig(null);
      }, 1500);
    } catch (error) {
      console.error('Error updating configuration:', error);
      setSaveError(error instanceof Error ? error.message : 'Failed to update configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (configId: string) => {
    setConfigToDelete(configId);
    setShowDeleteDialog(true);
    setDeleteError(null);
  };

  const handleDelete = async () => {
    if (!configToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/saved-configs/${configToDelete}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete configuration');
      }

      // Remove from the configs list
      setConfigs(configs.filter(config => config.id !== configToDelete));

      // Close dialog
      setShowDeleteDialog(false);
      setConfigToDelete(null);
    } catch (error) {
      console.error('Error deleting configuration:', error);
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete configuration');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Helper functions for managing exclusion patterns
  const addEditRegexExclusion = () => setEditRegexExclusions([...editRegexExclusions, ""]);

  const removeEditRegexExclusion = (index: number) => {
    const newExclusions = [...editRegexExclusions];
    newExclusions.splice(index, 1);
    setEditRegexExclusions(newExclusions);
  };

  const updateEditRegexExclusion = (index: number, value: string) => {
    const newExclusions = [...editRegexExclusions];
    newExclusions[index] = value;
    setEditRegexExclusions(newExclusions);
  };

  const addEditCssSelector = () => setEditCssSelectors([...editCssSelectors, ""]);

  const removeEditCssSelector = (index: number) => {
    const newSelectors = [...editCssSelectors];
    newSelectors.splice(index, 1);
    setEditCssSelectors(newSelectors);
  };

  const updateEditCssSelector = (index: number, value: string) => {
    const newSelectors = [...editCssSelectors];
    newSelectors[index] = value;
    setEditCssSelectors(newSelectors);
  };

  const addEditWildcardExclusion = () => setEditWildcardExclusions([...editWildcardExclusions, ""]);

  const removeEditWildcardExclusion = (index: number) => {
    const newExclusions = [...editWildcardExclusions];
    newExclusions.splice(index, 1);
    setEditWildcardExclusions(newExclusions);
  };

  const updateEditWildcardExclusion = (index: number, value: string) => {
    const newExclusions = [...editWildcardExclusions];
    newExclusions[index] = value;
    setEditWildcardExclusions(newExclusions);
  };

  // Add copy to clipboard function
  const copyJsonToClipboard = (json: any) => {
    const stringified = JSON.stringify(json, null, 2);
    navigator.clipboard.writeText(stringified);
  };

  return (
    <div className="container mx-auto p-4 max-w-none">
      <h1 className="text-2xl font-bold mb-6">Saved Scan Configurations</h1>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading configurations...</span>
        </div>
      ) : error ? (
        isSupabaseError && settingsType === 'supabase' ? (
          <div className="p-6 border rounded-lg bg-amber-50">
            <div className="flex items-start gap-4">
              <div className="mt-1">
                <Database className="h-6 w-6 text-amber-600" />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-amber-800">Database Connection Issue</h3>
                  <p className="mt-1 text-amber-700">
                    Unable to connect to the Supabase database. Your settings are configured to use Supabase, but the connection failed.
                  </p>
                </div>
                <div className="space-y-3">
                  <h4 className="font-medium text-amber-800">You have two options:</h4>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={switchToFileStorage} variant="outline" className="bg-transparent border-input hover:bg-accent hover:text-accent-foreground">
                      <FileJson className="mr-2 h-4 w-4" />
                      Switch to File Storage
                    </Button>
                    <Button onClick={goToSettings} variant="default">
                      <Settings className="mr-2 h-4 w-4" />
                      Fix Supabase Settings
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )
      ) : configs.length === 0 ? (
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="pt-6 pb-6">
            <div className="text-center py-12">
              <p className="mb-4 text-muted-foreground">No saved configurations found.</p>
              <Button onClick={() => router.push('/scan')}>
                Create New Scan
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {configs.map(config => (
            <Card key={config.id} className="bg-card border-border shadow-sm hover:border-primary hover:shadow-[0_0_20px_-5px_var(--primary)] transition-all duration-300 cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-xl">{config.name}</CardTitle>
                <CardDescription>
                  <span className="font-medium">URL:</span> {config.url}
                </CardDescription>
                <CardDescription>
                  <span className="font-medium">Updated:</span> {formatDate(config.updatedAt)}
                </CardDescription>
              </CardHeader>

              <CardContent className="pb-3">
                <div className="text-sm space-y-2">
                  <div>
                    <span className="font-medium">Authentication:</span> {config.config.auth ? 'Enabled' : 'None'}
                  </div>
                  <div>
                    <span className="font-medium">Exclusions:</span> {' '}
                    {config.config.regexExclusions?.length || 0} regex, {' '}
                    {config.config.wildcardExclusions?.length || 0} wildcard, {' '}
                    {config.config.cssSelectors?.length || 0} CSS
                  </div>
                  <div>
                    <span className="font-medium">Concurrent requests:</span> {config.config.concurrency || 10}
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex justify-between pt-2">
                <div className="space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(config)}
                  >
                    <Edit className="h-4 w-4 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => confirmDelete(config.id)}
                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleStartScan(config)}
                  className="bg-primary hover:bg-primary/90 text-white"
                >
                  <Play className="h-4 w-4 mr-1" /> Start Scan
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <AlertDialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <AlertDialogContent className="!max-w-full sm:!max-w-[95%] md:!max-w-[95%] lg:!max-w-[95%] xl:!max-w-[1400px] w-full h-auto max-h-[95vh] overflow-y-auto p-6 m-4">
          <AlertDialogHeader className="pb-4">
            <AlertDialogTitle className="text-2xl">Edit Scan Configuration</AlertDialogTitle>
            <div className="text-sm text-muted-foreground">
              Update your saved scan configuration details.
            </div>
          </AlertDialogHeader>

          <div className="space-y-6 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="editName" className="text-base">Configuration Name</Label>
                <Input
                  id="editName"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="text-base p-3 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editUrl" className="text-base">URL</Label>
                <Input
                  id="editUrl"
                  type="url"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="text-base p-3 h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="space-y-2">
                <Label htmlFor="editDepth" className="text-base">Scan Depth (0 for current page only)</Label>
                <Input
                  id="editDepth"
                  type="number"
                  min="0"
                  max="5"
                  value={editDepth}
                  onChange={(e) => setEditDepth(parseInt(e.target.value) || 0)}
                  className="text-base p-3 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editConcurrency" className="text-base">Concurrency (1-50)</Label>
                <Input
                  id="editConcurrency"
                  type="number"
                  min="1"
                  max="50"
                  value={editConcurrency}
                  onChange={(e) => setEditConcurrency(parseInt(e.target.value) || 10)}
                  className="text-base p-3 h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRequestTimeout" className="text-base">Request Timeout (seconds)</Label>
                <Input
                  id="editRequestTimeout"
                  type="number"
                  min="5"
                  max="180"
                  value={editRequestTimeout}
                  onChange={(e) => setEditRequestTimeout(parseInt(e.target.value) || 30)}
                  className="text-base p-3 h-11"
                />
                <p className="text-xs text-muted-foreground mt-1">Time before giving up on a single URL (5-180 seconds)</p>
              </div>
            </div>

            <div className="flex items-center space-x-2 mt-4 py-2">
              <Checkbox
                id="editScanSameLinkOnce"
                checked={editScanSameLinkOnce}
                onCheckedChange={(checked) => setEditScanSameLinkOnce(!!checked)}
                className="h-5 w-5"
              />
              <Label htmlFor="editScanSameLinkOnce" className="cursor-pointer text-base font-normal">
                Check each link only once (recommended)
              </Label>
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="editSkipExternalDomains"
                checked={editSkipExternalDomains}
                onCheckedChange={(checked) => setEditSkipExternalDomains(!!checked)}
              />
              <Label htmlFor="editSkipExternalDomains" className="cursor-pointer text-sm font-normal">
                Skip external domains
              </Label>
            </div>

            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="editExcludeSubdomains"
                checked={editExcludeSubdomains}
                onCheckedChange={(checked) => setEditExcludeSubdomains(!!checked)}
              />
              <Label htmlFor="editExcludeSubdomains" className="cursor-pointer text-sm font-normal">
                Do not check subdomains
              </Label>
            </div>

            <div className="space-y-4 border-t pt-4 mt-2">
              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="editUseAuth"
                  checked={editUseAuth}
                  onCheckedChange={(checked) => setEditUseAuth(!!checked)}
                  className="h-5 w-5"
                />
                <Label htmlFor="editUseAuth" className="ml-2 text-base font-medium">
                  Use HTTP Basic Authentication
                </Label>
              </div>

              {editUseAuth && (
                <div className="pl-8 space-y-4 bg-gray-50 dark:bg-muted/20 p-4 rounded-md border border-transparent dark:border-border">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="editUsername" className="text-base">Username</Label>
                      <Input
                        id="editUsername"
                        type="text"
                        value={editUsername}
                        onChange={(e) => setEditUsername(e.target.value)}
                        className="text-base p-3 h-11 bg-white dark:bg-background"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="editPassword" className="text-base">Password</Label>
                      <Input
                        id="editPassword"
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="text-base p-3 h-11 bg-white dark:bg-background"
                      />
                    </div>
                  </div>

                  <div className="flex items-center mt-2">
                    <Checkbox
                      id="editUseAuthForAllDomains"
                      checked={editUseAuthForAllDomains}
                      onCheckedChange={(checked) => setEditUseAuthForAllDomains(!!checked)}
                      className="h-5 w-5"
                    />
                    <Label htmlFor="editUseAuthForAllDomains" className="ml-2 text-base">
                      Use authentication for all domains
                    </Label>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Options */}
            <Button
              variant="link"
              className="p-0 h-auto text-purple-600 text-base"
              onClick={() => setEditShowAdvanced(!editShowAdvanced)}
            >
              {editShowAdvanced ? 'Hide' : 'Show'} Advanced Options
            </Button>

            {editShowAdvanced && (
              <div className="border border-border rounded-lg p-6 space-y-6 mt-2 bg-gray-50 dark:bg-muted/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left column */}
                  <div className="space-y-6">
                    {/* Wildcard Exclusion Rules */}
                    <div className="space-y-3">
                      <Label htmlFor="editWildcardExclusions" className="text-base font-medium">URL Exclusion Patterns</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Simple URL patterns to exclude (e.g., "example.com/about/*")
                      </p>

                      {editWildcardExclusions.map((pattern, index) => (
                        <div key={`wildcard-${index}`} className="flex gap-3 items-center mb-3">
                          <div className="w-1.5 h-11 bg-yellow-400 rounded-sm mr-1"></div>
                          <Input
                            value={pattern}
                            onChange={(e) => updateEditWildcardExclusion(index, e.target.value)}
                            placeholder="e.g. example.com/about/*"
                            className="flex-1 text-base p-3 h-11"
                          />

                          {index === editWildcardExclusions.length - 1 ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEditWildcardExclusion(index)}
                                disabled={editWildcardExclusions.length <= 1}
                                className="shrink-0 h-10 w-10"
                              >
                                <X className="h-5 w-5" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={addEditWildcardExclusion}
                                className="shrink-0 h-10 w-10"
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditWildcardExclusion(index)}
                              className="shrink-0 h-10 w-10"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Regex Exclusion Rules */}
                    <div className="space-y-3">
                      <Label htmlFor="editRegexExclusions" className="text-base font-medium">Regex Exclusion Patterns</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Links matching these patterns will be skipped
                      </p>

                      {editRegexExclusions.map((regex, index) => (
                        <div key={`regex-${index}`} className="flex gap-3 items-center mb-3">
                          <div className="w-1.5 h-11 bg-blue-400 rounded-sm mr-1"></div>
                          <Input
                            value={regex}
                            onChange={(e) => updateEditRegexExclusion(index, e.target.value)}
                            placeholder="e.g. \/assets\/.*\.pdf$"
                            className="flex-1 text-base p-3 h-11"
                          />

                          {index === editRegexExclusions.length - 1 ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEditRegexExclusion(index)}
                                disabled={editRegexExclusions.length <= 1}
                                className="shrink-0 h-10 w-10"
                              >
                                <X className="h-5 w-5" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={addEditRegexExclusion}
                                className="shrink-0 h-10 w-10"
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditRegexExclusion(index)}
                              className="shrink-0 h-10 w-10"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-6">
                    {/* CSS Selector Exclusions */}
                    <div className="space-y-3">
                      <Label htmlFor="editCssSelectors" className="text-base font-medium">CSS Selector Exclusions</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Links within these CSS selectors will be skipped
                      </p>

                      {editCssSelectors.map((selector, index) => (
                        <div key={`selector-${index}`} className="flex gap-3 items-center mb-3">
                          <div className="w-1.5 h-11 bg-green-400 rounded-sm mr-1"></div>
                          <Input
                            value={selector}
                            onChange={(e) => updateEditCssSelector(index, e.target.value)}
                            placeholder="e.g. .footer, #navigation, [data-skip]"
                            className="flex-1 text-base p-3 h-11"
                          />

                          {index === editCssSelectors.length - 1 ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeEditCssSelector(index)}
                                disabled={editCssSelectors.length <= 1}
                                className="shrink-0 h-10 w-10"
                              >
                                <X className="h-5 w-5" />
                              </Button>

                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={addEditCssSelector}
                                className="shrink-0 h-10 w-10"
                              >
                                <Plus className="h-5 w-5" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditCssSelector(index)}
                              className="shrink-0 h-10 w-10"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center space-x-2 pt-4">
                        <Checkbox
                          id="editCssSelectorsForceExclude"
                          checked={editCssSelectorsForceExclude}
                          onCheckedChange={(checked) => setEditCssSelectorsForceExclude(!!checked)}
                          className="h-5 w-5"
                        />
                        <Label htmlFor="editCssSelectorsForceExclude" className="cursor-pointer text-base font-normal">
                          Force Exclude - Links in CSS selectors are excluded entirely, even if found elsewhere on the page
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Use the new JSONPreview component */}
                <div className="border-t border-border pt-6 mt-4">
                  <JSONPreview
                    data={{
                      name: editName,
                      url: editUrl,
                      config: {
                        depth: editDepth,
                        concurrency: editConcurrency,
                        requestTimeout: editRequestTimeout * 1000, // Convert to milliseconds
                        scanSameLinkOnce: editScanSameLinkOnce,
                        regexExclusions: editRegexExclusions.filter(r => r.trim() !== ""),
                        cssSelectors: editCssSelectors.filter(s => s.trim() !== ""),
                        cssSelectorsForceExclude: editCssSelectorsForceExclude,
                        wildcardExclusions: editWildcardExclusions.filter(w => w.trim() !== ""),
                        skipExternalDomains: editSkipExternalDomains,
                        excludeSubdomains: editExcludeSubdomains,
                        ...(editUseAuth && {
                          auth: {
                            username: editUsername,
                            password: editPassword
                          },
                          useAuthForAllDomains: editUseAuthForAllDomains
                        })
                      }
                    }}
                  />
                </div>
              </div>
            )}

            {saveError && (
              <Alert variant="destructive">
                <AlertCircle className="h-5 w-5" />
                <AlertDescription className="text-base">{saveError}</AlertDescription>
              </Alert>
            )}

            {saveSuccess && (
              <Alert className="bg-green-50 text-green-800 border-green-200">
                <Check className="h-5 w-5" />
                <AlertDescription className="text-base">Configuration updated successfully!</AlertDescription>
              </Alert>
            )}
          </div>

          <AlertDialogFooter className="pt-4">
            <AlertDialogCancel disabled={isSaving} className="text-base h-11">
              Cancel
            </AlertDialogCancel>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving || !editName.trim() || !editUrl.trim()}
              className="text-base h-11 px-6"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-5 w-5" />
                  Save Changes
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <div className="text-sm text-muted-foreground">
              Are you sure you want to delete this scan configuration? This action cannot be undone.
            </div>
          </AlertDialogHeader>

          {deleteError && (
            <Alert variant="destructive" className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{deleteError}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
} 