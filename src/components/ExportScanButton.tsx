'use client';

import React, { useState } from 'react';
import { Download, FileJson, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import { ScanResult } from '@/lib/scanner';
import { AnimatedButton } from './AnimatedButton';

// Define SerializedScanResult type to match the one in ScanResults component
interface SerializedScanResult extends Omit<ScanResult, 'foundOn'> {
    foundOn: string[]; // Instead of Set<string>
}

interface ExportScanButtonProps {
    scanId?: string;
    scanUrl: string;
    results: SerializedScanResult[];
    className?: string;
}

export default function ExportScanButton({ scanId, scanUrl, results, className = '' }: ExportScanButtonProps) {
    const [isExporting, setIsExporting] = useState<boolean>(false);
    const [exportFormat, setExportFormat] = useState<string | null>(null);

    const handleExport = async (format: 'json' | 'csv' | 'html') => {
        try {
            setIsExporting(true);
            setExportFormat(format);

            // Generate the export data
            let data: string;
            let fileName: string;
            let mimeType: string;

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const baseFileName = `link-scan-${scanUrl.replace(/[^a-z0-9]/gi, '-').substring(0, 30)}-${timestamp}`;

            if (format === 'json') {
                data = JSON.stringify({
                    scanUrl,
                    scanDate: new Date().toISOString(),
                    scanId,
                    results
                }, null, 2);
                fileName = `${baseFileName}.json`;
                mimeType = 'application/json';
            } else if (format === 'csv') {
                // CSV header
                const headers = ['URL', 'Status', 'Status Code', 'Error Message', 'Found On Pages'];

                // CSV rows
                const rows = results.map(link => [
                    link.url,
                    link.status,
                    link.statusCode || '',
                    link.errorMessage || '',
                    Array.isArray(link.foundOn)
                        ? link.foundOn.join('; ')
                        : Array.from(link.foundOn || []).join('; ')
                ]);

                // Combine header and rows
                const csvContent = [
                    headers.join(','),
                    ...rows.map(row => row.map(cell =>
                        // Escape CSV values properly
                        `"${String(cell).replace(/"/g, '""')}"`
                    ).join(','))
                ].join('\n');

                data = csvContent;
                fileName = `${baseFileName}.csv`;
                mimeType = 'text/csv';
            } else {
                // HTML export
                // Create a professional, interactive HTML report with tabs and accordions
                const brokenLinks = results.filter(r => r.status === 'broken' || r.status === 'error');
                const okLinks = results.filter(r => r.status === 'ok');
                const externalLinks = results.filter(r => r.status === 'external');
                const skippedLinks = results.filter(r => r.status === 'skipped');

                const totalCount = results.length;
                const brokenCount = brokenLinks.length;
                const okCount = okLinks.length;
                const externalCount = externalLinks.length;
                const skippedCount = skippedLinks.length;

                const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Link Checker Report - ${scanUrl}</title>
    <style>
        :root {
            --bg-color: #030712;
            --card-bg: #111827;
            --border-color: #1f2937;
            --text-primary: #f9fafb;
            --text-secondary: #9ca3af;
            --accent-primary: #8b5cf6;
            --accent-secondary: #a78bfa;
            --status-ok: #10b981;
            --status-broken: #ef4444;
            --status-external: #3b82f6;
            --status-skipped: #6b7280;
            --status-error: #f59e0b;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            line-height: 1.5;
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }

        a {
            color: var(--accent-secondary);
            text-decoration: none;
            transition: color 0.2s;
        }

        a:hover {
            color: var(--accent-primary);
            text-decoration: underline;
        }

        .header {
            margin-bottom: 3rem;
            text-align: center;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 0.5rem;
            background: linear-gradient(to right, var(--accent-primary), var(--accent-secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .scan-info {
            color: var(--text-secondary);
            font-size: 0.875rem;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1.5rem;
            margin-bottom: 3rem;
        }

        .summary-card {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 1rem;
            padding: 1.5rem;
            text-align: center;
            transition: transform 0.2s, border-color 0.2s;
        }

        .summary-card:hover {
            transform: translateY(-4px);
            border-color: var(--accent-primary);
        }

        .summary-label {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
        }

        .summary-value {
            font-size: 2rem;
            font-weight: 700;
        }

        .value-total { color: var(--text-primary); }
        .value-broken { color: var(--status-broken); }
        .value-ok { color: var(--status-ok); }
        .value-external { color: var(--status-external); }
        .value-skipped { color: var(--status-skipped); }

        .tabs {
            display: flex;
            gap: 0.5rem;
            margin-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.5rem;
            overflow-x: auto;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            padding: 0.75rem 1.25rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            border-radius: 0.5rem;
            white-space: nowrap;
            transition: all 0.2s;
        }

        .tab-btn:hover {
            background-color: var(--border-color);
            color: var(--text-primary);
        }

        .tab-btn.active {
            background-color: var(--accent-primary);
            color: white;
        }

        .tab-content {
            display: none;
            animation: fadeIn 0.3s ease-out;
        }

        .tab-content.active {
            display: block;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .link-list {
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .link-item {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 0.75rem;
            overflow: hidden;
        }

        .link-header {
            padding: 1rem 1.5rem;
            display: flex;
            align-items: center;
            justify-content: space-between;
            cursor: pointer;
            user-select: none;
            transition: background-color 0.2s;
        }

        .link-header:hover {
            background-color: rgba(31, 41, 55, 0.5);
        }

        .link-main {
            display: flex;
            align-items: center;
            gap: 1rem;
            flex-grow: 1;
            min-width: 0;
        }

        .status-badge {
            font-size: 0.7rem;
            font-weight: 700;
            padding: 0.25rem 0.6rem;
            border-radius: 9999px;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .badge-ok { background-color: rgba(16, 185, 129, 0.1); color: var(--status-ok); border: 1px solid rgba(16, 185, 129, 0.2); }
        .badge-broken { background-color: rgba(239, 68, 68, 0.1); color: var(--status-broken); border: 1px solid rgba(239, 68, 68, 0.2); }
        .badge-external { background-color: rgba(59, 130, 246, 0.1); color: var(--status-external); border: 1px solid rgba(59, 130, 246, 0.2); }
        .badge-skipped { background-color: rgba(107, 114, 128, 0.1); color: var(--status-skipped); border: 1px solid rgba(107, 114, 128, 0.2); }
        .badge-error { background-color: rgba(245, 158, 11, 0.1); color: var(--status-error); border: 1px solid rgba(245, 158, 11, 0.2); }

        .url-text {
            font-weight: 500;
            font-size: 0.9375rem;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .link-meta {
            display: flex;
            align-items: center;
            gap: 1rem;
            color: var(--text-secondary);
            font-size: 0.8125rem;
        }

        .chevron {
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .link-item.expanded .chevron {
            transform: rotate(180deg);
        }

        .link-details {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background-color: rgba(3, 7, 18, 0.3);
            border-top: 1px solid transparent;
        }

        .link-item.expanded .link-details {
            max-height: 1000px;
            border-top-color: var(--border-color);
        }

        .details-inner {
            padding: 1.5rem;
        }

        .detail-section {
            margin-bottom: 1.5rem;
        }

        .detail-section:last-child {
            margin-bottom: 0;
        }

        .detail-title {
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--text-secondary);
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .pages-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .page-link {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background-color: var(--bg-color);
            border: 1px solid var(--border-color);
            border-radius: 0.5rem;
            font-size: 0.875rem;
        }

        .error-msg {
            padding: 0.75rem 1rem;
            background-color: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 0.5rem;
            color: var(--status-broken);
            font-size: 0.875rem;
        }

        @media (max-width: 640px) {
            body { padding: 1rem; }
            .summary-grid { grid-template-columns: 1fr 1fr; }
            .link-meta { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Link Checker Report</h1>
        <div class="scan-info">
            Scan of: <strong>${scanUrl}</strong><br>
            Generated on: <strong>${new Date().toLocaleString()}</strong>
            ${scanId ? `<br>Scan ID: <strong>${scanId}</strong>` : ''}
        </div>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <div class="summary-label">Total</div>
            <div class="summary-value value-total">${totalCount}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Broken</div>
            <div class="summary-value value-broken">${brokenCount}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Working</div>
            <div class="summary-value value-ok">${okCount}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">External</div>
            <div class="summary-value value-external">${externalCount}</div>
        </div>
        <div class="summary-card">
            <div class="summary-label">Skipped</div>
            <div class="summary-value value-skipped">${skippedCount}</div>
        </div>
    </div>

    <div class="tabs">
        <button class="tab-btn active" onclick="showTab('problematic')">Problematic (${brokenCount})</button>
        <button class="tab-btn" onclick="showTab('working')">Working (${okCount})</button>
        <button class="tab-btn" onclick="showTab('external')">External (${externalCount})</button>
        <button class="tab-btn" onclick="showTab('skipped')">Skipped (${skippedCount})</button>
    </div>

    <div id="problematic" class="tab-content active">
        <div class="link-list">
            ${brokenLinks.length > 0 ? brokenLinks.map((link, idx) => renderLinkItem(link, 'p', idx)).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No problematic links found.</p>'}
        </div>
    </div>

    <div id="working" class="tab-content">
        <div class="link-list">
            ${okLinks.length > 0 ? okLinks.map((link, idx) => renderLinkItem(link, 'w', idx)).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No working links found.</p>'}
        </div>
    </div>

    <div id="external" class="tab-content">
        <div class="link-list">
            ${externalLinks.length > 0 ? externalLinks.map((link, idx) => renderLinkItem(link, 'e', idx)).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No external links found.</p>'}
        </div>
    </div>

    <div id="skipped" class="tab-content">
        <div class="link-list">
            ${skippedLinks.length > 0 ? skippedLinks.map((link, idx) => renderLinkItem(link, 's', idx)).join('') : '<p style="text-align: center; color: var(--text-secondary); padding: 2rem;">No skipped links found.</p>'}
        </div>
    </div>

    <script>
        function showTab(tabId) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            event.target.classList.add('active');
        }

        function toggleLink(id) {
            document.getElementById(id).classList.toggle('expanded');
        }
    </script>
</body>
</html>`;

                function renderLinkItem(link: SerializedScanResult, prefix: string, idx: number) {
                    const id = `link-${prefix}-${idx}`;
                    const statusLabel = link.status + (link.statusCode ? ` (${link.statusCode})` : '');

                    return `
            <div class="link-item" id="${id}">
                <div class="link-header" onclick="toggleLink('${id}')">
                    <div class="link-main">
                        <span class="status-badge badge-${link.status}">${statusLabel}</span>
                        <span class="url-text" title="${link.url}">${link.url}</span>
                    </div>
                    <div class="link-meta">
                        <span>${link.foundOn.length} page${link.foundOn.length === 1 ? '' : 's'}</span>
                        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                </div>
                <div class="link-details">
                    <div class="details-inner">
                        ${link.errorMessage ? `
                        <div class="detail-section">
                            <div class="detail-title">Error Message</div>
                            <div class="error-msg">${link.errorMessage}</div>
                        </div>` : ''}
                        
                        <div class="detail-section">
                            <div class="detail-title">Found On</div>
                            <ul class="pages-list">
                                ${link.foundOn.map(page => `
                                    <li>
                                        <a href="${page}" target="_blank" class="page-link">
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                            ${page}
                                        </a>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <div class="detail-section">
                            <div class="detail-title">Actions</div>
                            <div style="display: flex; gap: 0.75rem;">
                                <a href="${link.url}" target="_blank" class="page-link" style="color: var(--text-primary);">Open Link</a>
                                <button onclick="navigator.clipboard.writeText('${link.url}')" class="page-link" style="background: transparent; color: var(--text-primary); cursor: pointer; width: auto;">Copy URL</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
                }

                data = html;
                fileName = `${baseFileName}.html`;
                mimeType = 'text/html';
            }

            // Create download blob
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);

            // Create and trigger download link
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();

            // Clean up
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setIsExporting(false);
            setExportFormat(null);
        }
    };

    return (
        <div className={`dropdown ${className}`}>
            <AnimatedButton
                className="btn btn-primary d-flex align-items-center gap-2"
                id="exportDropdown"
                data-bs-toggle="dropdown"
                aria-expanded="false"
                disabled={isExporting}
            >
                {isExporting ? (
                    <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Processing {exportFormat?.toUpperCase()}</span>
                    </>
                ) : (
                    <>
                        <Download size={16} />
                        <span>Generate Report</span>
                        <ChevronDown size={14} className="ms-1 opacity-50" />
                    </>
                )}
            </AnimatedButton>

            <ul className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 p-2" aria-labelledby="exportDropdown">
                <li><h6 className="dropdown-header x-small fw-bold text-uppercase tracking-widest text-muted pb-2">Export Data formats</h6></li>
                <li>
                    <button className="dropdown-item rounded-3 d-flex align-items-center py-2" onClick={() => handleExport('json')}>
                        <div className="p-2 bg-primary bg-opacity-10 text-primary rounded-2 me-3">
                            <FileJson size={18} />
                        </div>
                        <div>
                            <div className="fw-bold small">JSON Structure</div>
                            <div className="x-small text-muted">Raw data for API integration</div>
                        </div>
                    </button>
                </li>
                <li>
                    <button className="dropdown-item rounded-3 d-flex align-items-center py-2" onClick={() => handleExport('csv')}>
                        <div className="p-2 bg-success bg-opacity-10 text-success rounded-2 me-3">
                            <FileSpreadsheet size={18} />
                        </div>
                        <div>
                            <div className="fw-bold small">CSV Spreadsheet</div>
                            <div className="x-small text-muted">Open in Excel or Google Sheets</div>
                        </div>
                    </button>
                </li>
                <li className="my-2"><hr className="dropdown-divider opacity-50" /></li>
                <li>
                    <button className="dropdown-item rounded-3 d-flex align-items-center py-2" onClick={() => handleExport('html')}>
                        <div className="p-2 bg-info bg-opacity-10 text-info rounded-2 me-3">
                            <FileText size={18} />
                        </div>
                        <div>
                            <div className="fw-bold small">Interactive HTML</div>
                            <div className="x-small text-muted">Self-contained executive report</div>
                        </div>
                    </button>
                </li>
            </ul>
        </div>
    );
}
