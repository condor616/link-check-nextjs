'use client';

import React, { useState, useEffect } from 'react';
import {
  AlertCircle,
  Loader2,
  Clock,
  Link as LinkIcon,
  History,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';
import { AnimatedCard } from '@/components/AnimatedCard';
import { AnimatedButton } from '@/components/AnimatedButton';
import { TransitionLink } from '@/components/TransitionLink';

import { Logo } from '@/components/Logo';

export default function HomePage() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastScan, setLastScan] = useState<{
    url: string;
    date: string;
    brokenLinks: number;
    totalLinks: number;
    id: string;
  } | null>(null);

  useEffect(() => {
    const fetchLastScan = async () => {
      try {
        const response = await fetch('/api/last-scan');
        if (response.ok) {
          const data = await response.json();
          if (data && data.id) {
            setLastScan(data);
          } else {
            setLastScan(null);
          }
        }
      } catch (error) {
        console.error('Error fetching last scan:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLastScan();
  }, []);

  return (
    <div className="w-100 py-4 fade-in-up">
      {/* Header Section */}
      <div className="text-center mb-5 mt-3">
        <div className="d-inline-flex bg-primary bg-opacity-10 p-3 rounded-pill mb-3 text-primary">
          <Logo size={48} />
        </div>
        <h1 className="display-4 fw-bold text-dark dark:text-light">LinkChecker <span className="text-primary">Pro</span></h1>
        <p className="lead text-muted">A professional suite for website integrity and health monitoring.</p>
      </div>

      <div className="row g-4 mb-5">
        <div className="col-md-6">
          <AnimatedCard delay={0.1}>
            <div className="d-flex align-items-center mb-3 text-primary">
              <AlertCircle className="me-2" size={24} />
              <h3 className="h4 mb-0 fw-bold">New Scan</h3>
            </div>
            <p className="text-muted mb-4">
              Perform a deep analysis of your website's internal and external links to ensure a flawless user experience.
            </p>
            <div className="mt-auto">
              <AnimatedButton href="/scan" className="w-100 py-3" variant="primary">
                <span>Start New Analysis</span>
                <ArrowRight className="ms-2" size={18} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>

        <div className="col-md-6">
          <AnimatedCard delay={0.2}>
            <div className="d-flex align-items-center mb-3 text-primary">
              <History className="me-2" size={24} />
              <h3 className="h4 mb-0 fw-bold">Scan History</h3>
            </div>
            <p className="text-muted mb-4">
              Review and compare previous audit results, tracks improvements, and export professional reports for your team.
            </p>
            <div className="mt-auto">
              <AnimatedButton href="/saved-scans" className="w-100 py-3" variant="outline-primary">
                <span>Access Archives</span>
                <ArrowRight className="ms-2" size={18} />
              </AnimatedButton>
            </div>
          </AnimatedCard>
        </div>
      </div>

      <section className="mb-5">
        <div className="d-flex align-items-center justify-content-between mb-4">
          <h2 className="h4 fw-bold m-0 border-start border-primary border-4 ps-3">Latest Activity</h2>
          {lastScan && (
            <TransitionLink href="/saved-scans" className="btn btn-link text-primary fw-semibold text-decoration-none p-0">
              View All History
            </TransitionLink>
          )}
        </div>

        {isLoading ? (
          <div className="card prof-card border-dashed">
            <div className="card-body py-5 text-center">
              <Loader2 className="spinner-border spinner-border-sm text-primary me-2" role="status" />
              <span className="text-muted">Analyzing history...</span>
            </div>
          </div>
        ) : lastScan ? (
          <AnimatedCard delay={0.3}>
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div className="d-flex align-items-center gap-3">
                <div className="bg-light dark:bg-dark p-3 rounded-circle text-primary border shadow-sm">
                  <LinkIcon size={24} />
                </div>
                <div>
                  <h4 className="h5 fw-bold mb-1 text-dark dark:text-light">{lastScan.url}</h4>
                  <div className="d-flex align-items-center text-muted small">
                    <Clock className="me-1" size={14} />
                    {new Date(lastScan.date).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                <div className="px-3 py-2 bg-success bg-opacity-10 text-success rounded-3 border border-success border-opacity-20 text-center flex-grow-1">
                  <div className="fw-bold">{lastScan.totalLinks}</div>
                  <div className="small opacity-75">Processed</div>
                </div>
                <div className="px-3 py-2 bg-danger bg-opacity-10 text-danger rounded-3 border border-danger border-opacity-20 text-center flex-grow-1">
                  <div className="fw-bold">{lastScan.brokenLinks}</div>
                  <div className="small opacity-75">Broken</div>
                </div>
              </div>

              <div className="ms-md-3">
                <AnimatedButton href={`/history/${lastScan.id}`} variant="dark" size="sm">
                  <span>Details</span>
                  <ArrowRight className="ms-1" size={14} />
                </AnimatedButton>
              </div>
            </div>
          </AnimatedCard>
        ) : (
          <div className="card prof-card bg-light dark:bg-dark border-dashed">
            <div className="card-body py-5 text-center">
              <div className="mb-3 text-muted opacity-50">
                <History size={48} />
              </div>
              <h4 className="fw-bold text-dark dark:text-light">No Scan Activity Found</h4>
              <p className="text-muted mb-4">You haven't performed any link audits yet. Start your first scan to monitor your site's health.</p>
              <AnimatedButton href="/scan" variant="primary">
                Launch First Audit
              </AnimatedButton>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
