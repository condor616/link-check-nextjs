'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Server, Database, ArrowRight, Shield, AlertCircle, Loader2, RefreshCcw, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface SetupStatus {
    isSetup: boolean;
    reason?: string;
    storageType?: 'sqlite' | 'supabase';
}

export default function SetupWizard({ onComplete }: { onComplete: () => void }) {
    const [step, setStep] = useState(1);
    const [storageType, setStorageType] = useState<'sqlite' | 'supabase'>('sqlite');
    const [supabaseUrl, setSupabaseUrl] = useState('');
    const [supabaseKey, setSupabaseKey] = useState('');
    const [isInitializing, setIsInitializing] = useState(false);
    const [setupError, setSetupError] = useState<string | null>(null);
    const [sqlCommands, setSqlCommands] = useState<string[]>([]);

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleStorageSelect = (type: 'sqlite' | 'supabase') => {
        setStorageType(type);
        setStep(2);

        // If Supabase, preset the SQL commands so they are ready
        if (type === 'supabase') {
            setSqlCommands([
                `CREATE TABLE IF NOT EXISTS scan_configs (id TEXT PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, config JSONB NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`,
                `CREATE TABLE IF NOT EXISTS scan_history (id TEXT PRIMARY KEY, scan_url TEXT NOT NULL, scan_date TIMESTAMP WITH TIME ZONE NOT NULL, duration_seconds NUMERIC NOT NULL, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, config JSONB NOT NULL, results JSONB NOT NULL);`,
                `CREATE TABLE IF NOT EXISTS scan_jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL, scan_url TEXT NOT NULL, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), started_at TIMESTAMP WITH TIME ZONE, completed_at TIMESTAMP WITH TIME ZONE, progress_percent NUMERIC DEFAULT 0, current_url TEXT, urls_scanned INTEGER DEFAULT 0, total_urls INTEGER DEFAULT 0, broken_links INTEGER DEFAULT 0, total_links INTEGER DEFAULT 0, scan_config JSONB NOT NULL, error TEXT, results JSONB, state TEXT);`
            ]);
        }
    };

    const handleInitializeSupabase = async () => {
        setIsInitializing(true);
        setSetupError(null);

        try {
            // 1. Save settings first
            const saveRes = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storageType: 'supabase',
                    supabaseUrl,
                    supabaseKey,
                }),
            });

            if (!saveRes.ok) {
                const errorData = await saveRes.json();
                throw new Error(errorData.error || 'Failed to save settings');
            }

            // 2. Initialize tables
            const initRes = await fetch('/api/supabase/setup-sql', {
                method: 'POST',
            });

            const initData = await initRes.json();

            if (initData.sql_commands) {
                setSqlCommands(initData.sql_commands);
            }

            if (initRes.status === 202) {
                // Tables need manual creation (unlikely if we have permissions, but handled)
                setSetupError(initData.error || 'Connected but tables must be created manually. See Instructions below.');
                return;
            }

            if (!initRes.ok) {
                throw new Error(initData.error || 'Failed to initialize Supabase tables');
            }

            toast.success('Supabase configured and tables initialized!');
            setStep(4);
        } catch (error: any) {
            setSetupError(error.message);
            toast.error(error.message);
        } finally {
            setIsInitializing(false);
        }
    };

    const handleInitializeSQLite = async () => {
        setIsInitializing(true);
        try {
            // For SQLite, we just ensure settings are right
            await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storageType: 'sqlite',
                }),
            });

            toast.success('Local storage configured!');
            setStep(4);
        } catch (error: any) {
            toast.error('Failed to configure SQLite');
        } finally {
            setIsInitializing(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 bg-app">
            <div className="card prof-card shadow-lg p-0 border-0 overflow-hidden" style={{ maxWidth: '900px', width: '100%' }}>
                <div className="p-1 bg-primary w-100"></div>
                <div className="p-5">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center"
                            >
                                <div className="mb-4 d-inline-block p-3 rounded-circle bg-primary bg-opacity-10 text-primary">
                                    <Shield size={48} />
                                </div>
                                <h1 className="h2 fw-bold mb-3">Welcome to Link Checker Pro</h1>
                                <p className="text-muted mb-5">
                                    Let&apos;s get your workspace ready. Choose where you want to store your scan results and history.
                                </p>

                                <div className="row g-4">
                                    <div className="col-md-6">
                                        <button
                                            onClick={() => handleStorageSelect('sqlite')}
                                            className="btn btn-outline-primary w-100 h-100 p-4 d-flex flex-column align-items-center gap-3 border-2"
                                        >
                                            <Database size={32} />
                                            <div className="text-start w-100">
                                                <div className="fw-bold">Local Storage</div>
                                                <small className="opacity-75">Fastest setup using a local SQLite file.</small>
                                            </div>
                                        </button>
                                    </div>
                                    <div className="col-md-6">
                                        <button
                                            onClick={() => handleStorageSelect('supabase')}
                                            className="btn btn-outline-primary w-100 h-100 p-4 d-flex flex-column align-items-center gap-3 border-2"
                                        >
                                            <Server size={32} />
                                            <div className="text-start w-100">
                                                <div className="fw-bold">Supabase</div>
                                                <small className="opacity-75">Cloud storage for multi-device access.</small>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && storageType === 'supabase' && (
                            <motion.div
                                key="step2-supabase"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <button onClick={handleBack} className="btn btn-link p-0 mb-4 text-decoration-none d-flex align-items-center gap-2">
                                    <ArrowRight size={16} className="rotate-180" style={{ transform: 'rotate(180deg)' }} /> Back
                                </button>
                                <h2 className="h4 fw-bold mb-3">Configure Supabase</h2>
                                <p className="text-muted mb-4">Enter your Supabase project details to connect.</p>

                                <div className="mb-3">
                                    <label className="form-label">Project URL</label>
                                    <input
                                        type="text"
                                        className="form-control form-control-lg"
                                        placeholder="https://xyz.supabase.co"
                                        value={supabaseUrl}
                                        onChange={(e) => setSupabaseUrl(e.target.value)}
                                    />
                                </div>
                                <div className="mb-4">
                                    <label className="form-label">Anon Key</label>
                                    <input
                                        type="password"
                                        className="form-control form-control-lg"
                                        placeholder="your-anon-key"
                                        value={supabaseKey}
                                        onChange={(e) => setSupabaseKey(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={handleNext}
                                    disabled={!supabaseUrl || !supabaseKey}
                                    className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                                >
                                    Verify Connection <ArrowRight size={20} />
                                </button>
                            </motion.div>
                        )}

                        {step === 3 && storageType === 'supabase' && (
                            <motion.div
                                key="step3-supabase"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center"
                            >
                                <div className="mb-4 d-inline-block p-3 rounded-circle bg-warning bg-opacity-10 text-warning">
                                    <AlertCircle size={48} />
                                </div>
                                <h2 className="h4 fw-bold mb-3 text-start">Database Initialization</h2>
                                <p className="text-muted mb-4 text-start">
                                    Supabase requires the following tables to be created in your Project SQL Editor.
                                    Copy and run the script below, then click <strong>Verify Setup</strong>.
                                </p>

                                {setupError && (
                                    <div className="alert alert-danger text-start small mb-4">
                                        <div className="d-flex gap-2">
                                            <AlertCircle size={16} className="mt-1 flex-shrink-0" />
                                            <div>{setupError}</div>
                                        </div>
                                    </div>
                                )}

                                {sqlCommands.length > 0 && (
                                    <div className="text-start mb-4">
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <p className="small fw-bold m-0">Required SQL Commands:</p>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(sqlCommands.join('\n\n'));
                                                    toast.success('SQL commands copied to clipboard');
                                                }}
                                                className="btn btn-sm btn-link p-0 text-decoration-none d-flex align-items-center gap-1"
                                            >
                                                <Copy size={12} /> Copy All
                                            </button>
                                        </div>
                                        <div className="bg-dark text-light p-3 rounded small overflow-auto border border-primary border-opacity-25 shadow-inner mb-2" style={{ maxHeight: '200px', backgroundColor: '#0f172a', fontFamily: 'var(--font-geist-mono), monospace' }}>
                                            <pre className="m-0" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', opacity: 0.9 }}>
                                                {sqlCommands.join('\n\n')}
                                            </pre>
                                        </div>
                                        <p className="small text-muted mb-0">After running the commands, click the button below to verify.</p>
                                    </div>
                                )}

                                <div className="d-grid gap-2 mb-3">
                                    <button
                                        onClick={handleInitializeSupabase}
                                        disabled={isInitializing}
                                        className="btn btn-primary btn-lg d-flex align-items-center justify-content-center gap-2"
                                    >
                                        {isInitializing ? (
                                            <>
                                                <Loader2 size={20} className="spinner-border spinner-border-sm border-0" /> Initializing...
                                            </>
                                        ) : (
                                            <>
                                                {sqlCommands.length > 0 ? (
                                                    <><RefreshCcw size={20} /> Re-verify Setup</>
                                                ) : (
                                                    <><Check size={20} /> Initialize Tables</>
                                                )}
                                            </>
                                        )}
                                    </button>
                                </div>
                                <button onClick={handleBack} disabled={isInitializing} className="btn btn-link text-muted">
                                    Wait, I need to change credentials
                                </button>
                            </motion.div>
                        )}

                        {step === 2 && storageType === 'sqlite' && (
                            <motion.div
                                key="step2-sqlite"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="text-center"
                            >
                                <div className="mb-4 d-inline-block p-3 rounded-circle bg-success bg-opacity-10 text-success">
                                    <Database size={48} />
                                </div>
                                <h2 className="h4 fw-bold mb-3">Ready to go Local</h2>
                                <p className="text-muted mb-5">
                                    Great choice! We will use a local SQLite database file to store everything. This is zero-config and super fast.
                                </p>

                                <button
                                    onClick={handleInitializeSQLite}
                                    disabled={isInitializing}
                                    className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2"
                                >
                                    {isInitializing ? 'Preparing...' : 'Finish Setup'} <Check size={20} />
                                </button>
                                <button onClick={handleBack} disabled={isInitializing} className="btn btn-link text-muted mt-3">
                                    Back
                                </button>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center"
                            >
                                <div className="mb-4 d-inline-block p-3 rounded-circle bg-success text-white scale-in">
                                    <Check size={48} />
                                </div>
                                <h1 className="h2 fw-bold mb-3">All Set!</h1>
                                <p className="text-muted mb-5">
                                    Your storage has been configured successfully. You&apos;re ready to start hunting down those 404s.
                                </p>

                                <button
                                    onClick={onComplete}
                                    className="btn btn-primary btn-lg w-100 shadow-sm"
                                >
                                    Launch Dashboard
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
