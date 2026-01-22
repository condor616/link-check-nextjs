"use client";

import {
    History,
    Settings,
    LogOut,
    Save,
    Home,
    Search,
    Terminal
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { cn } from "@/lib/utils";

export function TopNav() {
    return (
        <header className="hidden md:flex w-full h-16 border-b border-sidebar-border bg-sidebar text-sidebar-foreground sticky top-0 z-50 items-center px-6 justify-between backdrop-blur-md bg-opacity-90">
            {/* Logo */}
            <div className="flex items-center gap-2">
                <Terminal className="text-primary w-6 h-6" />
                <h1 className="text-xl font-bold tracking-tight text-foreground">LinkCheck<span className="text-primary">Pro</span></h1>
                <span className="ml-2 text-xs text-muted-foreground font-mono bg-sidebar-accent/50 px-2 py-0.5 rounded-full">v2.1.0</span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
                <TransitionLink
                    href="/"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent text-sm"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Home size={18} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Dashboard</span>
                </TransitionLink>

                <TransitionLink
                    href="/scan"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent text-sm"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Search size={18} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">New Scan</span>
                </TransitionLink>

                <TransitionLink
                    href="/history"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent text-sm"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <History size={18} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">History</span>
                </TransitionLink>

                <TransitionLink
                    href="/saved-scans"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent text-sm"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Save size={18} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Saved</span>
                </TransitionLink>

                <TransitionLink
                    href="/settings"
                    className="flex items-center gap-2 px-4 py-2 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent text-sm"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Settings size={18} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Settings</span>
                </TransitionLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center">
                <button className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors group text-sm font-medium">
                    <LogOut size={18} className="group-hover:rotate-90 transition-transform" />
                    <span>Disconnect</span>
                </button>
            </div>
        </header>
    );
}
