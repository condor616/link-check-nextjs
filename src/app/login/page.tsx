'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { Shield, ArrowRight, Loader2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [storageType, setStorageType] = useState<string>('sqlite');
    const [error, setError] = useState<string | null>(null);
    const [hasAdmin, setHasAdmin] = useState<boolean | null>(null);
    const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
    const router = useRouter();
    
    const [storageSwitched, setStorageSwitched] = useState(false);
    const [setupComplete, setSetupComplete] = useState(false);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            setStorageSwitched(params.get('storageSwitched') === 'true');
            setSetupComplete(params.get('setupComplete') === 'true');
        }
    }, []);

    React.useEffect(() => {
        const checkStatus = async () => {
            try {
                const settingsRes = await fetch('/api/settings');
                const settingsData = await settingsRes.json();
                setStorageType(settingsData.storageType);

                const statusRes = await fetch('/api/setup/status');
                const statusData = await statusRes.json();
                setHasAdmin(statusData.hasAdmin);
            } catch (err) {
                console.error('Error checking setup status:', err);
            } finally {
                setIsCheckingAdmin(false);
            }
        };
        checkStatus();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const result = await signIn('credentials', {
                email,
                password,
                redirect: false,
            });

            if (result?.error) {
                setError('Invalid email or password');
            } else {
                window.location.href = '/';
            }
        } catch (err: any) {
            setError('An error occurred during sign in');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 bg-app">
            <div className="card prof-card shadow-lg p-0 border-0 overflow-hidden" style={{ maxWidth: '450px', width: '100%' }}>
                <div className="p-1 bg-primary w-100"></div>
                <div className="p-5">
                    <div className="text-center mb-4">
                        <div className="d-inline-block p-3 rounded-circle bg-primary bg-opacity-10 text-primary mb-3">
                            <Shield size={32} />
                        </div>
                        <h1 className="h3 fw-bold mb-2">Welcome Back</h1>
                        <p className="text-muted mb-0">Sign in to your account</p>
                        
                        <div className="mt-3 d-flex justify-content-center">
                            <div className={`px-3 py-1 rounded-pill small fw-medium border shadow-sm d-flex align-items-center gap-2 ${
                                storageType === 'supabase' 
                                ? 'bg-success bg-opacity-10 text-success border-success border-opacity-20' 
                                : 'bg-info bg-opacity-10 text-info border-info border-opacity-20'
                            }`}>
                                <div className={`rounded-circle ${storageType === 'supabase' ? 'bg-success' : 'bg-info'}`} style={{ width: '8px', height: '8px' }}></div>
                                {storageType === 'supabase' ? 'Supabase mode' : 'Local SQLite mode'}
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-danger d-flex gap-2 align-items-center mb-4 text-break">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <small>{error}</small>
                        </div>
                    )}

                    {storageSwitched && (
                        <div className="alert alert-info d-flex gap-2 align-items-center mb-4">
                            <Shield size={16} className="flex-shrink-0" />
                            <small>Storage mode switched! Please sign in with an account from the {storageType === 'supabase' ? 'Supabase' : 'Local'} database.</small>
                        </div>
                    )}

                    {setupComplete && (
                        <div className="alert alert-success d-flex gap-2 align-items-center mb-4">
                            <Shield size={16} className="flex-shrink-0" />
                            <small>Setup complete! You can now sign in.</small>
                        </div>
                    )}

                    {typeof window !== 'undefined' && window.location.search.includes('registered=true') && (
                        <div className="alert alert-success d-flex gap-2 align-items-center mb-4">
                            <Shield size={16} className="flex-shrink-0" />
                            <small>Account created! Please sign in. Access will be pending admin approval.</small>
                        </div>
                    )}

                    {!isCheckingAdmin && hasAdmin === false && (
                        <div className="alert alert-warning d-flex flex-column gap-2 mb-4 shadow-sm border-warning border-opacity-25">
                            <div className="d-flex gap-2 align-items-center">
                                <AlertCircle size={18} className="text-warning flex-shrink-0" />
                                <span className="fw-bold small text-warning-emphasis">No Admin Detected</span>
                            </div>
                            <p className="small mb-2 opacity-75">
                                No administrator account exists in the current <strong>{storageType}</strong> storage. 
                                The first account registered will automatically become the system administrator.
                            </p>
                            <a href="/register" className="btn btn-warning btn-sm w-100 fw-bold">
                                Register as First Admin
                            </a>
                        </div>
                    )}

                    <form onSubmit={handleLogin}>
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-muted">Email</label>
                            <input
                                type="email"
                                required
                                className="form-control form-control-lg bg-light border-0"
                                placeholder="name@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold text-muted">Password</label>
                            <input
                                type="password"
                                required
                                className="form-control form-control-lg bg-light border-0"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !email || !password}
                            className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2 mb-3"
                        >
                            {isLoading ? <Loader2 size={20} className="spinner-border spinner-border-sm" /> : <>Sign In <ArrowRight size={20} /></>}
                        </button>
                        
                        <div className="text-center">
                            <small className="text-muted">
                                Don&apos;t have an account? <a href="/register" className="text-primary text-decoration-none">Register</a>
                            </small>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
