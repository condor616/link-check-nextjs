'use client';

import React, { useState, useEffect } from 'react';
import SetupWizard from './SetupWizard';
import { Loader2 } from 'lucide-react';

export default function SetupWrapper({ children }: { children: React.ReactNode }) {
    const [isSetup, setIsSetup] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkSetup = async () => {
        try {
            const res = await fetch('/api/setup/status');
            const data = await res.json();
            setIsSetup(data.isSetup);
        } catch (error) {
            console.error('Failed to check setup status:', error);
            setIsSetup(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkSetup();
    }, []);

    if (isLoading) {
        return (
            <div className="min-vh-100 d-flex align-items-center justify-content-center bg-app">
                <div className="text-center">
                    <Loader2 className="spinner-border spinner-border-sm border-0 text-primary mb-3" size={40} />
                    <p className="text-muted">Loading environment...</p>
                </div>
            </div>
        );
    }

    if (isSetup === false) {
        return <SetupWizard onComplete={() => setIsSetup(true)} />;
    }

    return <>{children}</>;
}
