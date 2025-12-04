"use client";

import { useState } from "react";
import {
    History,
    Settings,
    LogOut,
    Save,
    Home,
    Search,
    Terminal,
    Menu,
    X
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    return (
        <>
            {/* Mobile Header */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-2">
                    <Terminal className="text-primary w-5 h-5" />
                    <span className="font-bold tracking-tight text-foreground">LinkCheck<span className="text-primary">Pro</span></span>
                </div>
                <button
                    onClick={toggleMenu}
                    className="p-2 rounded-md hover:bg-accent text-foreground transition-colors"
                >
                    {isOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
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
                            className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
                        />

                        {/* Slide-over Menu */}
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed inset-y-0 right-0 w-3/4 max-w-xs bg-sidebar border-l border-sidebar-border z-50 md:hidden flex flex-col shadow-2xl"
                        >
                            <div className="p-6 border-b border-sidebar-border/50 flex justify-between items-center">
                                <span className="text-sm font-mono text-muted-foreground">SYSTEM MENU</span>
                                <button onClick={closeMenu} className="p-1 hover:text-primary transition-colors">
                                    <X size={20} />
                                </button>
                            </div>

                            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
                                <MobileLink href="/" icon={Home} label="Dashboard" onClick={closeMenu} />
                                <MobileLink href="/scan" icon={Search} label="New Scan" onClick={closeMenu} />
                                <MobileLink href="/history" icon={History} label="Scan History" onClick={closeMenu} />
                                <MobileLink href="/saved-scans" icon={Save} label="Saved Scans" onClick={closeMenu} />
                                <MobileLink href="/settings" icon={Settings} label="Settings" onClick={closeMenu} />
                            </nav>

                            <div className="p-4 border-t border-sidebar-border/50">
                                <button className="w-full flex items-center gap-3 p-3 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors">
                                    <LogOut size={20} />
                                    <span className="font-medium">Disconnect</span>
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
        <div onClick={onClick}>
            <TransitionLink
                href={href}
                className="flex items-center gap-3 p-3 rounded-md hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
            >
                <Icon size={20} />
                <span className="font-medium">{label}</span>
            </TransitionLink>
        </div>
    );
}
