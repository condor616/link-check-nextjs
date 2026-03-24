'use client';

import { ShieldAlert } from 'lucide-react';
import React from 'react';

export default function PendingPage() {
    return (
        <div className="min-vh-100 d-flex align-items-center justify-content-center p-4 bg-app">
            <div className="card prof-card shadow-lg p-0 border-0 overflow-hidden text-center" style={{ maxWidth: '600px', width: '100%' }}>
                <div className="p-1 bg-warning w-100"></div>
                <div className="p-5">
                    <div className="mb-4 d-inline-block p-4 rounded-circle bg-warning bg-opacity-10 text-warning">
                        <ShieldAlert size={64} />
                    </div>
                    <h1 className="h2 fw-bold mb-3">Your Account is Pending Approval</h1>
                    <p className="text-muted mb-4" style={{ fontSize: '1.1rem' }}>
                        Your registration was successful, but an administrator needs to grant you access before you can use the application. Please contact your system administrator.
                    </p>
                    <button onClick={() => window.location.href = '/login'} className="btn btn-outline-secondary btn-lg">
                        Return to Login
                    </button>
                </div>
            </div>
        </div>
    );
}
