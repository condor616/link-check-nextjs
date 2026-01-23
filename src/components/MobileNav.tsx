"use client";

import { useState } from "react";
import {
    History,
    Settings,
    LogOut,
    Home,
    Search,
    Terminal,
    Activity,
    Menu,
    X,
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-primary/20 bg-background/90 backdrop-blur-md sticky top-0 z-[60] cyber-scanlines h-16">
                <div className="flex items-center gap-2 group">
                    <div className="p-1 border border-primary/40 relative">
                        <Terminal className="text-primary w-4 h-4" />
                        <div className="absolute inset-0 bg-primary/5 group-active:bg-primary/10 transition-colors" />
                    </div>
                    <span className="font-bold tracking-tight text-foreground uppercase italic text-sm">
                        LinkCheck<span className="text-primary glow-text-primary">Pro</span>
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <button
                        onClick={toggleMenu}
                        className="p-2 border border-primary/30 hover:bg-primary/5 text-primary transition-all active:scale-95"
                    >
                        {isOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={closeMenu}
                            className="fixed inset-0 bg-background/80 z-40 md:hidden backdrop-blur-md"
                        />

                        {/* Slide-over Menu */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 35, stiffness: 350 }}
                            className="fixed inset-y-0 right-0 w-4/5 max-w-sm bg-card border-l border-primary/30 z-50 md:hidden flex flex-col shadow-2xl overflow-hidden cyber-scanlines"
                        >
                            <div className="p-4 border-b border-primary/20 flex items-center bg-primary/5 h-16">
                                <span className="text-xs font-bold text-foreground uppercase tracking-widest leading-none">Menu</span>
                            </div>

                            <nav className="flex-1 overflow-y-auto py-8 px-6 space-y-4">
                                <MobileLink href="/" icon={Home} label="Dashboard" onClick={closeMenu} />
                                <MobileLink href="/scan" icon={Search} label="Scan" onClick={closeMenu} />
                                <MobileLink href="/jobs" icon={Activity} label="Status" onClick={closeMenu} />
                                <MobileLink href="/saved-scans" icon={History} label="History" onClick={closeMenu} />
                                <MobileLink href="/settings" icon={Settings} label="Settings" onClick={closeMenu} />
                            </nav>

                            <div className="p-6 border-t border-primary/20 bg-background/50">
                                <button className="w-full flex items-center justify-center gap-3 p-4 border border-destructive/30 text-destructive text-[10px] uppercase font-bold tracking-[0.2em] hover:bg-destructive/10 transition-all active:scale-[0.98]">
                                    <LogOut size={16} />
                                    <span>Disconnect</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}

function MobileLink({ href, icon: Icon, label, onClick }: { href: string, icon: any, label: string, onClick: () => void }) {
    return (
        <div onClick={onClick} className="cursor-pointer">
            <TransitionLink
                href={href}
                className="flex items-center gap-4 p-4 border border-primary/5 text-muted-foreground transition-all duration-200 uppercase tracking-widest text-[11px] font-bold hover:bg-primary/5 hover:text-primary hover:border-primary/20"
                activeClassName="bg-primary/10 text-primary border-primary/30 border-l-4 shadow-[0_0_15px_-5px_var(--primary)]"
            >
                <Icon size={18} />
                <span>{label}</span>
            </TransitionLink>
        </div>
    );
}
