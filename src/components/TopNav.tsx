"use client";

import {
    History,
    Settings,
    LogOut,
    Save,
    Home,
    Search,
    Terminal,
    Activity
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

export function TopNav() {
    return (
        <header className="hidden md:flex w-full h-16 border-b border-primary/20 bg-background/90 text-foreground sticky top-0 z-50 items-center px-6 justify-between backdrop-blur-md cyber-scanlines">
            {/* Logo */}
            <div className="flex items-center gap-2 group cursor-pointer">
                <div className="p-1 border border-primary/50 relative">
                    <Terminal className="text-primary w-5 h-5" />
                    <div className="absolute inset-0 bg-primary/10 group-hover:bg-primary/20 transition-colors" />
                </div>
                <h1 className="text-xl font-bold tracking-tighter text-foreground uppercase italic shadow-primary/20 shadow-sm">
                    LinkCheck<span className="text-primary glow-text-primary">Pro</span>
                </h1>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-0">
                <TransitionLink
                    href="/"
                    className="flex items-center gap-2 px-6 py-5 hover:bg-primary/5 hover:text-primary transition-all duration-200 group border-b-2 border-transparent text-xs uppercase tracking-widest font-bold"
                    activeClassName="border-primary text-primary bg-primary/5 shadow-[inset_0_-10px_20px_-15px_var(--primary)]"
                >
                    <Home size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Dashboard</span>
                </TransitionLink>

                <TransitionLink
                    href="/scan"
                    className="flex items-center gap-2 px-6 py-5 hover:bg-primary/5 hover:text-primary transition-all duration-200 group border-b-2 border-transparent text-xs uppercase tracking-widest font-bold"
                    activeClassName="border-primary text-primary bg-primary/5 shadow-[inset_0_-10px_20px_-15px_var(--primary)]"
                >
                    <Search size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Scan</span>
                </TransitionLink>

                <TransitionLink
                    href="/jobs"
                    className="flex items-center gap-2 px-6 py-5 hover:bg-primary/5 hover:text-primary transition-all duration-200 group border-b-2 border-transparent text-xs uppercase tracking-widest font-bold"
                    activeClassName="border-primary text-primary bg-primary/5 shadow-[inset_0_-10px_20px_-15px_var(--primary)]"
                >
                    <Activity size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Status</span>
                </TransitionLink>


                <TransitionLink
                    href="/saved-scans"
                    className="flex items-center gap-2 px-6 py-5 hover:bg-primary/5 hover:text-primary transition-all duration-200 group border-b-2 border-transparent text-xs uppercase tracking-widest font-bold"
                    activeClassName="border-primary text-primary bg-primary/5 shadow-[inset_0_-10px_20px_-15px_var(--primary)]"
                >
                    <History size={16} className="group-hover:scale-110 transition-transform" />
                    <span>History</span>
                </TransitionLink>

                <TransitionLink
                    href="/settings"
                    className="flex items-center gap-2 px-6 py-5 hover:bg-primary/5 hover:text-primary transition-all duration-200 group border-b-2 border-transparent text-xs uppercase tracking-widest font-bold"
                    activeClassName="border-primary text-primary bg-primary/5 shadow-[inset_0_-10px_20px_-15px_var(--primary)]"
                >
                    <Settings size={16} className="group-hover:scale-110 transition-transform" />
                    <span>Settings</span>
                </TransitionLink>
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-4">
                <ThemeToggle />
            </div>
        </header>
    );
}
