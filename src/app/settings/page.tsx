'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, Database, FileJson, HelpCircle, Trash, X, RefreshCw, Eraser, Palette } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNotification } from "@/components/NotificationContext";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

type StorageType = 'file' | 'sqlite' | 'supabase';

export default function SettingsPage() {
  const [storageType, setStorageType] = useState<StorageType>('sqlite');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [sqlCommands, setSqlCommands] = useState<string[] | null>(null);
  const [showSqlCommands, setShowSqlCommands] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{ success: boolean, message: string } | null>(null);
  const [tablesExist, setTablesExist] = useState(false);
  const [isCheckingTables, setIsCheckingTables] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [needsInitialization, setNeedsInitialization] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showConfirmClearDialog, setShowConfirmClearDialog] = useState(false);
  const [showConnectionSuccessDialog, setShowConnectionSuccessDialog] = useState(false);

  // Get notification context to show global notifications
  const { addNotification } = useNotification();
  const { theme, setTheme } = useTheme();

  // Load settings on page load
  useEffect(() => {
    fetchSettings();
  }, []);

  // Check if tables exist whenever Supabase credentials change or after operations
  useEffect(() => {
    if (storageType === 'supabase' && supabaseUrl && supabaseKey) {
      checkTablesExist();
    }
  }, [storageType, supabaseUrl, supabaseKey]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');

      if (response.ok) {
        const data = await response.json();
        const type = data.storageType || 'sqlite';
        setStorageType(type === 'file' ? 'sqlite' : type);
        setSupabaseUrl(data.supabaseUrl || '');
        setSupabaseKey(data.supabaseKey || '');
      } else {
        // If settings don't exist yet, we'll use defaults
        console.log('Using default settings');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);

    try {
      // Validate Supabase URL and key if selecting Supabase storage
      if (storageType === 'supabase') {
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase URL and key are required when using Supabase storage');
        }

        // Basic URL validation
        if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
          throw new Error('Supabase URL should be in the format https://your-project.supabase.co');
        }

        // Basic key validation (should be a long string)
        if (supabaseKey.length < 20) {
          throw new Error('Supabase anon key appears to be invalid');
        }
      }

      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageType,
          supabaseUrl,
          supabaseKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      addNotification('success', 'Settings saved successfully');

      // After saving, check if tables exist
      if (storageType === 'supabase') {
        checkTablesExist();
      } else {
        // If using file storage, reset the tablesExist state
        setTablesExist(false);
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      addNotification('error', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const checkSupabaseConfig = () => {
    if (!supabaseUrl || !supabaseKey) {
      return false;
    }
    return true;
  };

  const testSupabaseConnection = async () => {
    if (!supabaseUrl || !supabaseKey) {
      addNotification('error', 'Please enter both Supabase URL and key before testing connection');
      return;
    }

    setIsTesting(true);
    setConnectionTestResult(null);
    setNeedsInitialization(false);

    try {
      // Make a simple request to test the connection
      const response = await fetch('/api/supabase/setup-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionTestOnly: true }),
      });

      if (!response.ok) {
        const data = await response.json();
        if (data.error && data.error.includes('Cannot connect to Supabase')) {
          throw new Error('Cannot connect to Supabase. Please check your credentials.');
        }

        // If we get a 202 response, it means tables don't exist but connection works
        if (response.status === 202) {
          setConnectionTestResult({
            success: true,
            message: 'Connection successful! Tables do not exist yet.'
          });
          return;
        }

        throw new Error(data.error || 'Failed to connect to Supabase');
      }

      const data = await response.json();
      setNeedsInitialization(!!data.needsInitialization);

      setConnectionTestResult({
        success: true,
        message: data.needsInitialization
          ? 'Connection to Supabase is successful!'
          : 'Connection successful! Your Supabase database is properly configured.'
      });

      // If initialization is needed, show the dialog to guide the user
      if (data.needsInitialization) {
        setShowConnectionSuccessDialog(true);
      } else {
        addNotification('success', 'Connection successful! Your Supabase database is properly configured.');
      }

    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error'
      });
      addNotification('error', error instanceof Error ? error.message : 'Unknown connection error');
    } finally {
      setIsTesting(false);
    }
  };

  const initializeSchema = async () => {
    if (!supabaseUrl || !supabaseKey) {
      return;
    }

    setIsInitializing(true);
    setSqlCommands(null);

    try {
      // First check if tables already exist
      const tableNames = ['scan_configs', 'scan_history', 'scan_params'];
      let allTablesExist = true;

      for (const table of tableNames) {
        try {
          const response = await fetch('/api/supabase/check-table', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ table })
          });

          if (!response.ok) {
            allTablesExist = false;
            break;
          }

          const data = await response.json();
          if (!data.exists) {
            allTablesExist = false;
            break;
          }
        } catch (error) {
          console.error(`Error checking table ${table}:`, error);
          allTablesExist = false;
          break;
        }
      }

      // If tables already exist, show success message and return
      if (allTablesExist) {
        setTablesExist(true);
        setNeedsInitialization(false);
        addNotification('success', 'Database schema is already initialized');
        return;
      }

      // Call the setup-sql endpoint to initialize the schema
      const response = await fetch('/api/supabase/setup-sql', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.status === 202 || data.sql_commands) {
        // We need to show SQL commands
        setSqlCommands(data.sql_commands);
        setShowSqlCommands(true);
      } else if (response.ok) {
        // Tables were created successfully
        setNeedsInitialization(false);
        setTablesExist(true);
        addNotification('success', 'Database schema initialized successfully');
      } else {
        throw new Error(data.error || 'Failed to initialize schema');
      }
    } catch (error) {
      console.error('Schema initialization error:', error);
      addNotification('error', `Failed to initialize schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const checkTablesExist = async () => {
    if (!checkSupabaseConfig()) {
      setTablesExist(false);
      return;
    }

    // First save the settings to ensure API calls use the current values
    try {
      // Silently save settings without notifications
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageType,
          supabaseUrl,
          supabaseKey,
        }),
      });

      if (!response.ok) {
        console.error('Failed to update settings before checking tables');
        setTablesExist(false);
        setIsCheckingTables(false);
        return;
      }
    } catch (error) {
      console.error('Error saving settings before checking tables:', error);
      setTablesExist(false);
      setIsCheckingTables(false);
      return;
    }

    setIsCheckingTables(true);

    try {
      // Check if all required tables exist
      const tableNames = ['scan_configs', 'scan_history', 'scan_params'];
      let allTablesExist = true;

      for (const table of tableNames) {
        try {
          const response = await fetch('/api/supabase/check-table', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ table })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error checking table ${table}:`, errorText);
            allTablesExist = false;
            break;
          }

          const data = await response.json();
          if (!data.exists) {
            allTablesExist = false;
            break;
          }
        } catch (error) {
          console.error(`Error checking table ${table}:`, error);
          allTablesExist = false;
          break;
        }
      }

      setTablesExist(allTablesExist);
    } catch (error) {
      console.error('Error checking tables:', error);
      setTablesExist(false);
    } finally {
      setIsCheckingTables(false);
    }
  };

  const resetSupabaseTables = async () => {
    // First check if Supabase is configured
    if (!checkSupabaseConfig()) {
      addNotification('error', 'Please configure Supabase URL and key before initializing tables');
      return;
    }

    setIsResetting(true);

    try {
      const response = await fetch('/api/supabase/setup-sql', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.status === 202) {
        // Tables need to be created manually
        setSqlCommands(data.sql_commands);
        setShowSqlCommands(true);
        addNotification('warning', 'Tables need to be created manually in Supabase');
        return;
      }

      if (!response.ok) {
        if (data.sql_commands) {
          setSqlCommands(data.sql_commands);
          setShowSqlCommands(true);
        }
        throw new Error(data.error || 'Failed to reset Supabase tables');
      }

      addNotification('success', 'Supabase tables were initialized successfully');

      // After successful reset, update tablesExist
      setTablesExist(true);
    } catch (error) {
      console.error('Error resetting tables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addNotification('error', `Failed to initialize tables: ${errorMessage}`);
    } finally {
      setIsResetting(false);
    }
  };

  const deleteSupabaseTables = async () => {
    // First check if Supabase is configured
    if (!checkSupabaseConfig()) {
      addNotification('error', 'Please configure Supabase URL and key before attempting to delete tables');
      return;
    }

    setIsDeleting(true);

    try {
      // First save the settings to ensure API calls use the current values
      const saveResponse = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storageType,
          supabaseUrl,
          supabaseKey,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error('Failed to update settings before getting SQL commands');
      }

      // Get SQL commands for deleting tables
      const response = await fetch('/api/supabase/delete-tables', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get SQL commands');
      }

      // If no tables exist
      if (data.message && data.message.includes('No tables found')) {
        addNotification('info', 'No tables to delete - your Supabase database is already empty');
        setTablesExist(false);
        return;
      }

      // Show SQL commands in popup
      if (data.sql_commands && Array.isArray(data.sql_commands)) {
        setSqlCommands(data.sql_commands);
        setShowSqlCommands(true);
        addNotification('info', 'Please run the SQL commands in your Supabase SQL Editor to delete tables');
      } else {
        throw new Error('No SQL commands returned');
      }
    } catch (error) {
      console.error('Error getting SQL commands:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addNotification('error', `Failed to get SQL commands: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const clearTableData = async () => {
    // First check if Supabase is configured
    if (!checkSupabaseConfig()) {
      addNotification('error', 'Please configure Supabase URL and key before clearing data');
      return;
    }

    // Show confirmation dialog
    setShowConfirmClearDialog(true);
  };

  const confirmClearData = async () => {
    setShowConfirmClearDialog(false);
    setIsClearing(true);

    try {
      // This endpoint doesn't exist yet, but we'll implement it
      // It should delete all data from tables without dropping the tables themselves
      const response = await fetch('/api/supabase/clear-data', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        // Check if the error is because tables don't exist
        if (data.error && data.error.includes('does not exist')) {
          addNotification('info', 'No tables exist to clear data from.');
          return;
        }

        throw new Error(data.error || 'Failed to clear data from Supabase tables');
      }

      addNotification('success', 'Data was successfully cleared from all tables');
    } catch (error) {
      console.error('Error clearing data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      addNotification('error', `Failed to clear data: ${errorMessage}`);
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-4">Settings</h1>
        <p className="text-gray-600 mb-6">
          Configure your application settings
        </p>
      </div>

      <Tabs defaultValue="data-storage" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="data-storage">Data Storage</TabsTrigger>
          <TabsTrigger value="themes">Themes</TabsTrigger>
          {/* Add other settings tabs here in the future */}
        </TabsList>

        <TabsContent value="data-storage">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Storage Configuration
              </CardTitle>
              <CardDescription>
                Choose how you want to store your scan data and configurations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="storage-type">Storage Type</Label>
                  <Select
                    value={storageType}
                    onValueChange={(value) => setStorageType(value as StorageType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a storage type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sqlite" className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Local Database (SQLite)
                        </span>
                      </SelectItem>
                      <SelectItem value="supabase" className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <Database className="h-4 w-4" />
                          Supabase Database
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    {(storageType === 'file' || storageType === 'sqlite')
                      ? 'Data will be stored in a local SQLite database'
                      : 'Data will be stored in a Supabase database'}
                  </p>
                </div>

                {storageType === 'supabase' && (
                  <div className="space-y-6 p-4 border rounded-md bg-slate-50">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label htmlFor="supabase-url">Supabase URL<span className="text-red-500">*</span></Label>
                        {(!supabaseUrl || !supabaseKey) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            onClick={() => setShowHelpDialog(true)}
                          >
                            <HelpCircle className="h-4 w-4" />
                            Need help?
                          </Button>
                        )}
                      </div>
                      <Input
                        id="supabase-url"
                        value={supabaseUrl}
                        onChange={(e) => setSupabaseUrl(e.target.value)}
                        placeholder="https://your-project.supabase.co"
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Your Supabase project URL, e.g. https://abcdefghijklm.supabase.co
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="supabase-key">Supabase Anon Key<span className="text-red-500">*</span></Label>
                      <Input
                        id="supabase-key"
                        value={supabaseKey}
                        onChange={(e) => setSupabaseKey(e.target.value)}
                        type="password"
                        placeholder="Your Supabase anon key"
                        className="w-full"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        The anon/public API key for your Supabase project
                      </p>
                    </div>

                    <div className="mt-2">
                      <Button
                        variant="outline"
                        onClick={testSupabaseConnection}
                        disabled={isTesting || !supabaseUrl || !supabaseKey}
                        className="w-full md:w-auto justify-start flex items-center gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${isTesting ? "animate-spin" : ""}`} />
                        {isTesting ? "Testing..." : "Test Connection"}
                      </Button>
                    </div>

                    {connectionTestResult && !connectionTestResult.success && (
                      <Alert
                        className="mt-2 bg-red-50 text-red-800 border-red-200"
                      >
                        <AlertCircle className="h-5 w-5" />
                        <AlertDescription>
                          {connectionTestResult.message}
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="pt-4 space-y-4 border-t">
                      <h3 className="font-medium">Supabase Management</h3>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={resetSupabaseTables}
                          disabled={isResetting || tablesExist}
                          className={`md:w-auto justify-start ${tablesExist ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          {isResetting ? "Setting up..." : "Initialize Schema"}
                        </Button>

                        <Button
                          variant="destructive"
                          onClick={deleteSupabaseTables}
                          disabled={isDeleting || !tablesExist}
                          className={`md:w-auto justify-start flex items-center gap-2 ${!tablesExist ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <Trash className="h-4 w-4" />
                          {isDeleting ? "Loading..." : "Show SQL to Delete Tables"}
                        </Button>

                        <Button
                          variant="outline"
                          onClick={clearTableData}
                          disabled={isClearing || !tablesExist}
                          className={`md:w-auto justify-start flex items-center gap-2 ${!tablesExist ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <Eraser className="h-4 w-4" />
                          {isClearing ? "Clearing..." : "Clear All Data"}
                        </Button>
                      </div>

                      {!supabaseUrl || !supabaseKey ? (
                        <Alert className="bg-amber-50 text-amber-800 border-amber-200">
                          <AlertCircle className="h-5 w-5" />
                          <AlertDescription>
                            Please enter both Supabase URL and key before attempting to manage tables.
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </div>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    onClick={saveSettings}
                    disabled={isSaving}
                    className="w-full md:w-auto"
                  >
                    {isSaving ? "Saving..." : "Save Settings"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="themes">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Theme Settings
              </CardTitle>
              <CardDescription>
                Customize the look and feel of the application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="theme-select">Color Theme</Label>
                  <Select
                    value={theme}
                    onValueChange={setTheme}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark" className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700"></div>
                          Dark Blue (Default)
                        </span>
                      </SelectItem>
                      <SelectItem value="matrix" className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-black border border-green-500"></div>
                          Matrix
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-1">
                    Choose a color theme for the application interface.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Dialog */}
      <Dialog open={showHelpDialog} onOpenChange={setShowHelpDialog}>
        <DialogContent className="max-w-md md:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="h-5 w-5" />
              How to Configure Supabase
            </DialogTitle>
            <DialogDescription>
              Follow these steps to set up your Supabase connection
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <ol className="list-decimal list-inside space-y-4 mt-3">
              <li>
                <span className="font-medium">Create a Supabase account</span>
                <p className="ml-5 text-gray-700">If you don't have one already, sign up at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">https://supabase.com</a></p>
              </li>
              <li>
                <span className="font-medium">Create a new project</span>
                <p className="ml-5 text-gray-700">From your Supabase dashboard, click "New Project" and follow the setup wizard</p>
              </li>
              <li>
                <span className="font-medium">Get your project API credentials</span>
                <p className="ml-5 text-gray-700">In your project dashboard, go to Settings → API</p>
                <p className="ml-5 text-gray-700">Under "Project URL", copy the URL (e.g., <code>https://abcdefghijklm.supabase.co</code>)</p>
                <p className="ml-5 text-gray-700">Under "Project API keys", copy the "anon" public key</p>
              </li>
              <li>
                <span className="font-medium">Enter credentials in this form</span>
                <p className="ml-5 text-gray-700">Paste the URL and anon key into the fields above</p>
              </li>
              <li>
                <span className="font-medium">Save your settings</span>
                <p className="ml-5 text-gray-700">Click "Save Settings" button to save your Supabase configuration</p>
              </li>
              <li>
                <span className="font-medium">Initialize the database schema</span>
                <p className="ml-5 text-gray-700">After saving, click the "Initialize Schema" button</p>
                <p className="ml-5 text-gray-700">If you see SQL commands, you'll need to run them in the Supabase SQL Editor (Project → SQL Editor)</p>
              </li>
            </ol>
          </div>

          <div className="flex justify-end mt-6">
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* SQL Commands Dialog */}
      <Dialog open={showSqlCommands} onOpenChange={setShowSqlCommands}>
        <DialogContent className="max-w-md md:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Database className="h-5 w-5" />
              SQL Commands
            </DialogTitle>
            <DialogDescription>
              Run these commands in the Supabase SQL Editor
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <div className="bg-gray-900 text-gray-100 p-3 rounded overflow-auto max-h-[60vh] text-sm">
              <pre className="whitespace-pre-wrap break-all">{sqlCommands ? sqlCommands.join('\n\n') : ''}</pre>
            </div>
          </div>

          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => {
                if (sqlCommands) {
                  navigator.clipboard.writeText(sqlCommands.join('\n\n'));
                  addNotification('success', 'SQL commands copied to clipboard');
                }
              }}
            >
              Copy to Clipboard
            </Button>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Clear Data Dialog */}
      <Dialog open={showConfirmClearDialog} onOpenChange={setShowConfirmClearDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Data Deletion
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to clear all data from the tables? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowConfirmClearDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmClearData}>
              Yes, Clear All Data
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection Success Dialog */}
      <Dialog open={showConnectionSuccessDialog} onOpenChange={setShowConnectionSuccessDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Check className="h-5 w-5 text-green-500" />
              Connection Successful
            </DialogTitle>
            <DialogDescription>
              Your Supabase connection is working correctly, but you need to initialize the database schema.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4">
            <p className="text-sm mb-4">
              Initialize your database schema to start using Supabase storage.
            </p>

            <div className="flex justify-between">
              <Button
                variant="default"
                onClick={() => {
                  setShowConnectionSuccessDialog(false);
                  initializeSchema();
                }}
                disabled={isInitializing}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                {isInitializing ? "Initializing..." : "Initialize Schema"}
              </Button>

              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 