"use client";

import {
    History,
    Settings,
    Home,
    Search,
    Activity,
    Menu,
    ShieldCheck
} from 'lucide-react';
import { TransitionLink } from "@/components/TransitionLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from "@/components/Logo";

export function MobileNav() {
    const [mounted, setMounted] = useState(false);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleLinkClick = () => {
        if (closeBtnRef.current) {
            closeBtnRef.current.click();
        }
    };

    return (
        <>
            <nav className="navbar navbar-light bg-white dark:bg-dark border-bottom d-lg-none sticky-top px-3 py-2 main-nav">
                <div className="container-fluid p-0">
                    {/* Logo */}
                    {/* Logo (Inline Style) */}
                    <TransitionLink href="/" className="navbar-brand d-flex align-items-center m-0">
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
                            className="btn btn-link text-dark dark:text-light p-1 border-0"
                            type="button"
                            data-bs-toggle="offcanvas"
                            data-bs-target="#mobileNavOffcanvas"
                            aria-controls="mobileNavOffcanvas"
                        >
                            <Menu size={24} />
                        </button>
                    </div>
                </div>
            </nav>

            {mounted && createPortal(
                <div className="offcanvas offcanvas-end w-100 bg-white dark:bg-dark" tabIndex={-1} id="mobileNavOffcanvas" aria-labelledby="mobileNavLabel">
                    <div className="offcanvas-header border-bottom dark:border-secondary dark:border-opacity-25">
                        <div className="offcanvas-title" id="mobileNavLabel">
                            <TransitionLink href="/" className="d-flex align-items-center text-decoration-none" onClick={handleLinkClick}>
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
                        </div>
                        <button
                            type="button"
                            className="btn-close dark:btn-close-white"
                            data-bs-dismiss="offcanvas"
                            aria-label="Close"
                            ref={closeBtnRef}
                        ></button>
                    </div>
                    <div className="offcanvas-body p-0">
                        <div className="d-flex flex-column">
                            <MobileLink href="/" icon={Home} label="Dashboard" onClick={handleLinkClick} />
                            <MobileLink href="/scan" icon={Search} label="Scan" onClick={handleLinkClick} />
                            <MobileLink href="/jobs" icon={Activity} label="Active Jobs" onClick={handleLinkClick} />
                            <MobileLink href="/history" icon={History} label="History" onClick={handleLinkClick} />
                            <MobileLink href="/saved-scans" icon={ShieldCheck} label="My Scans" onClick={handleLinkClick} />
                            <MobileLink href="/settings" icon={Settings} label="Settings" onClick={handleLinkClick} />
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}

function MobileLink({ href, icon: Icon, label, onClick }: { href: string, icon: any, label: string, onClick?: () => void }) {
    return (
        <TransitionLink
            href={href}
            className="d-flex align-items-center gap-3 py-3 px-4 fw-semibold text-decoration-none border-bottom border-light dark:border-secondary dark:border-opacity-10 text-dark dark:text-light hover-bg-light dark:hover-bg-opacity-10 transition-colors"
            activeClassName="text-primary bg-primary bg-opacity-5 border-start border-primary border-4"
            onClick={onClick}
        >
            <Icon size={20} />
            <span>{label}</span>
        </TransitionLink>
    );
}
