"use client";

import Link from "next/link";
import { Github } from "lucide-react";

export function Footer() {
    return (
        <footer className="mt-auto py-4 border-top footer-section">
            <div className="container-fluid px-4 px-md-5">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-center gap-3">
                    <div className="text-muted small d-flex align-items-center gap-2">
                        <span>&copy; {new Date().getFullYear()} Link Checker Pro</span>
                        <span className="text-muted opacity-25">|</span>
                        <span>v0.1.0</span>
                    </div>

                    <div className="d-flex align-items-center gap-3">
                        <div className="text-muted small">
                            Created by <span className="fw-semibold footer-name">Marcello Angileri</span>
                        </div>

                        <Link
                            href="https://github.com/condor616/link-check-nextjs"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="d-flex align-items-center gap-2 text-muted text-decoration-none transition-all hover-text-primary"
                            style={{ transition: 'color 0.2s ease' }}
                        >
                            <Github size={18} />
                            <span className="small">condor616/link-check-nextjs</span>
                        </Link>
                    </div>
                </div>
            </div>
            <style jsx>{`
        .footer-section {
            background-color: var(--bg-card);
            border-color: var(--border-subtle) !important;
            box-shadow: 0 -4px 20px -5px rgba(0,0,0,0.05);
        }
        .footer-name {
            color: var(--text-main) !important;
        }
        .hover-text-primary:hover {
            color: var(--brand-primary) !important;
        }
      `}</style>
        </footer>
    );
}
