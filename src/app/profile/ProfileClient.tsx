'use client';

import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Calendar, Loader2, Save, Key, Edit, X } from 'lucide-react';
import { useNotification } from "@/components/NotificationContext";
import { useSearchParams, useRouter } from 'next/navigation';

interface ProfileClientProps {
    user: {
        id: string;
        email: string;
        name: string | null;
        role: string;
        hasAccess: boolean;
        createdAt: Date | string;
    };
}

export default function ProfileClient({ user }: ProfileClientProps) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { addNotification } = useNotification();
    
    const [isEditing, setIsEditing] = useState(searchParams.get('edit') === 'true');
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state
    const [name, setName] = useState(user.name || '');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (searchParams.get('edit') === 'true' && !isEditing) {
            setIsEditing(true);
        }
    }, [searchParams, isEditing]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password && password !== confirmPassword) {
            addNotification('error', "Passwords do not match.");
            return;
        }

        if (password && password.length < 6) {
            addNotification('error', "Password must be at least 6 characters.");
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    name: name || null,
                    ...(password ? { password } : {})
                })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update profile");

            addNotification('success', "Profile updated successfully.");
            setIsEditing(false);
            setPassword('');
            setConfirmPassword('');
            
            // Refresh the page to update the session/server component data
            router.refresh();
        } catch (error: any) {
            addNotification('error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleEdit = () => {
        if (isEditing) {
            // Cancel editing, reset state
            setName(user.name || '');
            setPassword('');
            setConfirmPassword('');
            // Remove edit param from URL without refreshing
            const params = new URLSearchParams(searchParams.toString());
            params.delete('edit');
            router.push(`/profile?${params.toString()}`, { scroll: false });
        }
        setIsEditing(!isEditing);
    };

    return (
        <div className="p-0">
            {/* Header section with cover color */}
            <div className="bg-primary bg-opacity-10 py-5 px-4 mb-0 border-bottom">
                <div className="d-flex align-items-center gap-4">
                    <div className="bg-white dark:bg-dark p-1 rounded-circle shadow-sm">
                        <div className="bg-primary bg-opacity-25 rounded-circle d-flex align-items-center justify-content-center" style={{ width: '80px', height: '80px' }}>
                            <User size={40} className="text-primary" />
                        </div>
                    </div>
                    <div>
                        <h2 className="fw-bold mb-1 text-dark dark:text-light">
                            {user.name || 'User'}
                        </h2>
                        <div className="d-flex align-items-center gap-2 text-muted small fw-medium">
                            <Shield size={14} />
                            <span className="text-uppercase tracking-wider">{user.role}</span>
                            <span className="opacity-25">|</span>
                            <Mail size={14} />
                            <span>{user.email}</span>
                        </div>
                    </div>
                    <div className="ms-auto">
                        <button 
                            onClick={toggleEdit}
                            className={`btn ${isEditing ? 'btn-outline-secondary' : 'btn-primary'} d-flex align-items-center gap-2 rounded-pill px-4`}
                        >
                            {isEditing ? (
                                <>
                                    <X size={18} />
                                    <span>Cancel</span>
                                </>
                            ) : (
                                <>
                                    <Edit size={18} />
                                    <span>Edit Profile</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            <div className="p-4 p-md-5">
                <form onSubmit={handleSave}>
                    <div className="row g-4">
                        <div className="col-12 col-md-6">
                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase tracking-wider mb-2">Display Name</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0">
                                        <User size={18} className="text-muted" />
                                    </span>
                                    <input 
                                        type="text" 
                                        className="form-control ps-0 bg-light border-start-0" 
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        disabled={!isEditing || isLoading}
                                        placeholder="Your Name"
                                    />
                                </div>
                            </div>

                            <div className="mb-4">
                                <label className="form-label fw-bold text-muted small text-uppercase tracking-wider mb-2">Email Address</label>
                                <div className="input-group">
                                    <span className="input-group-text bg-light border-end-0 opacity-75">
                                        <Mail size={18} className="text-muted" />
                                    </span>
                                    <input 
                                        type="email" 
                                        className="form-control ps-0 bg-light border-start-0 opacity-75" 
                                        value={user.email}
                                        disabled={true}
                                        title="Email cannot be changed"
                                    />
                                </div>
                                <div className="form-text small mt-1">Email address is used as your unique identifier and cannot be changed.</div>
                            </div>
                        </div>

                        <div className="col-12 col-md-6">
                            <div className="mb-4 border rounded p-4 bg-light bg-opacity-25">
                                <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                                    <Key size={18} className="text-primary" />
                                    Security & Access
                                </h6>
                                
                                <div className="mb-3">
                                    <label className="form-label fw-bold text-muted small text-uppercase mb-2">New Password</label>
                                    <input 
                                        type="password" 
                                        className="form-control" 
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        disabled={!isEditing || isLoading}
                                        placeholder="Leave blank to keep current"
                                    />
                                </div>

                                {password && (
                                    <div className="mb-3 anim-fade-in">
                                        <label className="form-label fw-bold text-muted small text-uppercase mb-2">Confirm New Password</label>
                                        <input 
                                            type="password" 
                                            className="form-control" 
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            disabled={!isEditing || isLoading}
                                            placeholder="Confirm your new password"
                                        />
                                    </div>
                                )}

                                <hr className="my-4 opacity-10" />

                                <div className="d-flex flex-column gap-2">
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="text-muted small fw-medium">Account Created</span>
                                        <span className="small fw-bold d-flex align-items-center gap-1">
                                            <Calendar size={14} />
                                            {new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
                                        </span>
                                    </div>
                                    <div className="d-flex align-items-center justify-content-between">
                                        <span className="text-muted small fw-medium">Status</span>
                                        <span className={`badge rounded-pill ${user.hasAccess ? 'bg-success-subtle text-success border border-success-subtle' : 'bg-warning-subtle text-warning border border-warning-subtle'} px-3`}>
                                            {user.hasAccess ? 'Active & Approved' : 'Pending Approval'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {isEditing && (
                        <div className="d-flex justify-content-end mt-4 pt-3 border-top gap-3">
                            <button 
                                type="button"
                                onClick={toggleEdit}
                                disabled={isLoading}
                                className="btn btn-light px-4 rounded-pill fw-bold"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                disabled={isLoading}
                                className="btn btn-primary px-5 rounded-pill fw-bold d-flex align-items-center gap-2"
                            >
                                {isLoading ? <Loader2 size={18} className="spinner-border border-0" /> : <Save size={18} />}
                                <span>Save Changes</span>
                            </button>
                        </div>
                    )}
                </form>
            </div>
            
            <style jsx>{`
                .anim-fade-in {
                    animation: fadeIn 0.3s ease-in-out;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
