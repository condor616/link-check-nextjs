'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Check, Database, FileJson, HelpCircle, Trash, X, RefreshCw, Eraser } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useNotification } from "@/components/NotificationContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose
} from "@/components/ui/dialog";

type StorageType = 'file' | 'supabase';

export default function SettingsPage() {
  const [storageType, setStorageType] = useState<StorageType>('file');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [sqlCommands, setSqlCommands] = useState<string[] | null>(null);
  const [showSqlCommands, setShowSqlCommands] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [tablesExist, setTablesExist] = useState(false);
  const [isCheckingTables, setIsCheckingTables] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  
  // Get notification context to show global notifications
  const { addNotification } = useNotification();

  // Load settings on page load
  useEffect(() => {
    fetchSettings();
  }, []);

  // Check if tables exist whenever Supabase credentials change or after operations
  useEffect(() => {
    if (storageType === 'supabase' && supabaseUrl && supabaseKey) {
      checkTablesExist();
    }
  }, [storageType, supabaseUrl, supabaseKey, resetSuccess, deleteSuccess, clearSuccess]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      
      if (response.ok) {
        const data = await response.json();
        setStorageType(data.storageType || 'file');
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
    setSaveSuccess(false);
    setSaveError(null);

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

      setSaveSuccess(true);
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
      setSaveError(error instanceof Error ? error.message : 'Unknown error occurred');
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
      setConnectionTestResult({
        success: false,
        message: 'Please enter both Supabase URL and key before testing connection'
      });
      return;
    }
    
    setIsTesting(true);
    setConnectionTestResult(null);
    
    try {
      // Make a simple request to test the connection
      const response = await fetch('/api/supabase/setup-sql', {
        method: 'POST',
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
      
      setConnectionTestResult({
        success: true,
        message: 'Connection successful!'
      });
      
    } catch (error) {
      console.error('Connection test error:', error);
      setConnectionTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown connection error'
      });
    } finally {
      setIsTesting(false);
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
      setResetError('Supabase is not properly configured. Please enter URL and key first.');
      return;
    }

    setIsResetting(true);
    setResetSuccess(false);
    setResetError(null);
    setSqlCommands(null);
    setShowSqlCommands(false);

    try {
      const response = await fetch('/api/supabase/setup-sql', {
        method: 'POST',
      });

      const data = await response.json();

      if (response.status === 202) {
        // Tables need to be created manually
        setSqlCommands(data.sql_commands);
        setShowSqlCommands(true);
        setResetError('Tables do not exist in your Supabase database. Please run the provided SQL commands in the Supabase SQL editor.');
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

      setResetSuccess(true);
      addNotification('success', 'Supabase tables were initialized successfully');
      
      // After successful reset, update tablesExist
      setTablesExist(true);
    } catch (error) {
      console.error('Error resetting tables:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setResetError(errorMessage);
      addNotification('error', `Failed to initialize tables: ${errorMessage}`);
    } finally {
      setIsResetting(false);
    }
  };

  const deleteSupabaseTables = async () => {
    // First check if Supabase is configured
    if (!checkSupabaseConfig()) {
      addNotification('error', 'Please configure Supabase URL and key before attempting to delete tables');
      setDeleteError('Supabase is not properly configured. Please enter URL and key first.');
      return;
    }

    setIsDeleting(true);
    setDeleteSuccess(false);
    setDeleteError(null);
    setSqlCommands(null);
    setShowSqlCommands(false);

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
        setDeleteSuccess(true);
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
      setDeleteError(errorMessage);
      addNotification('error', `Failed to get SQL commands: ${errorMessage}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  const clearTableData = async () => {
    // First check if Supabase is configured
    if (!checkSupabaseConfig()) {
      addNotification('error', 'Please configure Supabase URL and key before clearing data');
      setClearError('Supabase is not properly configured. Please enter URL and key first.');
      return;
    }

    if (!confirm('Are you sure you want to clear all data from the tables? This action cannot be undone.')) {
      return;
    }

    setIsClearing(true);
    setClearSuccess(false);
    setClearError(null);

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
          setClearError('No tables exist to clear data from.');
          addNotification('info', 'No tables exist to clear data from.');
          return;
        }
        
        throw new Error(data.error || 'Failed to clear data from Supabase tables');
      }

      setClearSuccess(true);
      addNotification('success', 'Data was successfully cleared from all tables');
    } catch (error) {
      console.error('Error clearing data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setClearError(errorMessage);
      addNotification('error', `Failed to clear data: ${errorMessage}`);
    } finally {
      setIsClearing(false);
    }
  };

  const SqlCommandsDisplay = () => {
    if (!showSqlCommands || !sqlCommands) return null;
    
    return (
      <div className="mt-4 p-4 border rounded bg-gray-50">
        <h4 className="font-medium mb-2">SQL Commands to Run in Supabase</h4>
        <p className="text-sm mb-3">
          Copy and run these commands in the Supabase SQL Editor to delete your tables:
        </p>
        <div className="bg-gray-900 text-gray-100 p-3 rounded overflow-x-auto text-sm">
          <pre>{sqlCommands.join('\n\n')}</pre>
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(sqlCommands.join('\n\n'));
              addNotification('success', 'SQL commands copied to clipboard');
            }}
          >
            Copy to Clipboard
          </Button>
          <a 
            href="https://app.supabase.com/" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center h-9 px-4 py-2 text-sm font-medium border rounded-md border-input bg-background hover:bg-accent hover:text-accent-foreground"
          >
            Open Supabase
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSqlCommands(false)}
          >
            Hide
          </Button>
        </div>
      </div>
    );
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
                      <SelectItem value="file" className="flex items-center gap-2">
                        <span className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" /> 
                          File-based Storage
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
                    {storageType === 'file'
                      ? 'Data will be stored in local JSON files'
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
                      
                      {connectionTestResult && (
                        <Alert 
                          className={`mt-2 ${connectionTestResult.success 
                            ? "bg-green-50 text-green-800 border-green-200" 
                            : "bg-red-50 text-red-800 border-red-200"}`}
                        >
                          {connectionTestResult.success 
                            ? <Check className="h-5 w-5" />
                            : <AlertCircle className="h-5 w-5" />
                          }
                          <AlertDescription>
                            {connectionTestResult.message}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>

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

                      {resetSuccess && (
                        <Alert className="bg-green-50 text-green-800 border-green-200">
                          <Check className="h-5 w-5" />
                          <AlertDescription>
                            Supabase tables were successfully initialized/reset.
                          </AlertDescription>
                        </Alert>
                      )}

                      {resetError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-5 w-5" />
                          <AlertDescription>{resetError}</AlertDescription>
                        </Alert>
                      )}

                      <SqlCommandsDisplay />

                      {deleteSuccess && (
                        <Alert className="bg-green-50 text-green-800 border-green-200">
                          <Check className="h-5 w-5" />
                          <AlertDescription>
                            No tables found in your Supabase database.
                          </AlertDescription>
                        </Alert>
                      )}

                      {deleteError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-5 w-5" />
                          <AlertDescription>{deleteError}</AlertDescription>
                        </Alert>
                      )}
                      
                      {clearSuccess && (
                        <Alert className="bg-green-50 text-green-800 border-green-200">
                          <Check className="h-5 w-5" />
                          <AlertDescription>
                            Data was successfully cleared from all tables.
                          </AlertDescription>
                        </Alert>
                      )}

                      {clearError && (
                        <Alert variant="destructive">
                          <AlertCircle className="h-5 w-5" />
                          <AlertDescription>{clearError}</AlertDescription>
                        </Alert>
                      )}

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

                  {saveSuccess && (
                    <Alert className="bg-green-50 text-green-800 border-green-200 mt-4">
                      <Check className="h-5 w-5" />
                      <AlertDescription>
                        Settings saved successfully.
                      </AlertDescription>
                    </Alert>
                  )}

                  {saveError && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-5 w-5" />
                      <AlertDescription>{saveError}</AlertDescription>
                    </Alert>
                  )}
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
    </div>
  );
} 