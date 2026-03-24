'use client';

import React, { useState } from 'react';
import { ShieldCheck, UserX, Loader2, Trash2, Shield, User, AlertTriangle } from 'lucide-react';
import { useNotification } from "@/components/NotificationContext";

interface UserRecord {
    id: string;
    email: string;
    role: string;
    hasAccess: boolean;
    maxJobs: number;
    createdAt: Date | string;
}

interface UsersClientProps {
    users: any[];
    currentUserId: string;
}

export default function UsersClient({ users: initialUsers, currentUserId }: UsersClientProps) {
    const [users, setUsers] = useState<UserRecord[]>(initialUsers);
    const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const { addNotification } = useNotification();

    const handleToggleAccess = async (userId: string, currentAccess: boolean) => {
        if (userId === currentUserId && currentAccess) {
            addNotification('error', "You cannot revoke your own admin access.");
            return;
        }

        setLoadingMap(prev => ({ ...prev, [userId]: true }));
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hasAccess: !currentAccess })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, hasAccess: !currentAccess } : u));
            addNotification('success', `User access ${!currentAccess ? 'granted' : 'revoked'}.`);
        } catch (e: any) {
            addNotification('error', e.message || "Failed to update user access.");
        } finally {
            setLoadingMap(prev => ({ ...prev, [userId]: false }));
        }
    };

    const handleToggleRole = async (userId: string, currentRole: string) => {
        if (userId === currentUserId) {
            addNotification('error', "You cannot change your own role.");
            return;
        }

        const newRole = currentRole === 'admin' ? 'user' : 'admin';
        setLoadingMap(prev => ({ ...prev, [`role-${userId}`]: true }));
        
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: newRole })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
            addNotification('success', `User promoted to ${newRole}.`);
        } catch (e: any) {
            addNotification('error', e.message || "Failed to update user role.");
        } finally {
            setLoadingMap(prev => ({ ...prev, [`role-${userId}`]: false }));
        }
    };

    const handleUpdateMaxJobs = async (userId: string, newValue: number) => {
        if (newValue < 1) return;
        
        setLoadingMap(prev => ({ ...prev, [`maxJobs-${userId}`]: true }));
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ maxJobs: newValue })
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, maxJobs: newValue } : u));
            addNotification('success', `Max concurrent scans updated to ${newValue}.`);
        } catch (e: any) {
            addNotification('error', e.message || "Failed to update max scans.");
        } finally {
            setLoadingMap(prev => ({ ...prev, [`maxJobs-${userId}`]: false }));
        }
    };

    const handleDeleteUser = async (userId: string) => {
        setLoadingMap(prev => ({ ...prev, [`delete-${userId}`]: true }));
        try {
            const res = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            
            if (!res.ok) throw new Error(data.error);
            
            setUsers(prev => prev.filter(u => u.id !== userId));
            addNotification('success', "User deleted successfully.");
            setDeleteConfirm(null);
        } catch (e: any) {
            addNotification('error', e.message || "Failed to delete user.");
        } finally {
            setLoadingMap(prev => ({ ...prev, [`delete-${userId}`]: false }));
        }
    };

    return (
        <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                    <tr>
                        <th className="px-4 py-3 text-muted fw-semibold small text-uppercase">User Details</th>
                        <th className="px-4 py-3 text-muted fw-semibold small text-uppercase">Role</th>
                        <th className="px-4 py-3 text-muted fw-semibold small text-uppercase text-center">Max Scans</th>
                        <th className="px-4 py-3 text-muted fw-semibold small text-uppercase text-center">Status</th>
                        <th className="px-4 py-3 text-muted fw-semibold small text-uppercase text-end">Actions</th>
                    </tr>
                </thead>
                <tbody className="border-top-0">
                    {users.map((user) => (
                        <tr key={user.id}>
                            <td className="px-4 py-3">
                                <div className="d-flex flex-column">
                                    <span className="fw-semibold text-dark dark:text-light font-monospace small">{user.email}</span>
                                    <span className="text-muted small">Joined {new Date(user.createdAt).toLocaleDateString()}</span>
                                    {user.id === currentUserId && <span className="badge bg-primary w-fit mt-1" style={{ width: 'fit-content' }}>You</span>}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <button
                                    onClick={() => handleToggleRole(user.id, user.role)}
                                    disabled={loadingMap[`role-${user.id}`] || user.id === currentUserId}
                                    className={`btn btn-sm d-inline-flex gap-2 align-items-center rounded-pill px-3 py-1 fw-bold transition-all ${
                                        user.role === 'admin' 
                                            ? 'btn-primary shadow-sm' 
                                            : 'btn-outline-secondary opacity-75'
                                    }`}
                                >
                                    {loadingMap[`role-${user.id}`] ? (
                                        <Loader2 size={14} className="spinner-border spinner-border-sm border-0" />
                                    ) : user.role === 'admin' ? (
                                        <Shield size={14} />
                                    ) : (
                                        <User size={14} />
                                    )}
                                    {user.role === 'admin' ? 'Administrator' : 'General User'}
                                </button>
                            </td>
                            <td className="px-4 py-3 text-center" style={{ minWidth: '120px' }}>
                                <div className="d-flex align-items-center justify-content-center gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        className="form-control form-control-sm text-center fw-bold"
                                        style={{ width: '60px' }}
                                        value={user.maxJobs || 1}
                                        disabled={loadingMap[`maxJobs-${user.id}`]}
                                        onChange={(e) => handleUpdateMaxJobs(user.id, parseInt(e.target.value) || 1)}
                                    />
                                    {loadingMap[`maxJobs-${user.id}`] && <Loader2 size={14} className="spinner-border spinner-border-sm border-0" />}
                                </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                                <div className="d-flex flex-column align-items-center">
                                    <div className="form-check form-switch m-0 mb-1">
                                        <input
                                            className="form-check-input cursor-pointer"
                                            type="checkbox"
                                            role="switch"
                                            checked={user.hasAccess}
                                            disabled={loadingMap[user.id] || (user.id === currentUserId)}
                                            onChange={() => handleToggleAccess(user.id, user.hasAccess)}
                                            style={{ width: '2.5rem', height: '1.25rem' }}
                                        />
                                    </div>
                                    <span className={`small fw-bold text-uppercase tracking-wider ${user.hasAccess ? 'text-success' : 'text-danger'}`} style={{ fontSize: '0.65rem' }}>
                                        {user.hasAccess ? 'Approved' : 'Pending'}
                                    </span>
                                </div>
                            </td>
                            <td className="px-4 py-3 text-end">
                                {deleteConfirm === user.id ? (
                                    <div className="d-flex justify-content-end gap-2 align-items-center">
                                        <span className="text-danger small fw-bold d-none d-md-inline">Confirm Delete?</span>
                                        <button 
                                            onClick={() => handleDeleteUser(user.id)}
                                            disabled={loadingMap[`delete-${user.id}`]}
                                            className="btn btn-danger btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center"
                                            title="Confirm Delete"
                                        >
                                            {loadingMap[`delete-${user.id}`] ? <Loader2 size={16} className="spinner-border border-0" /> : <Trash2 size={16} />}
                                        </button>
                                        <button 
                                            onClick={() => setDeleteConfirm(null)}
                                            className="btn btn-light btn-sm rounded-circle p-2 d-flex align-items-center justify-content-center"
                                            title="Cancel"
                                        >
                                            <UserX size={16} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setDeleteConfirm(user.id)}
                                        disabled={user.id === currentUserId}
                                        className="btn btn-outline-danger btn-sm border-0 rounded-circle p-2 d-flex align-items-center justify-content-center opacity-50 hover-opacity-100 float-end"
                                        title="Delete User"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    {users.length === 0 && (
                        <tr>
                            <td colSpan={4} className="text-center py-5 text-muted">
                                <UserX size={48} className="mb-3 opacity-25" />
                                <p className="mb-0">No users found.</p>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
