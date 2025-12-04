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

export function Sidebar() {
    return (
        <div className="hidden md:flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground h-screen sticky top-0">
            <div className="p-6 border-b border-sidebar-border/50">
                <div className="flex items-center gap-2 mb-1">
                    <Terminal className="text-primary w-6 h-6" />
                    <h1 className="text-xl font-bold tracking-tight text-foreground">LinkCheck<span className="text-primary">Pro</span></h1>
                </div>
                <p className="text-xs text-muted-foreground font-mono">v2.1.0 [PRO]</p>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
                <TransitionLink
                    href="/"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Home size={20} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Dashboard</span>
                </TransitionLink>

                <TransitionLink
                    href="/scan"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Search size={20} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">New Scan</span>
                </TransitionLink>

                <TransitionLink
                    href="/history"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <History size={20} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Scan History</span>
                </TransitionLink>

                <TransitionLink
                    href="/saved-scans"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Save size={20} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Saved Scans</span>
                </TransitionLink>

                <TransitionLink
                    href="/settings"
                    className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200 group border border-transparent"
                    activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-primary/20 shadow-[0_0_10px_-5px_var(--primary)]"
                >
                    <Settings size={20} className="group-hover:text-primary transition-colors" />
                    <span className="font-medium">Settings</span>
                </TransitionLink>
            </nav>

            <div className="p-4 border-t border-sidebar-border/50">
                <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors group">
                    <LogOut size={20} className="group-hover:rotate-90 transition-transform" />
                    <span className="font-medium">Disconnect</span>
                </button>
            </div>
        </div>
    );
}
