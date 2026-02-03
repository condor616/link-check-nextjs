'use client';

import { useState, useEffect } from 'react';
import { Database, HelpCircle, Trash, RefreshCw, Eraser, AlertCircle, Check, Copy, Globe } from "lucide-react";
import { useNotification } from "@/components/NotificationContext";

import { AnimatedCard } from "@/components/AnimatedCard";
import { AnimatedButton } from "@/components/AnimatedButton";
import { SimpleModal } from "@/components/SimpleModal";

type StorageType = 'file' | 'sqlite' | 'supabase';

export function SettingsClient() {
  const [activeTab, setActiveTab] = useState("site-config");
  const [storageType, setStorageType] = useState<StorageType>('sqlite');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [appUrl, setAppUrl] = useState('http://localhost:3000');
  const [maxScansPerMinute, setMaxScansPerMinute] = useState(200);
  const [savedMaxScansPerMinute, setSavedMaxScansPerMinute] = useState(200);
  const [isSaving, setIsSaving] = useState(false);
  const [showHighRateWarning, setShowHighRateWarning] = useState(false);
  const [pendingMaxScans, setPendingMaxScans] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isResettingDB, setIsResettingDB] = useState(false);
  const [showConfirmResetDB, setShowConfirmResetDB] = useState(false);
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
  const [envDefaults, setEnvDefaults] = useState<{ supabaseUrl?: string, supabaseKey?: string } | null>(null);

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
  }, [storageType, supabaseUrl, supabaseKey]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      const statusRes = await fetch('/api/setup/status');
      const statusData = await statusRes.json();

      if (statusData.defaults) {
        setEnvDefaults(statusData.defaults);
      }

      if (response.ok) {
        const data = await response.json();
        const type = data.storageType || 'sqlite';
        setStorageType(type === 'file' ? 'sqlite' : type);

        // Use saved settings if they exist, otherwise fallback to env defaults if we're in that mode
        setSupabaseUrl(data.supabaseUrl || (type === 'supabase' ? statusData.defaults?.supabaseUrl : '') || '');
        setSupabaseKey(data.supabaseKey || (type === 'supabase' ? statusData.defaults?.supabaseKey : '') || '');
        setAppUrl(data.appUrl || 'http://localhost:3000');
        setMaxScansPerMinute(data.maxScansPerMinute || 200);
        setSavedMaxScansPerMinute(data.maxScansPerMinute || 200);
      } else {
        // If settings don't exist yet, we'll use defaults
        console.log('Using default settings');
        if (statusData.defaults?.supabaseUrl) setSupabaseUrl(statusData.defaults.supabaseUrl);
        if (statusData.defaults?.supabaseKey) setSupabaseKey(statusData.defaults.supabaseKey);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async (skipWarning = false) => {
    // Check for high rate limit if not skipping warning
    if (!skipWarning && maxScansPerMinute > 200) {
      setShowHighRateWarning(true);
      return;
    }

    setIsSaving(true);

    try {
      // Validate Supabase URL and key if selecting Supabase storage
      if (storageType === 'supabase') {
        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase URL and key are required when using Supabase storage');
        }

        // Basic URL validation
        if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
          throw new Error('Supabase URL should start with http:// or https://');
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
          appUrl,
          maxScansPerMinute,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      addNotification('success', 'Settings saved successfully');
      setSavedMaxScansPerMinute(maxScansPerMinute);

      // After saving, check if initialization is needed for the chosen storage
      if (storageType === 'sqlite') {
        const initRes = await fetch('/api/setup/sqlite', { method: 'POST' });
        if (!initRes.ok) {
          const initData = await initRes.json();
          addNotification('warning', `Settings saved, but SQLite initialization failed: ${initData.details || 'Unknown error'}. You might need to check your logs.`);
        } else {
          addNotification('success', 'Local database initialized successfully.');
        }
      } else if (storageType === 'supabase') {
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
      const tableNames = ['scan_configs', 'scan_history', 'scan_jobs'];
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
          appUrl,
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
      const tableNames = ['scan_configs', 'scan_history', 'scan_jobs'];
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
          appUrl,
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

  const resetLocalDatabase = async () => {
    setShowConfirmResetDB(true);
  };

  const confirmResetDatabase = async () => {
    setShowConfirmResetDB(false);
    setIsResettingDB(true);

    try {
      const response = await fetch('/api/setup/reset-db', {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset database');
      }

      addNotification('success', 'Database reset successfully. Redirecting to setup...');

      // Reload the page after a short delay to trigger the Setup Wizard
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
    } catch (error) {
      console.error('Error resetting database:', error);
      addNotification('error', error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsResettingDB(false);
    }
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
    <div className="w-100 py-4">
      <div className="mb-4">
        <h1 className="display-5 fw-bold mb-2">Settings</h1>
        <p className="text-secondary fs-5">
          Configure your application settings
        </p>
      </div>

      <div className="mb-4">
        <div className="nav nav-pills d-flex gap-2 pb-2 overflow-auto" role="tablist">
          <button
            className={`nav-link d-flex align-items-center gap-2 px-4 py-2 ${activeTab === 'site-config' ? 'active shadow-sm' : 'bg-body-secondary text-body'}`}
            onClick={() => setActiveTab('site-config')}
          >
            <Globe className="h-4 w-4" />
            Site Configuration
          </button>
          <button
            className={`nav-link d-flex align-items-center gap-2 px-4 py-2 ${activeTab === 'data-storage' ? 'active shadow-sm' : 'bg-body-secondary text-body'}`}
            onClick={() => setActiveTab('data-storage')}
          >
            <Database className="h-4 w-4" />
            Data Storage
          </button>
        </div>
      </div>

      <div className="w-100">
        {activeTab === 'site-config' && (
          <AnimatedCard>
            <div className="d-flex align-items-center gap-2 mb-4">
              <div className="p-2 bg-primary bg-opacity-10 rounded">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="card-title mb-0">Site Configuration</h3>
                <p className="text-secondary small mb-0">Configure your application's base URL for SEO and social sharing</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="app-url" className="form-label fw-medium">App URL / Base URL</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <Globe size={18} className="text-secondary" />
                </span>
                <input
                  id="app-url"
                  type="url"
                  className="form-control"
                  value={appUrl}
                  onChange={(e) => setAppUrl(e.target.value)}
                  placeholder="https://your-domain.com"
                />
              </div>
              <div className="form-text mt-2">
                This URL is used for generating sitemaps, robots.txt, and SEO metadata like canonical links and Open Graph tags.
                <br />
                <span className="text-primary fw-bold">Current: {appUrl}</span>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="max-scans" className="form-label fw-medium">Max Scans Per Minute</label>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <RefreshCw size={18} className="text-secondary" />
                </span>
                <input
                  id="max-scans"
                  type="number"
                  className="form-control"
                  value={maxScansPerMinute}
                  onChange={(e) => setMaxScansPerMinute(parseInt(e.target.value) || 0)}
                  placeholder="200"
                  min="1"
                />
              </div>
              <div className="form-text mt-2">
                Limit the number of requests per minute to avoid being blocked by servers (Rate Limiting).
                <br />
                Default: <span className="fw-bold">200</span> (approx 3.3 requests/second).
                <span className="text-warning ms-1">Values above 200 may increase risk of blocking.</span>
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <AnimatedButton
                onClick={() => saveSettings(false)}
                disabled={isSaving}
                size="lg"
                className="px-4"
              >
                {isSaving ? "Saving..." : "Save Configuration"}
              </AnimatedButton>
            </div>
          </AnimatedCard>
        )}

        {activeTab === 'data-storage' && (
          <AnimatedCard>
            <div className="d-flex align-items-center gap-2 mb-4">
              <div className="p-2 bg-primary bg-opacity-10 rounded">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="card-title mb-0">Data Storage Configuration</h3>
                <p className="text-secondary small mb-0">Choose how you want to store your scan data and configurations</p>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="storage-type" className="form-label fw-medium d-flex justify-content-between align-items-center">
                <span>Storage Type</span>
              </label>
              <select
                id="storage-type"
                className="form-select form-select-lg"
                value={storageType}
                onChange={(e) => {
                  const newType = e.target.value as StorageType;
                  setStorageType(newType);

                  if (newType === 'supabase') {
                    const urlToUse = supabaseUrl || envDefaults?.supabaseUrl;
                    const keyToUse = supabaseKey || envDefaults?.supabaseKey;

                    if (urlToUse && urlToUse !== supabaseUrl) {
                      setSupabaseUrl(urlToUse);
                      addNotification('info', 'Supabase URL pre-populated from .env');
                    }
                    if (keyToUse && keyToUse !== supabaseKey) {
                      setSupabaseKey(keyToUse);
                      addNotification('info', 'Supabase Key pre-populated from .env');
                    }
                  }
                }}
              >
                <option value="sqlite">Local Database (SQLite)</option>
                <option value="supabase">Supabase Database</option>
              </select>
              <div className="form-text mt-2">
                {(storageType === 'file' || storageType === 'sqlite')
                  ? 'Data will be stored in a local SQLite database for maximum privacy and offline access.'
                  : 'Data will be stored in a Supabase cloud database, enabling access from multiple devices.'}
              </div>
            </div>

            {storageType === 'supabase' && (
              <div className="card border rounded bg-light mb-4 shadow-sm">
                <div className="card-body">
                  <h5 className="mb-3">Supabase Initialization</h5>
                  <div className="mb-3">
                    <label htmlFor="supabase-url" className="form-label d-flex justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <span>Supabase URL <span className="text-danger">*</span></span>
                        {envDefaults?.supabaseUrl && supabaseUrl === envDefaults.supabaseUrl && (
                          <span className="badge bg-success-subtle text-success small border border-success-subtle">Detected from .env</span>
                        )}
                      </div>
                      {(!supabaseUrl || !supabaseKey) && (
                        <button
                          className="btn btn-link btn-sm p-0 text-decoration-none d-flex align-items-center gap-1"
                          onClick={() => setShowHelpDialog(true)}
                        >
                          <HelpCircle className="h-4 w-4" />
                          Need help?
                        </button>
                      )}
                    </label>
                    <input
                      id="supabase-url"
                      type="text"
                      className="form-control"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                    />
                    <div className="form-text">Your Supabase project URL</div>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="supabase-key" className="form-label d-flex justify-content-between">
                      <div className="d-flex align-items-center gap-2">
                        <span>Supabase Anon Key <span className="text-danger">*</span></span>
                        {envDefaults?.supabaseKey && supabaseKey === envDefaults.supabaseKey && (
                          <span className="badge bg-success-subtle text-success small border border-success-subtle">Detected from .env</span>
                        )}
                      </div>
                    </label>
                    <input
                      id="supabase-key"
                      type="password"
                      className="form-control"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="Your Supabase anon key"
                    />
                    <div className="form-text">The anon/public API key for your Supabase project</div>
                  </div>

                  <div className="d-flex flex-wrap gap-2 mb-3">
                    <AnimatedButton
                      variant="outline-secondary" // Changed from outline to outline-secondary
                      onClick={testSupabaseConnection}
                      disabled={isTesting || !supabaseUrl || !supabaseKey}
                      size="sm"
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isTesting ? "animate-spin" : ""}`} />
                      {isTesting ? "Testing..." : "Test Connection"}
                    </AnimatedButton>
                  </div>

                  {connectionTestResult && !connectionTestResult.success && (
                    <div className="alert alert-danger d-flex align-items-center gap-2 mb-3" role="alert">
                      <AlertCircle className="h-5 w-5 flex-shrink-0" />
                      <div>{connectionTestResult.message}</div>
                    </div>
                  )}

                  <div className="border-top pt-3 mt-3">
                    <h6 className="fw-bold mb-3">Database Management</h6>
                    <div className="d-flex flex-wrap gap-2">
                      <AnimatedButton
                        variant="outline-primary" // Changed from outline to outline-primary
                        onClick={resetSupabaseTables}
                        disabled={isResetting || tablesExist}
                        className={tablesExist ? "opacity-50" : ""}
                        size="sm"
                      >
                        {isResetting ? "Setting up..." : "Initialize Schema"}
                      </AnimatedButton>

                      <AnimatedButton
                        variant="danger" // Changed from destructive to danger
                        onClick={deleteSupabaseTables}
                        disabled={isDeleting || !tablesExist}
                        className={`gap-2 ${!tablesExist ? "opacity-50" : ""}`}
                        size="sm"
                      >
                        <Trash className="h-4 w-4" />
                        {isDeleting ? "Loading..." : "Show SQL to Delete Tables"}
                      </AnimatedButton>

                      <AnimatedButton
                        variant="outline-secondary" // Changed from outline to outline-secondary
                        onClick={clearTableData}
                        disabled={isClearing || !tablesExist}
                        className={`gap-2 ${!tablesExist ? "opacity-50" : ""}`}
                        size="sm"
                      >
                        <Eraser className="h-4 w-4" />
                        {isClearing ? "Clearing..." : "Clear All Data"}
                      </AnimatedButton>
                    </div>

                    {!supabaseUrl || !supabaseKey ? (
                      <div className="alert alert-warning d-flex align-items-center gap-2 mt-3 mb-0">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <div className="small">Please enter both Supabase URL and key before attempting to manage tables.</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            <div className="border-top pt-4 mt-4">
              <h5 className="text-danger mb-3 d-flex align-items-center gap-2">
                <AlertCircle size={20} /> Danger Zone
              </h5>
              <div className="card border-danger border-opacity-25 rounded bg-danger bg-opacity-10 shadow-sm">
                <div className="card-body">
                  <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div>
                      <h6 className="fw-bold mb-1">Reset Application Database</h6>
                      <p className="small text-secondary mb-0">
                        This will delete all local scan history, configurations, and settings.
                        You will be redirected to the Setup Wizard to start fresh.
                      </p>
                    </div>
                    <AnimatedButton
                      variant="danger"
                      onClick={resetLocalDatabase}
                      disabled={isResettingDB}
                      className="flex-shrink-0"
                    >
                      <Trash className="h-4 w-4 me-2" />
                      {isResettingDB ? "Resetting..." : "Reset Everything"}
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            </div>

            <div className="d-flex justify-content-end mt-4">
              <AnimatedButton
                onClick={() => saveSettings(false)}
                disabled={isSaving}
                size="lg"
                className="px-4"
              >
                {isSaving ? "Saving..." : "Save Settings"}
              </AnimatedButton>
            </div>
          </AnimatedCard>
        )}


      </div>

      {/* Help Dialog */}
      <SimpleModal
        isOpen={showHelpDialog}
        onClose={() => setShowHelpDialog(false)}
        title="How to Configure Supabase"
        footer={
          <div className="d-flex justify-content-end">
            <AnimatedButton variant="secondary" onClick={() => setShowHelpDialog(false)}>
              Close
            </AnimatedButton>
          </div>
        }
      >
        <div className="mt-2">
          <p className="text-secondary mb-3">Follow these steps to set up your Supabase connection:</p>
          <ol className="list-group list-group-numbered list-group-flush">
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Create a Supabase account</span>
                <p className="small text-secondary mb-0">If you don't have one already, sign up at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none hover:underline">https://supabase.com</a></p>
              </div>
            </li>
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Create a new project</span>
                <p className="small text-secondary mb-0">From your Supabase dashboard, click "New Project" and follow the setup wizard</p>
              </div>
            </li>
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Get your project API credentials</span>
                <p className="small text-secondary mb-1">In your project dashboard, go to Settings → API</p>
                <p className="small text-secondary mb-1">Under "Project URL", copy the URL (e.g., <code>https://abcdefghijklm.supabase.co</code>)</p>
                <p className="small text-secondary mb-0">Under "Project API keys", copy the "anon" public key</p>
              </div>
            </li>
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Enter credentials in this form</span>
                <p className="small text-secondary mb-0">Paste the URL and anon key into the fields above</p>
              </div>
            </li>
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Save your settings</span>
                <p className="small text-secondary mb-0">Click "Save Settings" button to save your Supabase configuration</p>
              </div>
            </li>
            <li className="list-group-item bg-transparent">
              <div className="ms-2">
                <span className="fw-medium">Initialize the database schema</span>
                <p className="small text-secondary mb-1">After saving, click the "Initialize Schema" button</p>
                <p className="small text-secondary mb-0">If you see SQL commands, you'll need to run them in the Supabase SQL Editor (Project → SQL Editor)</p>
              </div>
            </li>
          </ol>
        </div>
      </SimpleModal>

      {/* SQL Commands Dialog */}
      <SimpleModal
        isOpen={showSqlCommands}
        onClose={() => setShowSqlCommands(false)}
        title="SQL Commands"
        size="lg"
        footer={
          <div className="d-flex justify-content-between w-100">
            <AnimatedButton
              variant="outline-primary"
              onClick={() => {
                if (sqlCommands) {
                  navigator.clipboard.writeText(sqlCommands.join('\n\n'));
                  addNotification('success', 'SQL commands copied to clipboard');
                }
              }}
              className="d-flex align-items-center gap-2"
            >
              <Copy className="h-4 w-4" />
              Copy to Clipboard
            </AnimatedButton>
            <AnimatedButton variant="secondary" onClick={() => setShowSqlCommands(false)}>
              Close
            </AnimatedButton>
          </div>
        }
      >
        <div className="mb-3">
          <p className="text-secondary">Run these commands in the Supabase SQL Editor:</p>
          <div className="bg-dark text-light p-3 rounded border overflow-auto" style={{ maxHeight: '60vh' }}>
            <pre className="mb-0 small whitespace-pre-wrap break-all">{sqlCommands ? sqlCommands.join('\n\n') : ''}</pre>
          </div>
        </div>
      </SimpleModal>

      {/* Confirm Clear Data Dialog */}
      <SimpleModal
        isOpen={showConfirmClearDialog}
        onClose={() => setShowConfirmClearDialog(false)}
        title="Confirm Data Deletion"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <AnimatedButton variant="secondary" onClick={() => setShowConfirmClearDialog(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton variant="danger" onClick={confirmClearData}>
              Yes, Clear All Data
            </AnimatedButton>
          </div>
        }
      >
        <div className="d-flex align-items-center gap-3">
          <AlertCircle className="h-10 w-10 text-danger" />
          <p className="mb-0">Are you sure you want to clear all data from the tables? This action cannot be undone.</p>
        </div>
      </SimpleModal>

      {/* Connection Success Dialog */}
      <SimpleModal
        isOpen={showConnectionSuccessDialog}
        onClose={() => setShowConnectionSuccessDialog(false)}
        title="Connection Successful"
        footer={
          <div className="d-flex justify-content-between w-100">
            <AnimatedButton
              variant="primary"
              onClick={() => {
                setShowConnectionSuccessDialog(false);
                initializeSchema();
              }}
              disabled={isInitializing}
              className="gap-2"
            >
              <Database className="h-4 w-4" />
              {isInitializing ? "Initializing..." : "Initialize Schema"}
            </AnimatedButton>

            <AnimatedButton variant="secondary" onClick={() => setShowConnectionSuccessDialog(false)}>
              Cancel
            </AnimatedButton>
          </div>
        }
      >
        <div className="d-flex flex-column gap-3">
          <div className="d-flex align-items-center gap-2 text-success">
            <Check className="h-5 w-5" />
            <span className="fw-bold">Your Supabase connection is working correctly!</span>
          </div>
          <p className="mb-0">However, you still need to initialize the database schema to start using Supabase storage.</p>
        </div>
      </SimpleModal>

      {/* Confirm Reset DB Dialog */}
      <SimpleModal
        isOpen={showConfirmResetDB}
        onClose={() => setShowConfirmResetDB(false)}
        title="CRITICAL: Reset Database?"
        footer={
          <div className="d-flex justify-content-end gap-2">
            <AnimatedButton variant="secondary" onClick={() => setShowConfirmResetDB(false)}>
              Cancel
            </AnimatedButton>
            <AnimatedButton variant="danger" onClick={confirmResetDatabase}>
              Yes, Delete Everything
            </AnimatedButton>
          </div>
        }
      >
        <div className="d-flex align-items-center gap-3">
          <AlertCircle className="h-10 w-10 text-danger" />
          <div>
            <p className="fw-bold text-danger mb-1">This action is irreversible!</p>
            <p className="mb-0">This will delete ALL scans, configs, and application settings. The app will restart in "fresh installation" mode.</p>
          </div>
        </div>
      </SimpleModal>
      <SimpleModal
        isOpen={showHighRateWarning}
        onClose={() => setShowHighRateWarning(false)}
        title="High Scan Rate Warning"
        size="md"
      >
        <div className="p-1">
          <div className="d-flex align-items-start gap-3 mb-4">
            <div className="p-3 bg-warning bg-opacity-10 rounded-circle flex-shrink-0">
              <AlertCircle className="h-6 w-6 text-warning" />
            </div>
            <div>
              <h5 className="mb-2 fw-bold text-dark">Potential Blocking Risk</h5>
              <p className="text-secondary mb-0">
                You have set the scan rate to <strong>{maxScansPerMinute} scans per minute</strong> ({Math.round(maxScansPerMinute / 60 * 10) / 10} requests/second).
              </p>
            </div>
          </div>

          <div className="alert alert-warning border-warning border-opacity-25 bg-warning bg-opacity-10 mb-4">
            <h6 className="fw-bold mb-2 d-flex align-items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Why this might be an issue:
            </h6>
            <p className="mb-0 small">
              Many servers and CDNs (like Cloudflare) construe high-frequency requests as a DDoS attack and may temporarily or permanently blacklist your IP address.
            </p>
          </div>

          <p className="mb-4 text-secondary">
            Are you sure you want to proceed with this configuration?
          </p>

          <div className="d-flex justify-content-end gap-2">
            <AnimatedButton
              variant="outline-secondary"
              onClick={() => {
                setShowHighRateWarning(false);
                setMaxScansPerMinute(savedMaxScansPerMinute);
              }}
            >
              Cancel
            </AnimatedButton>
            <AnimatedButton
              variant="warning"
              onClick={() => {
                setShowHighRateWarning(false);
                saveSettings(true);
              }}
            >
              <div className="d-flex align-items-center gap-2">
                <Check className="h-4 w-4" />
                Confirm High Rate
              </div>
            </AnimatedButton>
          </div>
        </div>
      </SimpleModal>
    </div >
  );
}