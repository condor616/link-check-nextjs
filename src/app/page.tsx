'use client';

import React from 'react';
import {
  Search,
  Activity,
  History,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  return (
    <div className="w-100 py-4 fade-in-up">
      {/* Header Section */}
      <div className="text-center mb-5 mt-3">
        <h1 className="display-4 fw-bold text-dark dark:text-light d-flex align-items-center justify-content-center">
          LinkChecker
          <span className="text-primary d-flex align-items-center ms-0">
            Pr
            <span className="d-inline-flex align-items-center" style={{ marginTop: '0.2em' }}>
              <Logo size={48} />
            </span>
          </span>
        </h1>
        <p className="lead text-muted">Hunting down 404s like they owe us money. Keeping your site's reputation alive, one link at a time.</p>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-lg-3 col-md-6">
          <AnimatedCard delay={0.1} className="h-100">
            <div className="d-flex flex-column h-100 text-center">
              <div className="d-inline-flex align-self-center bg-primary bg-opacity-10 p-3 rounded-pill mb-3 text-primary">
                <Search size={28} />
              </div>
              <h3 className="h5 mb-2 fw-bold">New Scan</h3>
              <p className="text-muted small mb-4 flex-grow-1">
                Perform a deep analysis of your website's links.
              </p>
              <AnimatedButton href="/scan" className="w-100" variant="primary" size="sm">
                <span>Start</span>
                <ArrowRight className="ms-1" size={14} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>

        <div className="col-lg-3 col-md-6">
          <AnimatedCard delay={0.2} className="h-100">
            <div className="d-flex flex-column h-100 text-center">
              <div className="d-inline-flex align-self-center bg-success bg-opacity-10 p-3 rounded-pill mb-3 text-success">
                <Activity size={28} />
              </div>
              <h3 className="h5 mb-2 fw-bold">Active Jobs</h3>
              <p className="text-muted small mb-4 flex-grow-1">
                Monitor real-time progress of running scans.
              </p>
              <AnimatedButton href="/jobs" className="w-100" variant="outline-success" size="sm">
                <span>View</span>
                <ArrowRight className="ms-1" size={14} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>

        <div className="col-lg-3 col-md-6">
          <AnimatedCard delay={0.3} className="h-100">
            <div className="d-flex flex-column h-100 text-center">
              <div className="d-inline-flex align-self-center bg-info bg-opacity-10 p-3 rounded-pill mb-3 text-info">
                <History size={28} />
              </div>
              <h3 className="h5 mb-2 fw-bold">History</h3>
              <p className="text-muted small mb-4 flex-grow-1">
                Review and compare all previous scan results.
              </p>
              <AnimatedButton href="/history" className="w-100" variant="outline-info" size="sm">
                <span>History</span>
                <ArrowRight className="ms-1" size={14} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>

        <div className="col-lg-3 col-md-6">
          <AnimatedCard delay={0.4} className="h-100">
            <div className="d-flex flex-column h-100 text-center">
              <div className="d-inline-flex align-self-center bg-warning bg-opacity-10 p-3 rounded-pill mb-3 text-warning">
                <ShieldCheck size={28} />
              </div>
              <h3 className="h5 mb-2 fw-bold">My Scans</h3>
              <p className="text-muted small mb-4 flex-grow-1">
                Access your bookmarked and saved scans.
              </p>
              <AnimatedButton href="/saved-scans" className="w-100" variant="outline-warning" size="sm">
                <span>View</span>
                <ArrowRight className="ms-1" size={14} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>
      </div>
    </div>
  );
}
