"use client";

import React, { useState } from 'react';
import { useSession, signOut } from "next-auth/react";
import {
    History,
    Settings,
    Home,
    Search,
    Activity,
    ShieldCheck,
    Users,
    User,
    LogOut,
    Loader2
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

export function TopNav() {
    const { data: session } = useSession();
    const user = session?.user;
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            await signOut({ redirect: true, callbackUrl: '/login' });
        } catch (error) {
            console.error('Logout failed:', error);
            setIsLoggingOut(false);
        }
    };

    const isPublicPage = typeof window !== 'undefined' && 
        (['/login', '/register', '/pending'].includes(window.location.pathname) || 
         window.location.pathname.startsWith('/auth'));

    return (
        <nav className="navbar navbar-expand-lg main-nav px-4 bg-white dark:bg-dark d-none d-lg-flex">
            <div className="container-fluid">
                {/* Logo integrated into text */}
                <TransitionLink href="/" className="navbar-brand d-flex align-items-center">
                    <span className="fw-bold tracking-tight fs-4 mb-0 text-dark dark:text-light d-flex align-items-center">
                        LinkChecker
                        <span className="text-primary d-flex align-items-center ms-0">
                            Pr
                            <span className="d-inline-flex align-items-center" style={{ marginTop: '4px' }}>
                                <Logo size={24} />
                            </span>
                        </span>
                    </span>
                </TransitionLink>

                {/* Desktop Menu */}
                <div className="collapse navbar-collapse justify-content-center" id="navbarNav">
                    <ul className="navbar-nav gap-2">
                        {!isPublicPage && (
                            <>
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <Home size={18} />
                                        <span>Dashboard</span>
                                    </TransitionLink>
                                </li>
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/scan"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <Search size={18} />
                                        <span>Scan</span>
                                    </TransitionLink>
                                </li>
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/jobs"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <Activity size={18} />
                                        <span>Active Jobs</span>
                                    </TransitionLink>
                                </li>
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/history"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <History size={18} />
                                        <span>History</span>
                                    </TransitionLink>
                                </li>
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/saved-scans"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <ShieldCheck size={18} />
                                        <span>My Scans</span>
                                    </TransitionLink>
                                </li>
                                {(user as any)?.role === 'admin' && (
                                    <li className="nav-item">
                                        <TransitionLink
                                            href="/users"
                                            className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                            activeClassName="text-primary active border-bottom border-primary border-2"
                                        >
                                            <Users size={18} />
                                            <span>Users</span>
                                        </TransitionLink>
                                    </li>
                                )}
                                <li className="nav-item">
                                    <TransitionLink
                                        href="/settings"
                                        className="nav-link d-flex align-items-center gap-2 px-3 fw-semibold text-muted"
                                        activeClassName="text-primary active border-bottom border-primary border-2"
                                    >
                                        <Settings size={18} />
                                        <span>Settings</span>
                                    </TransitionLink>
                                </li>
                            </>
                        )}
                    </ul>
                </div>

                {/* Right Actions */}
                <div className="d-none d-md-flex align-items-center gap-3">
                    {user && !isPublicPage && (
                        <div className="dropdown">
                            <button 
                                className="btn d-flex align-items-center gap-3 py-1 px-3 bg-light dark:bg-dark-subtle rounded-pill border shadow-sm dropdown-toggle hide-caret"
                                type="button"
                                id="userProfileDropdown"
                                data-bs-toggle="dropdown"
                                aria-expanded="false"
                                style={{ border: 'none', background: 'none' }}
                            >
                                <div className="text-primary me-1">
                                    <User size={18} />
                                </div>
                                <div className="d-flex flex-column text-start">
                                    <span className="small text-dark dark:text-light fw-bold">
                                        Profile
                                    </span>
                                </div>
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end shadow border-0 mt-2 anim-fade-in" aria-labelledby="userProfileDropdown" style={{ minWidth: '200px' }}>
                                <li className="px-3 py-2 border-bottom mb-1">
                                    <div className="d-flex flex-column">
                                        <span className="small text-muted fw-bold lh-1 mb-1" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {(user as any).role}
                                        </span>
                                        <span className="small text-dark dark:text-light fw-semibold truncate">
                                            {user.email}
                                        </span>
                                    </div>
                                </li>
                                <li>
                                    <TransitionLink href="/profile" className="dropdown-item d-flex align-items-center gap-2 py-2">
                                        <User size={16} className="text-muted" />
                                        <span>Show Profile</span>
                                    </TransitionLink>
                                </li>
                                <li>
                                    <button 
                                        onClick={handleLogout}
                                        disabled={isLoggingOut}
                                        className="dropdown-item d-flex align-items-center gap-2 py-2 text-danger"
                                    >
                                        {isLoggingOut ? <Loader2 size={16} className="spinner-border spinner-border-sm border-0" /> : <LogOut size={16} />}
                                        <span>Logout</span>
                                    </button>
                                </li>
                            </ul>
                        </div>
                    )}
                    <ThemeToggle />
                </div>
            </div>
        </nav>
    );
}
