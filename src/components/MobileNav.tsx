"use client";

import {
    History,
    Settings,
    Home,
    Search,
    Activity,
    ShieldCheck,
    Github,
    X,
    Menu
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';

export function MobileNav() {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [hidden, setHidden] = useState(false);
    const { scrollY } = useScroll();
    const lastScrollY = useRef(0);

    useEffect(() => {
        setMounted(true);

        const handleTouch = () => {
            setHidden(false);
        };

        window.addEventListener('touchstart', handleTouch, { passive: true });
        return () => window.removeEventListener('touchstart', handleTouch);
    }, []);

    useMotionValueEvent(scrollY, "change", (latest) => {
        const previous = lastScrollY.current;
        const diff = latest - previous;

        // Only hide if we've scrolled a bit (threshold) and not at the top
        if (latest > 50 && diff > 10 && !isOpen) {
            setHidden(true);
        } else if (diff < -10 || latest <= 50) {
            setHidden(false);
        }

        lastScrollY.current = latest;
    });

    const toggleMenu = () => setIsOpen(!isOpen);
    const closeMenu = () => setIsOpen(false);

    const menuVariants = {
        open: {
            transition: {
                staggerChildren: 0.08,
                delayChildren: 0.1
            }
        },
        closed: {
            transition: {
                staggerChildren: 0.05,
                staggerDirection: -1
            }
        }
    };

    const linkVariants = {
        open: {
            opacity: 1,
            x: 0,
            transition: {
                duration: 0.4,
                ease: [0.22, 1, 0.36, 1] as any
            }
        },
        closed: {
            opacity: 0,
            x: -15,
            transition: {
                duration: 0.3,
                ease: "easeIn" as any
            }
        }
    };

    return (
        <>
            <motion.nav
                className={`navbar navbar-light bg-white dark:bg-dark border-bottom d-lg-none sticky-top px-3 py-2 main-nav ${isOpen ? 'border-transparent' : ''}`}
                style={{ zIndex: 1100 }}
                variants={{
                    visible: { y: 0 },
                    hidden: { y: "-100%" }
                }}
                animate={hidden && !isOpen ? "hidden" : "visible"}
                transition={{ duration: 0.35, ease: "easeInOut" }}
            >
                <div className="container-fluid p-0">
                    <TransitionLink href="/" className="navbar-brand d-flex align-items-center m-0" onClick={closeMenu}>
                        <span className="fw-bold tracking-tight fs-5 mb-0 text-dark dark:text-light d-flex align-items-center">
                            LinkChecker
                            <span className="text-primary d-flex align-items-center ms-0">
                                Pr
                                <span className="d-inline-flex align-items-center" style={{ marginTop: '3px' }}>
                                    <Logo size={20} />
                                </span>
                            </span>
                        </span>
                    </TransitionLink>

                    <div className="d-flex align-items-center gap-2">
                        <ThemeToggle />
                        <button
                            className="btn btn-link text-dark dark:text-light p-0 border-0 d-flex align-items-center justify-content-center"
                            type="button"
                            onClick={toggleMenu}
                            aria-expanded={isOpen}
                            aria-label="Toggle navigation"
                            style={{ width: '40px', height: '40px' }}
                        >
                            <motion.div
                                initial={false}
                                animate={{
                                    rotate: isOpen ? 90 : 0,
                                    scale: isOpen ? 0.9 : 1
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 300,
                                    damping: 20
                                }}
                                className="d-flex align-items-center justify-content-center"
                            >
                                {isOpen ? <X size={24} /> : <Menu size={24} />}
                            </motion.div>
                        </button>
                    </div>
                </div>
            </motion.nav>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="mobile-menu-overlay bg-white dark:bg-dark"
                        initial={{ opacity: 0, scale: 0.98, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{
                            duration: 0.4,
                            ease: [0.22, 1, 0.36, 1] as any
                        }}
                        onClick={closeMenu}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100vh',
                            paddingTop: '74px',
                            zIndex: 1050,
                            overflowY: 'auto',
                            transformOrigin: 'top center'
                        }}
                    >
                        <motion.div
                            className="d-flex flex-column pt-2 h-100"
                            variants={menuVariants}
                            initial="closed"
                            animate="open"
                            exit="closed"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex-grow-0">
                                <MobileLink href="/" icon={Home} label="Dashboard" onClick={closeMenu} variants={linkVariants} />
                                <MobileLink href="/scan" icon={Search} label="Scan" onClick={closeMenu} variants={linkVariants} />
                                <MobileLink href="/jobs" icon={Activity} label="Active Jobs" onClick={closeMenu} variants={linkVariants} />
                                <MobileLink href="/history" icon={History} label="History" onClick={closeMenu} variants={linkVariants} />
                                <MobileLink href="/saved-scans" icon={ShieldCheck} label="My Scans" onClick={closeMenu} variants={linkVariants} />
                                <MobileLink href="/settings" icon={Settings} label="Settings" onClick={closeMenu} variants={linkVariants} />
                            </div>

                            <div className="mt-auto pb-5 pt-4 px-4 text-center">
                                <motion.div variants={linkVariants} className="d-flex flex-column gap-3">
                                    <div className="text-muted small d-flex flex-column gap-2 align-items-center">
                                        <TransitionLink href="/" className="text-decoration-none d-flex align-items-center" onClick={closeMenu}>
                                            <span className="fw-bold tracking-tight fs-5 mb-0 text-dark dark:text-light d-flex align-items-center">
                                                LinkChecker
                                                <span className="text-primary d-flex align-items-center ms-0">
                                                    Pr
                                                    <span className="d-inline-flex align-items-center" style={{ marginTop: '3px' }}>
                                                        <Logo size={20} />
                                                    </span>
                                                </span>
                                            </span>
                                        </TransitionLink>
                                        <div className="opacity-75">&copy; {new Date().getFullYear()} • v0.1.0</div>
                                    </div>

                                    <div className="text-muted small">
                                        Created by <span className="fw-semibold text-dark dark:text-light">Marcello Angileri</span>
                                    </div>

                                    <div className="d-flex justify-content-center">
                                        <Link
                                            href="https://github.com/condor616/link-check-nextjs"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="d-flex align-items-center gap-2 text-muted text-decoration-none transition-all hover-text-primary px-3 py-2 rounded-pill bg-light dark:bg-opacity-10"
                                        >
                                            <Github size={16} />
                                            <span className="small fw-medium">condor616/link-check-nextjs</span>
                                        </Link>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Lock body scroll when menu is open */}
            {isOpen && (
                <style jsx global>{`
                    body {
                        overflow: hidden;
                    }
                `}</style>
            )}
        </>
    );
}

function MobileLink({ href, icon: Icon, label, onClick, variants }: {
    href: string,
    icon: any,
    label: string,
    onClick?: () => void,
    variants?: any
}) {
    return (
        <motion.div variants={variants}>
            <TransitionLink
                href={href}
                className="d-flex align-items-center gap-3 py-3 px-4 fw-semibold text-decoration-none border-bottom border-light dark:border-secondary dark:border-opacity-10 text-dark dark:text-light hover-bg-light dark:hover-bg-opacity-10 transition-colors"
                activeClassName="text-primary bg-primary bg-opacity-5 border-start border-primary border-4"
                onClick={onClick}
            >
                <Icon size={20} />
                <span>{label}</span>
            </TransitionLink>
        </motion.div>
    );
}
