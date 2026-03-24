'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { UserPlus, ArrowRight, Loader2, AlertCircle, Info } from 'lucide-react';

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [storageType, setStorageType] = useState<string>('sqlite');
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    React.useEffect(() => {
        fetch('/api/settings')
            .then(res => res.json())
            .then(data => setStorageType(data.storageType))
            .catch(() => {});
    }, []);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password !== passwordConfirm) {
            setError("Passwords do not match");
            return;
        }
        
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const regData = await res.json();
            if (!res.ok) throw new Error(regData.error || 'Failed to register');
            
            window.location.href = '/login?registered=true';
        } catch (err: any) {
            setError(err.message || 'Failed to register account');
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
                            <UserPlus size={32} />
                        </div>
                        <h1 className="h3 fw-bold mb-2">Create Account</h1>
                        <p className="text-muted mb-0">Register for Link Checker Pro</p>

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
                        <div className="alert alert-danger d-flex gap-2 align-items-center mb-4">
                            <AlertCircle size={16} />
                            <small>{error}</small>
                        </div>
                    )}
                    
                    <div className="alert alert-info d-flex gap-2 align-items-start mb-4 py-2 small">
                        <Info size={16} className="mt-1 flex-shrink-0" />
                        <div>New accounts must be manually approved by the administrator before accessing scans.</div>
                    </div>

                    <form onSubmit={handleRegister}>
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
                        <div className="mb-3">
                            <label className="form-label small fw-bold text-muted">Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="form-control form-control-lg bg-light border-0"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div className="mb-4">
                            <label className="form-label small fw-bold text-muted">Confirm Password</label>
                            <input
                                type="password"
                                required
                                minLength={6}
                                className="form-control form-control-lg bg-light border-0"
                                placeholder="••••••••"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !email || !password || !passwordConfirm}
                            className="btn btn-primary btn-lg w-100 d-flex align-items-center justify-content-center gap-2 mb-3"
                        >
                            {isLoading ? <Loader2 size={20} className="spinner-border spinner-border-sm" /> : <>Register <ArrowRight size={20} /></>}
                        </button>
                        
                        <div className="text-center">
                            <small className="text-muted">
                                Already have an account? <a href="/login" className="text-primary text-decoration-none">Sign In</a>
                            </small>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
