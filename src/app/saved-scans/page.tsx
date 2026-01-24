"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Settings,
  Activity,
  ChevronRight,
  Search,
  History,
  Info,
  ExternalLink,
  Lock as LockIcon,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { SimpleModal } from '@/components/SimpleModal';
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
    <div className="w-100 py-4 fade-in-up">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-5 mt-3">
        <div>
          <h1 className="display-6 fw-bold text-dark dark:text-light mb-1">
            <LayoutGrid size={32} className="text-primary me-2 mb-1" />
            Saved <span className="text-primary">Audits</span>
          </h1>
          <p className="text-muted mb-0">Manage and relaunch your historical website scan configurations.</p>
        </div>
        <AnimatedButton onClick={() => router.push('/scan')} variant="primary" className="px-4">
          <Plus size={18} className="me-2" /> New Setup
        </AnimatedButton>
      </div>

      {loading ? (
        <div className="d-flex flex-column align-items-center justify-content-center py-5 bg-light rounded-4 dark:bg-dark border border-dashed">
          <Loader2 size={48} className="text-primary animate-spin mb-3" />
          <h5 className="text-muted fw-bold">Synchronizing Archives...</h5>
        </div>
      ) : error ? (
        isSupabaseError && settingsType === 'supabase' ? (
          <div className="alert border-0 bg-warning bg-opacity-10 dark:bg-warning dark:bg-opacity-5 p-4 rounded-4 shadow-sm border-start border-4 border-warning">
            <div className="d-flex align-items-start gap-4">
              <div className="p-3 bg-warning bg-opacity-10 rounded-circle text-warning border border-warning border-opacity-25">
                <Database size={24} />
              </div>
              <div className="space-y-4">
                <div>
                  <h3 className="h5 fw-black text-warning-emphasis mb-1">Cloud Synchronization Offline</h3>
                  <p className="text-muted small mb-3">
                    We're unable to connect to your Supabase instance. This prevents access to cloud-stored audits.
                  </p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <AnimatedButton onClick={switchToFileStorage} variant="outline-dark" size="sm">
                    <FileJson size={14} className="me-2" /> Switch to Offline Mode
                  </AnimatedButton>
                  <AnimatedButton onClick={goToSettings} variant="primary" size="sm">
                    <Settings size={14} className="me-2" /> Configure Connection
                  </AnimatedButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="alert alert-danger border-0 rounded-4 p-3 d-flex align-items-center shadow-sm">
            <AlertCircle size={20} className="me-3" />
            <div className="fw-semibold">{error}</div>
          </div>
        )
      ) : configs.length === 0 ? (
        <div className="text-center py-5 bg-light rounded-4 dark:bg-dark border border-dashed">
          <div className="mb-4 opacity-25">
            <History size={64} className="text-muted" />
          </div>
          <h4 className="fw-black text-dark dark:text-light mb-2">No Historical Data Found</h4>
          <p className="text-muted mb-4 max-w-lg mx-auto">Your configuration vault is currently empty. Define your first scan setup to start monitoring site health.</p>
          <AnimatedButton onClick={() => router.push('/scan')} variant="primary" className="px-4">
            <Plus size={18} className="me-2" /> Launch Initial Setup
          </AnimatedButton>
        </div>
      ) : (
        <div className="row g-4">
          {configs.map((config, idx) => (
            <div key={config.id} className="col-12 col-lg-6">
              <AnimatedCard delay={idx * 0.05} className="h-100 border-0 shadow-sm hover-translate-y-2 p-0 overflow-hidden bg-white dark:bg-dark">
                <div className="p-4">
                  <div className="d-flex justify-content-between align-items-start mb-3">
                    <div className="d-flex align-items-center gap-3">
                      <div className="p-3 bg-primary bg-opacity-10 text-primary rounded-4 border border-primary border-opacity-10">
                        <Activity size={24} />
                      </div>
                      <div>
                        <h4 className="h5 fw-black mb-1 text-dark dark:text-light">{config.name}</h4>
                        <div className="text-truncate text-muted small" style={{ maxWidth: '250px' }}>{config.url}</div>
                      </div>
                    </div>
                    <div className="badge rounded-pill bg-light text-muted border px-3 py-2 small fw-bold">
                      {formatDate(config.updatedAt)}
                    </div>
                  </div>

                  <div className="row g-2 mb-4">
                    <div className="col-sm-6">
                      <div className="p-3 bg-light dark:bg-dark rounded-3 border d-flex align-items-center gap-3">
                        <div className="text-primary"><LockIcon size={16} /></div>
                        <div>
                          <div className="x-small text-muted fw-bold text-uppercase opacity-75">Auth</div>
                          <div className="small fw-bold">{config.config.auth ? 'Protected' : 'Anonymous'}</div>
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="p-3 bg-light dark:bg-dark rounded-3 border d-flex align-items-center gap-3">
                        <div className="text-primary"><LayoutGrid size={16} /></div>
                        <div>
                          <div className="x-small text-muted fw-bold text-uppercase opacity-75">Depth</div>
                          <div className="small fw-bold">{config.config.depth === 0 ? 'Root Only' : `${config.config.depth} Levels Deep`}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="d-flex gap-2 mb-0 border-top pt-4">
                    <AnimatedButton
                      size="sm"
                      variant="outline-secondary"
                      onClick={() => handleEdit(config)}
                      className="flex-grow-1 border-opacity-25"
                    >
                      <Edit size={14} className="me-2" /> Configure
                    </AnimatedButton>
                    <AnimatedButton
                      size="sm"
                      variant="outline-danger"
                      onClick={() => confirmDelete(config.id)}
                      className="flex-grow-1 border-opacity-25"
                    >
                      <Trash2 size={14} className="me-2" /> Remove
                    </AnimatedButton>
                    <AnimatedButton
                      size="sm"
                      onClick={() => handleStartScan(config)}
                      variant="primary"
                      className="flex-grow-1 px-4"
                    >
                      <Play size={14} className="me-2 fill-current" /> Execute
                    </AnimatedButton>
                  </div>
                </div>
              </AnimatedCard>
            </div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <SimpleModal
        isOpen={showEditDialog}
        onClose={() => setShowEditDialog(false)}
        title="Intelligence Audit Configuration"
        size="xl"
        footer={
          <>
            <AnimatedButton variant="outline-secondary" onClick={() => setShowEditDialog(false)}>
              Discard
            </AnimatedButton>
            <AnimatedButton
              variant="primary"
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="px-4"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin me-2" />
                  Synchronizing...
                </>
              ) : (
                <>
                  <Save size={16} className="me-2" />
                  Update Vault
                </>
              )}
            </AnimatedButton>
          </>
        }
      >
        <div className="row g-4">
          <div className="col-md-6 border-end pe-md-4">
            <h6 className="x-small fw-bold text-uppercase tracking-widest text-primary mb-3">Core Parameters</h6>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">Organization / Project Name</label>
              <div className="input-group shadow-sm rounded-3 overflow-hidden">
                <span className="input-group-text bg-light border-0"><Activity size={16} /></span>
                <input
                  type="text"
                  className="form-control border-0 ps-0 shadow-none bg-light"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Corporate Landing Audit"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label small fw-bold text-muted">Primary Domain URL</label>
              <div className="input-group shadow-sm rounded-3 overflow-hidden">
                <span className="input-group-text bg-light border-0"><ExternalLink size={16} /></span>
                <input
                  type="url"
                  className="form-control border-0 ps-0 shadow-none bg-light"
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-4">
                <div className="p-3 bg-light rounded-3 border h-100 shadow-sm border-0">
                  <label className="form-label x-small fw-bold text-uppercase opacity-50 mb-1 d-block">Depth</label>
                  <input
                    type="number"
                    className="form-control form-control-sm border-0 bg-transparent p-0 fw-bold h4 mb-0 shadow-none"
                    value={editDepth}
                    onChange={(e) => setEditDepth(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 bg-light rounded-3 border h-100 shadow-sm border-0">
                  <label className="form-label x-small fw-bold text-uppercase opacity-50 mb-1 d-block">Queue</label>
                  <input
                    type="number"
                    className="form-control form-control-sm border-0 bg-transparent p-0 fw-bold h4 mb-0 shadow-none"
                    value={editConcurrency}
                    onChange={(e) => setEditConcurrency(parseInt(e.target.value) || 10)}
                  />
                </div>
              </div>
              <div className="col-4">
                <div className="p-3 bg-light rounded-3 border h-100 shadow-sm border-0">
                  <label className="form-label x-small fw-bold text-uppercase opacity-50 mb-1 d-block">Time (s)</label>
                  <input
                    type="number"
                    className="form-control form-control-sm border-0 bg-transparent p-0 fw-bold h4 mb-0 shadow-none"
                    value={editRequestTimeout}
                    onChange={(e) => setEditRequestTimeout(parseInt(e.target.value) || 30)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="sw-dedupe"
                  checked={editScanSameLinkOnce}
                  onChange={(e) => setEditScanSameLinkOnce(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="sw-dedupe">Optimal Deduplication Policy</label>
              </div>
              <div className="form-check form-switch mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="sw-external"
                  checked={editSkipExternalDomains}
                  onChange={(e) => setEditSkipExternalDomains(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="sw-external">Isolate Primary Domain Analysis</label>
              </div>
              <div className="form-check form-switch">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="sw-subdomain"
                  checked={editExcludeSubdomains}
                  onChange={(e) => setEditExcludeSubdomains(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="sw-subdomain">Enforce Strict Domain Boundary</label>
              </div>
            </div>
          </div>

          <div className="col-md-6 ps-md-4">
            <h6 className="x-small fw-bold text-uppercase tracking-widest text-primary mb-3">Security & Protocols</h6>
            <div className="p-4 rounded-4 bg-light bg-opacity-50 border border-dashed mb-4">
              <div className="form-check mb-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="chk-auth"
                  checked={editUseAuth}
                  onChange={(e) => setEditUseAuth(e.target.checked)}
                />
                <label className="form-check-label fw-bold" htmlFor="chk-auth">
                  Credential-Locked Infrastructure
                </label>
              </div>

              {editUseAuth && (
                <div className="row g-2 mt-3 p-3 bg-white rounded-3 shadow-sm">
                  <div className="col-6">
                    <label className="form-label x-small fw-bold opacity-50">Username</label>
                    <input
                      type="text"
                      className="form-control form-control-sm border-0 bg-light"
                      value={editUsername}
                      onChange={(e) => setEditUsername(e.target.value)}
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label x-small fw-bold opacity-50">Security Token</label>
                    <input
                      type="password"
                      className="form-control form-control-sm border-0 bg-light"
                      value={editPassword}
                      onChange={(e) => setEditPassword(e.target.value)}
                    />
                  </div>
                  <div className="col-12 mt-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="chk-propagate"
                        checked={editUseAuthForAllDomains}
                        onChange={(e) => setEditUseAuthForAllDomains(e.target.checked)}
                      />
                      <label className="form-check-label x-small text-muted" htmlFor="chk-propagate">
                        Propagate credentials across external nodes
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <h6 className="x-small fw-bold text-uppercase tracking-widest text-primary m-0">Inclusion Logic</h6>
              <button
                className="btn btn-link btn-sm text-primary p-0 x-small fw-bold text-decoration-none shadow-none"
                onClick={() => setEditShowAdvanced(!editShowAdvanced)}
              >
                {editShowAdvanced ? 'Simplify Architecture' : 'Refine Rulebase'}
              </button>
            </div>

            {editShowAdvanced ? (
              <div className="space-y-4">
                <div className="p-3 rounded-4 bg-white border shadow-sm">
                  <label className="form-label x-small fw-bold opacity-50 d-flex justify-content-between align-items-center mb-2">
                    <span>Exclusion Patterns (Wildcard)</span>
                    <button className="btn btn-link btn-sm p-0 text-primary border-0 shadow-none" onClick={addEditWildcardExclusion}><Plus size={14} /></button>
                  </label>
                  {editWildcardExclusions.map((pattern, idx) => (
                    <div key={idx} className="input-group input-group-sm mb-2">
                      <input
                        type="text"
                        className="form-control bg-light border-0"
                        value={pattern}
                        onChange={(e) => updateEditWildcardExclusion(idx, e.target.value)}
                        placeholder="e.g. /private/*"
                      />
                      <button className="btn btn-outline-light text-muted border-0 shadow-none" onClick={() => removeEditWildcardExclusion(idx)}><X size={14} /></button>
                    </div>
                  ))}
                </div>

                <div className="p-3 rounded-4 bg-white border shadow-sm mt-3">
                  <label className="form-label x-small fw-bold opacity-50 d-flex justify-content-between align-items-center mb-2">
                    <span>DOM Selectors (Exclude)</span>
                    <button className="btn btn-link btn-sm p-0 text-primary border-0 shadow-none" onClick={addEditCssSelector}><Plus size={14} /></button>
                  </label>
                  {editCssSelectors.map((selector, idx) => (
                    <div key={idx} className="input-group input-group-sm mb-2">
                      <input
                        type="text"
                        className="form-control bg-light border-0"
                        value={selector}
                        onChange={(e) => updateEditCssSelector(idx, e.target.value)}
                        placeholder=".nav-internal"
                      />
                      <button className="btn btn-outline-light text-muted border-0 shadow-none" onClick={() => removeEditCssSelector(idx)}><X size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-5 text-center bg-light bg-opacity-50 rounded-4 border border-dashed opacity-50">
                <Search size={32} className="text-muted mb-2" />
                <div className="x-small fw-bold text-uppercase">Standard Logic Active</div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 border-top pt-4">
          <JSONPreview
            data={{
              name: editName,
              url: editUrl,
              config: {
                depth: editDepth,
                concurrency: editConcurrency,
                requestTimeout: editRequestTimeout * 1000,
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

        {saveError && (
          <div className="alert alert-danger border-0 rounded-4 p-3 mt-4 d-flex align-items-center shadow-sm">
            <AlertCircle size={18} className="me-2" />
            <span className="small fw-bold">{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="alert alert-success border-0 rounded-4 p-3 mt-4 d-flex align-items-center shadow-sm">
            <Check size={18} className="me-2" />
            <span className="small fw-bold">Vault updated successfully. Returning to dashboard...</span>
          </div>
        )}
      </SimpleModal>

      {/* Delete Dialog */}
      <SimpleModal
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Sanitize Archive Repository"
        size="md"
        footer={
          <>
            <AnimatedButton variant="outline-secondary" onClick={() => setShowDeleteDialog(false)}>
              Abort Cleanup
            </AnimatedButton>
            <AnimatedButton
              variant="outline-danger"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4"
            >
              {isDeleting ? (
                <>
                  <Loader2 size={16} className="animate-spin me-2" />
                  Sanitizing...
                </>
              ) : (
                <>
                  <Trash2 size={16} className="me-2" />
                  Execute Deletion
                </>
              )}
            </AnimatedButton>
          </>
        }
      >
        <div className="text-center py-3">
          <div className="p-4 bg-danger bg-opacity-10 rounded-circle d-inline-block text-danger mb-4 border border-danger border-opacity-25 shadow-sm">
            <AlertCircle size={48} />
          </div>
          <h4 className="fw-black text-dark dark:text-light mb-2">Irreversible Deletion</h4>
          <p className="text-muted mb-0">
            You are about to purge this configuration from the permanent record. This action cannot be undone and will terminate all historical tracking for this scope.
          </p>

          {deleteError && (
            <div className="alert alert-danger border-0 rounded-4 p-3 mt-4 d-flex align-items-center shadow-sm">
              <AlertCircle size={18} className="me-2" />
              <span className="small fw-bold">{deleteError}</span>
            </div>
          )}
        </div>
      </SimpleModal>
    </div>
  );
} 