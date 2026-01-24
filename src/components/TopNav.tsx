"use client";

import {
    History,
    Settings,
    Home,
    Search,
    Activity,
    ShieldCheck
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";

export function TopNav() {
    return (
        <nav className="navbar navbar-expand-md main-nav px-4 bg-white dark:bg-dark d-none d-md-flex">
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
                                <span>Status</span>
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
                                <span>Saved</span>
                            </TransitionLink>
                        </li>
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
                    </ul>
                </div>

                {/* Right Actions */}
                <div className="d-none d-md-flex align-items-center gap-3">
                    <ThemeToggle />
                </div>
            </div>
        </nav>
    );
}
