'use client';

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileJson, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { ScanResult } from '@/lib/scanner';

// Define SerializedScanResult type to match the one in ScanResults component
interface SerializedScanResult extends Omit<ScanResult, 'foundOn' | 'htmlContexts'> {
  foundOn: string[]; // Instead of Set<string>
  htmlContexts?: Record<string, string[]>; // Instead of Map<string, string[]>
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
        // Create a simple but styled HTML report
        const brokenLinks = results.filter(r => r.status === 'broken' || r.status === 'error');
        const okLinks = results.filter(r => r.status === 'ok');
        const externalLinks = results.filter(r => r.status === 'external');
        const skippedLinks = results.filter(r => r.status === 'skipped');
        
        // Function to render a table of links
        const renderLinkTable = (links: SerializedScanResult[], isProblematic = false) => {
          if (links.length === 0) {
            return `<p>No ${isProblematic ? 'problematic' : ''} links found.</p>`;
          }
          
          return `
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Status</th>
                ${isProblematic ? '<th>Found On</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${links.map(link => `
                <tr>
                  <td><a href="${link.url}" target="_blank">${link.url}</a></td>
                  <td>
                    <span class="badge badge-${link.status}">
                      ${link.status}${link.statusCode ? ` (${link.statusCode})` : ''}
                    </span>
                    ${link.errorMessage ? `<div>${link.errorMessage}</div>` : ''}
                  </td>
                  ${isProblematic ? `
                  <td>
                    Found on ${link.foundOn.length} page(s)
                    <div class="details">
                      <ul>
                        ${link.foundOn.map(page => `<li><a href="${page}" target="_blank">${page}</a></li>`).join('')}
                      </ul>
                    </div>
                  </td>
                  ` : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
          `;
        };
        
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Link Scan Report - ${scanUrl}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    h1, h2, h3 {
      color: #111;
    }
    .header {
      margin-bottom: 30px;
      border-bottom: 1px solid #eee;
      padding-bottom: 15px;
    }
    .summary {
      display: flex;
      flex-wrap: wrap;
      gap: 15px;
      margin-bottom: 20px;
      background-color: #f9f9f9;
      padding: 15px;
      border-radius: 5px;
    }
    .summary-item {
      display: flex;
      flex-direction: column;
    }
    .summary-label {
      font-size: 0.8rem;
      color: #666;
    }
    .summary-value {
      font-weight: 500;
    }
    .tab-panel {
      margin-bottom: 20px;
    }
    .tab-panel::before {
      content: attr(data-title);
      font-size: 1.5rem;
      font-weight: bold;
      display: block;
      margin-bottom: 15px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 10px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .badge-broken {
      background-color: #fee2e2;
      color: #b91c1c;
    }
    .badge-error {
      background-color: #fee2e2;
      color: #b91c1c;
    }
    .badge-ok {
      background-color: #dcfce7;
      color: #166534;
    }
    .badge-external {
      background-color: #e0f2fe;
      color: #0369a1;
    }
    .badge-skipped {
      background-color: #f3f4f6;
      color: #4b5563;
    }
    .details {
      margin: 10px 0;
      padding: 10px;
      background-color: #f9fafb;
      border-radius: 4px;
    }
    .show-more {
      cursor: pointer;
      color: #2563eb;
      text-decoration: underline;
    }
    @media print {
      .tab-list {
        display: none;
      }
      .tab-panel {
        display: block !important;
        margin-bottom: 30px;
      }
      .tab-panel::before {
        content: attr(data-title);
        font-size: 1.5rem;
        font-weight: bold;
        display: block;
        margin-bottom: 15px;
        border-bottom: 1px solid #eee;
        padding-bottom: 5px;
      }
    }
  </style>
  <script>
    document.addEventListener('DOMContentLoaded', function() {
      // Implement show/hide functionality for expanded views
      const showMoreLinks = document.querySelectorAll('.show-more');
      showMoreLinks.forEach(link => {
        link.addEventListener('click', function() {
          const detailsId = this.getAttribute('data-target');
          const details = document.getElementById(detailsId);
          if (details) {
            details.style.display = details.style.display === 'none' ? 'block' : 'none';
            this.textContent = details.style.display === 'none' ? 'Show more...' : 'Show less';
          }
        });
      });
    });
  </script>
</head>
<body>
  <div class="header">
    <h1>Link Scan Report</h1>
    <p>Scan of: <strong>${scanUrl}</strong></p>
    <p>Date: <strong>${new Date().toLocaleString()}</strong></p>
    ${scanId ? `<p>Scan ID: <strong>${scanId}</strong></p>` : ''}
  </div>
  
  <div class="summary">
    <div class="summary-item">
      <span class="summary-label">Total Links</span>
      <span class="summary-value">${results.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Broken Links</span>
      <span class="summary-value">${brokenLinks.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Working Links</span>
      <span class="summary-value">${okLinks.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">External Links</span>
      <span class="summary-value">${externalLinks.length}</span>
    </div>
    <div class="summary-item">
      <span class="summary-label">Skipped Links</span>
      <span class="summary-value">${skippedLinks.length}</span>
    </div>
  </div>
  
  <div class="tab-panel" data-title="Problematic Links (${brokenLinks.length})">
    ${renderLinkTable(brokenLinks, true)}
  </div>
  
  <div class="tab-panel" data-title="OK Links (${okLinks.length})">
    ${renderLinkTable(okLinks)}
  </div>
  
  <div class="tab-panel" data-title="External Links (${externalLinks.length})">
    ${renderLinkTable(externalLinks)}
  </div>
  
  <div class="tab-panel" data-title="Skipped Links (${skippedLinks.length})">
    ${renderLinkTable(skippedLinks)}
  </div>
  
  <div class="footer">
    <p>Generated by Link Checker</p>
  </div>
</body>
</html>
        `;
        
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={className}>
          {isExporting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Exporting {exportFormat?.toUpperCase()}...
            </>
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" />
              Export
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleExport('json')} disabled={isExporting}>
          <FileJson className="h-4 w-4 mr-2" />
          <span>JSON</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')} disabled={isExporting}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          <span>CSV</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('html')} disabled={isExporting}>
          <FileText className="h-4 w-4 mr-2" />
          <span>HTML Report</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 