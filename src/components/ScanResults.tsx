import React, { useState, useEffect, useMemo } from 'react';
import { ScanResult } from '@/lib/scanner';
import {
  ExternalLink,
  ClipboardCopy,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowUpRight,
  ChevronDown,
  Info,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ListFilter,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Lock as LockIcon,
  Search,
  Hash,
  Filter,
  ArrowRight,
  Activity
} from 'lucide-react';
// cheerio removal: using native DOMParser instead
import { AnimatedCard } from './AnimatedCard';
import { AnimatedButton } from './AnimatedButton';
import ExportScanButton from './ExportScanButton';
import { ExpandableUrl } from './ExpandableUrl';

// Update the ScanResult interface for serialized HTML contexts
interface SerializedScanResult extends Omit<ScanResult, 'foundOn' | 'htmlContexts'> {
  foundOn: string[]; // Instead of Set<string>
  htmlContexts?: Record<string, string[]>; // Instead of Map<string, string[]>
  usedAuth?: boolean; // Include the usedAuth flag from ScanResult
}

interface ScanResultsProps {
  results: SerializedScanResult[];
  scanUrl: string;
  itemsPerPage?: number;
  scanId?: string;
  scanConfig?: any; // Add scanConfig to receive the original scan configuration
  searchQuery?: string;
}

export default function ScanResults({ results, scanUrl: _scanUrl, itemsPerPage = 10, scanId, scanConfig, searchQuery = '' }: ScanResultsProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [currentItemsPerPage, setCurrentItemsPerPage] = useState<number>(itemsPerPage);
  const [recheckingUrls, setRecheckingUrls] = useState<Set<string>>(new Set());
  const [recheckErrors, setRecheckErrors] = useState<Map<string, string>>(new Map());
  const [recheckSuccess, setRecheckSuccess] = useState<Map<string, string>>(new Map());
  const [localResults, setLocalResults] = useState<SerializedScanResult[]>(results);

  // Use 'all' as the default tab 
  const [activeTab, setActiveTab] = useState<string>("all");
  const [isShowingHtmlContext, setShowHtmlContext] = useState<string | null>(null);

  // Update local results when props change
  useEffect(() => {
    setLocalResults(results);
  }, [results]);

  // Reset current page when search query changes
  useEffect(() => {
    setCurrentPage(1);
    setExpandedItems(new Set());
  }, [searchQuery]);

  // Filter results based on search query
  const filteredResults = useMemo(() => {
    if (!searchQuery) return localResults;
    const query = searchQuery.toLowerCase();
    return localResults.filter(r =>
      r.url.toLowerCase().includes(query) ||
      (r.errorMessage && r.errorMessage.toLowerCase().includes(query))
    );
  }, [localResults, searchQuery]);

  // Memoize filtering results to avoid recalculation on every render
  const {
    skippedLinks,
    brokenLinks,
    errorLinks,
    externalLinks,
    okLinks,
    problematicLinks,
    skippedUrls
  } = useMemo(() => {
    // First, identify skipped links - they take priority over other categories
    const skipped = filteredResults.filter(r => r.status === 'skipped');
    // Extract all skipped URLs to avoid duplicating them in other categories
    const sUrls = new Set(skipped.map(r => r.url));

    // Then process broken links, excluding those already in skipped
    const broken = filteredResults.filter(r =>
      !sUrls.has(r.url) &&
      (r.status === 'broken' || (r.statusCode !== undefined && r.statusCode >= 400))
    );

    // Error links, excluding skipped
    const error = filteredResults.filter(r =>
      !sUrls.has(r.url) &&
      r.status === 'error'
    );

    // External links, excluding skipped
    const external = filteredResults.filter(r =>
      !sUrls.has(r.url) &&
      r.status === 'external'
    );

    // OK links, excluding skipped, broken and external
    const ok = filteredResults.filter(r => {
      return !sUrls.has(r.url) &&
        r.status === 'ok' &&
        (r.statusCode === undefined || r.statusCode < 400) &&
        !broken.some(link => link.url === r.url) &&
        !external.some(link => link.url === r.url);
    });

    // Combined problematic links (broken + error)
    const problematic = [...broken, ...error.filter(link =>
      // Avoid duplicates from links that may be in both arrays
      !broken.some(b => b.url === link.url)
    )];

    return {
      skippedLinks: skipped,
      brokenLinks: broken,
      errorLinks: error,
      externalLinks: external,
      okLinks: ok,
      problematicLinks: problematic,
      skippedUrls: sUrls
    };
  }, [filteredResults]);

  // Group links by URL for pagination calculation
  const getGroupedLinks = (links: SerializedScanResult[]) => {
    const groupedLinks = new Map<string, SerializedScanResult>();
    links.forEach(link => {
      if (!groupedLinks.has(link.url)) {
        groupedLinks.set(link.url, { ...link });
      } else {
        // Merge foundOn arrays instead of using add() on Sets
        const existingLink = groupedLinks.get(link.url)!;
        // Use arrays for foundOn instead of sets
        link.foundOn.forEach(page => {
          if (!existingLink.foundOn.includes(page)) {
            existingLink.foundOn.push(page);
          }
        });

        // Merge htmlContexts objects if they exist
        if (link.htmlContexts) {
          if (!existingLink.htmlContexts) {
            existingLink.htmlContexts = {};
          }

          Object.entries(link.htmlContexts).forEach(([page, contexts]) => {
            if (!existingLink.htmlContexts![page]) {
              existingLink.htmlContexts![page] = [...contexts];
            } else {
              existingLink.htmlContexts![page] = [
                ...existingLink.htmlContexts![page],
                ...contexts
              ];
            }
          });
        }
      }
    });
    return Array.from(groupedLinks.values());
  };

  // Get unique link counts for tabs
  const getUniqueCount = (links: SerializedScanResult[]) => getGroupedLinks(links).length;
  const uniqueProblematicCount = getUniqueCount(problematicLinks);
  const uniqueOkCount = getUniqueCount(okLinks);
  const uniqueExternalCount = getUniqueCount(externalLinks);
  const uniqueSkippedCount = getUniqueCount(skippedLinks);
  const uniqueAllCount = getUniqueCount(filteredResults);

  // Pagination state and handlers

  // Get current list based on active tab
  const getCurrentList = () => {
    switch (activeTab) {
      case "problematic": return problematicLinks;
      case "ok": return okLinks;
      case "external": return externalLinks;
      case "skipped": return skippedLinks;
      case "all": return filteredResults;
      default: return problematicLinks;
    }
  };

  const currentList = getCurrentList();

  const uniqueCurrentList = getGroupedLinks(currentList);
  const totalPages = Math.ceil(uniqueCurrentList.length / currentItemsPerPage);
  const startIndex = (currentPage - 1) * currentItemsPerPage;
  const endIndex = Math.min(startIndex + currentItemsPerPage, uniqueCurrentList.length);

  // Reset page when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setCurrentPage(1);
    setExpandedItems(new Set());
  };

  // Pagination controls
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Handle items per page change
  const handleItemsPerPageChange = (value: string) => {
    const newItemsPerPage = parseInt(value, 10);
    setCurrentItemsPerPage(newItemsPerPage);
    // Adjust current page to maintain approximate scroll position
    const currentTopItem = startIndex;
    const newPage = Math.floor(currentTopItem / newItemsPerPage) + 1;
    setCurrentPage(Math.max(1, Math.min(newPage, Math.ceil(uniqueCurrentList.length / newItemsPerPage))));
  };

  // Toggle item expansion
  const toggleItemExpansion = (url: string) => {
    const newExpandedItems = new Set(expandedItems);
    if (expandedItems.has(url)) {
      newExpandedItems.delete(url);
    } else {
      newExpandedItems.add(url);
    }
    setExpandedItems(newExpandedItems);
  };

  // Copy URL to clipboard
  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  // Get host from URL for display
  const getHost = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  // Format pages where a link was found
  const formatFoundOn = (foundOn: string[]) => {
    return foundOn; // Already an array, no need to convert
  };

  // Count occurrences of each unique page in foundOn
  const countUniquePages = (foundOn: string[]) => {
    const pageMap = new Map<string, number>();

    if (Array.isArray(foundOn)) {
      foundOn.forEach(page => {
        const count = pageMap.get(page) || 0;
        pageMap.set(page, count + 1);
      });
    }

    return pageMap;
  };

  // Helper to extract and clean the relevant HTML context around the link
  const cleanHtmlContext = (html: string, url: string) => {
    try {
      if (typeof window === 'undefined') {
        return 'Context view available in browser';
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Remove unwanted elements
      ['style', 'script', 'link', 'meta'].forEach(tag => {
        doc.querySelectorAll(tag).forEach(el => el.remove());
      });

      // Find the anchor tag with the broken link
      // CSS.escape is needed if url contains special characters, but might not be available in all envs
      // fallback to attribute selector with manual quoting
      let anchorElement: Element | null = null;
      try {
        anchorElement = doc.querySelector(`a[href="${url.replace(/"/g, '\\"')}"]`);
      } catch (e) {
        // fall back to iteration if querySelector fails
        const anchors = Array.from(doc.querySelectorAll('a'));
        anchorElement = anchors.find(a => a.getAttribute('href') === url) || null;
      }

      if (anchorElement) {
        // Get parent for context if it's significant
        const parentElement = anchorElement.parentElement;
        const usefulParents = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'FIGCAPTION', 'BUTTON', 'LABEL'];

        if (parentElement && usefulParents.includes(parentElement.tagName)) {
          return `<!-- Link with immediate parent -->\n${parentElement.outerHTML}`;
        }
        return `<!-- Just the link element -->\n${anchorElement.outerHTML}`;
      }

      // If exact match not found, look for partial match in href
      const possibleAnchors = Array.from(doc.querySelectorAll('a')).filter(a => {
        const href = a.getAttribute('href') || '';
        return href.includes(url) || url.includes(href);
      });

      if (possibleAnchors.length > 0) {
        return `<!-- Best matching link -->\n${possibleAnchors[0].outerHTML}`;
      }

      // Last resort: Cleaned body snippet
      const bodyContent = doc.body.innerHTML || html;
      // Basic cleanup regex for remaining artifacts if any
      const cleanedHtml = bodyContent
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .substring(0, 300);

      return `<!-- Cleaned HTML snippet -->\n${cleanedHtml}${cleanedHtml.length > 300 ? '...' : ''}`;
    } catch (e) {
      // Fallback for parsing errors
      return html.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .substring(0, 200) + (html.length > 200 ? '...' : '');
    }
  };

  // Generate a snippet of HTML context for display
  const generateHtmlContext = (url: string, page: string, occurrence: number) => {
    // Get the actual HTML context from the scan results
    const link = results.find(r => r.url === url);

    if (link && link.htmlContexts && link.htmlContexts[page]) {
      const contexts = link.htmlContexts[page];
      if (contexts && contexts.length > 0) {
        // Return the actual HTML context if available, or a default if the index doesn't exist
        const htmlContext = contexts[occurrence - 1] || contexts[0];
        return cleanHtmlContext(htmlContext, url);
      }
    }

    // Fallback if no HTML context is available
    return `<a href="${url}">Link not found in HTML context</a>`;
  };

  // Status badge component
  const StatusBadge = ({ status, code, usedAuth }: { status: string, code?: number, usedAuth?: boolean }) => {
    let bgClass = "bg-secondary";
    let icon = null;
    let label = status;

    const isBroken = code !== undefined && code >= 400;
    const displayStatus = isBroken ? 'broken' : status;

    switch (displayStatus) {
      case 'broken':
        bgClass = "bg-danger";
        icon = <XCircle size={12} className="me-1" />;
        label = "BROKEN";
        break;
      case 'error':
        bgClass = "bg-danger";
        icon = <AlertTriangle size={12} className="me-1" />;
        label = "ERROR";
        break;
      case 'ok':
        bgClass = "bg-success";
        icon = <CheckCircle2 size={12} className="me-1" />;
        label = "SUCCESS";
        break;
      case 'external':
        bgClass = "bg-primary";
        icon = <ArrowUpRight size={12} className="me-1" />;
        label = "EXTERNAL";
        break;
      case 'skipped':
        bgClass = "bg-light text-dark border";
        label = "SKIPPED";
        break;
    }

    return (
      <div className="d-flex align-items-center gap-1">
        <span className={`badge rounded-pill ${bgClass} d-flex align-items-center px-2 py-1 small fw-bold tracking-tight`}>
          {icon}
          {label}{code ? ` [${code}]` : ''}
        </span>
        {usedAuth && (
          <span className="badge rounded-pill bg-info bg-opacity-10 text-info border border-info border-opacity-25 d-flex align-items-center px-2 py-1 small fw-bold" title="HTTP Basic Auth was used">
            <LockIcon size={10} className="me-1" />
            AUTH
          </span>
        )}
      </div>
    );
  };

  // Render pagination controls
  const renderPagination = () => {
    if (uniqueCurrentList.length === 0) return null;

    return (
      <div className="d-flex flex-column flex-md-row align-items-center justify-content-between py-3 px-1 border-bottom border-opacity-10">
        <div className="d-flex align-items-center gap-3 mb-3 mb-md-0">
          <div className="text-muted x-small fw-semibold text-uppercase tracking-wider">
            Displaying {startIndex + 1} - {endIndex} of {uniqueCurrentList.length}
          </div>

          <div className="dropdown">
            <button className="btn btn-sm btn-outline-secondary dropdown-toggle x-small py-1 px-2 border-0 bg-light" type="button" data-bs-toggle="dropdown">
              <Filter size={12} className="me-1" /> {currentItemsPerPage} / page
            </button>
            <ul className="dropdown-menu shadow-sm border-0 small">
              <li><button className="dropdown-item py-1" onClick={() => handleItemsPerPageChange('10')}>10 items</button></li>
              <li><button className="dropdown-item py-1" onClick={() => handleItemsPerPageChange('25')}>25 items</button></li>
              <li><button className="dropdown-item py-1" onClick={() => handleItemsPerPageChange('50')}>50 items</button></li>
              <li><button className="dropdown-item py-1" onClick={() => handleItemsPerPageChange('100')}>100 items</button></li>
            </ul>
          </div>
        </div>

        <nav aria-label="Pagination">
          <ul className="pagination pagination-sm mb-0 gap-1 border-0">
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link border-0 rounded-circle p-2 d-flex align-items-center justify-content-center bg-light" onClick={() => goToPage(1)} style={{ width: '32px', height: '32px' }}>
                <ChevronsLeft size={16} />
              </button>
            </li>
            <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
              <button className="page-link border-0 rounded-circle p-2 d-flex align-items-center justify-content-center bg-light mx-1" onClick={() => goToPage(currentPage - 1)} style={{ width: '32px', height: '32px' }}>
                <ChevronLeft size={16} />
              </button>
            </li>

            <li className="page-item disabled px-2 d-flex align-items-center">
              <span className="text-dark dark:text-light small fw-bold">Page {currentPage} of {Math.max(1, totalPages)}</span>
            </li>

            <li className={`page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`}>
              <button className="page-link border-0 rounded-circle p-2 d-flex align-items-center justify-content-center bg-light mx-1" onClick={() => goToPage(currentPage + 1)} style={{ width: '32px', height: '32px' }}>
                <ChevronRight size={16} />
              </button>
            </li>
            <li className={`page-item ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''}`}>
              <button className="page-link border-0 rounded-circle p-2 d-flex align-items-center justify-content-center bg-light" onClick={() => goToPage(totalPages)} style={{ width: '32px', height: '32px' }}>
                <ChevronsRight size={16} />
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  // Handle re-check for a URL
  const handleRecheck = async (url: string) => {
    if (recheckingUrls.has(url) || !scanId) return;

    // Add URL to rechecking set
    setRecheckingUrls(prev => new Set([...prev, url]));
    // Clear any previous error and success messages for this URL
    setRecheckErrors(prev => {
      const newErrors = new Map(prev);
      newErrors.delete(url);
      return newErrors;
    });
    setRecheckSuccess(prev => {
      const newSuccess = new Map(prev);
      newSuccess.delete(url);
      return newSuccess;
    });

    try {
      // Extract auth credentials from the original scan config if they exist
      const auth = scanConfig?.auth ? {
        username: scanConfig.auth.username,
        password: scanConfig.auth.password
      } : undefined;

      const response = await fetch('/api/recheck', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          scanId,
          auth, // Include auth credentials if they exist
          config: {
            requestTimeout: scanConfig?.requestTimeout
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to re-check URL');
      }

      // Update the local results with the new result
      setLocalResults(prev => {
        const newResults = [...prev];
        const index = newResults.findIndex(r => r.url === url);
        if (index !== -1 && data.result) {
          newResults[index] = {
            ...data.result,
            foundOn: newResults[index].foundOn, // Preserve foundOn from original scan
            htmlContexts: newResults[index].htmlContexts, // Preserve htmlContexts from original scan
            usedAuth: data.result.usedAuth // Use the usedAuth value from the re-check result
          };
        }
        return newResults;
      });

      // Set success message
      const statusMessage = data.result.status === 'ok'
        ? `Link is now working!${data.authMessage ? ` (${data.authMessage})` : ''}`
        : data.result.status === 'broken'
          ? `Link is broken (Status code: ${data.result.statusCode || 'unknown'})${data.authMessage ? ` - ${data.authMessage}` : ''
          }`
          : `Link check result: ${data.result.status}${data.authMessage ? ` - ${data.authMessage}` : ''
          }`;

      setRecheckSuccess(prev => new Map([...prev, [url, statusMessage]]));

    } catch (error) {
      console.error('Error re-checking URL:', error);
      setRecheckErrors(prev => new Map([...prev, [url, error instanceof Error ? error.message : 'Failed to re-check URL']]));
    } finally {
      setRecheckingUrls(prev => {
        const newSet = new Set(prev);
        newSet.delete(url);
        return newSet;
      });
    }
  };

  const renderLinkItem = (link: SerializedScanResult, index: number, total: number) => {
    const pagesWithCounts = countUniquePages(link.foundOn);
    const uniquePages = Array.from(pagesWithCounts.keys());
    const isExpanded = expandedItems.has(link.url);
    const isRechecking = recheckingUrls.has(link.url);

    return (
      <div key={link.url} className={`border-bottom ${index === total - 1 ? 'border-0' : ''} fade-in`} style={{ animationDelay: `${index * 0.03}s` }}>
        <div
          className={`p-3 cursor-pointer hover-bg-light transition-all ${isExpanded ? 'bg-light dark:bg-dark' : ''}`}
          onClick={() => toggleItemExpansion(link.url)}
        >
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start align-items-lg-center gap-3">
            <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0 w-100">
              <StatusBadge status={link.status} code={link.statusCode} usedAuth={link.usedAuth} />
              <div className="text-truncate flex-grow-1">
                <span className="fw-bold text-dark dark:text-light">{link.url}</span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 shrink-0 w-100 w-lg-auto justify-content-between border-top border-lg-top-0 pt-2 pt-lg-0">
              <span className="badge rounded-pill bg-light text-muted border small px-2 py-1 me-2">
                {uniquePages.length} Source{uniquePages.length !== 1 ? 's' : ''}
              </span>

              <div className="d-flex gap-1">
                {scanId && (
                  <button
                    className={`btn btn-sm ${isRechecking ? 'btn-outline-info' : 'btn-outline-primary'} border-0 rounded-pill px-3 d-flex align-items-center`}
                    onClick={(e) => { e.stopPropagation(); handleRecheck(link.url); }}
                    disabled={isRechecking}
                  >
                    {isRechecking ? (
                      <><Loader2 size={12} className="me-2 animate-spin" /> Verifying...</>
                    ) : (
                      <><RefreshCw size={12} className="me-2" /> Re-check</>
                    )}
                  </button>
                )}

                <button
                  className="btn btn-sm btn-link text-muted p-2 hover-text-primary"
                  title="Copy to clipboard"
                  onClick={(e) => { e.stopPropagation(); handleCopyUrl(link.url); }}
                >
                  {copiedUrl === link.url ? <CheckCircle2 size={16} className="text-success" /> : <ClipboardCopy size={16} />}
                </button>

                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm btn-link text-muted p-2 hover-text-primary"
                  onClick={e => e.stopPropagation()}
                >
                  <ExternalLink size={16} />
                </a>

                <div className={`ms-2 text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  <ChevronDown size={18} />
                </div>
              </div>
            </div>
          </div>

          {(link.errorMessage || recheckErrors.has(link.url) || recheckSuccess.has(link.url)) && (
            <div className="mt-3">
              {link.errorMessage && (
                <div className={`alert border-0 small py-2 d-flex align-items-center ${link.errorMessage.toLowerCase().includes('timeout') ? 'bg-warning bg-opacity-10 text-warning-emphasis' : 'bg-danger bg-opacity-10 text-danger-emphasis'}`}>
                  {link.errorMessage.toLowerCase().includes('timeout') ? <Clock size={14} className="me-2" /> : <AlertCircle size={14} className="me-2" />}
                  <div>
                    {link.errorMessage}
                    {link.errorMessage.toLowerCase().includes('timeout') && <span className="opacity-75 ms-2">(Consider extending timeout in Advanced Config)</span>}
                  </div>
                </div>
              )}

              {recheckErrors.has(link.url) && (
                <div className="alert alert-danger border-0 small py-2 d-flex align-items-center">
                  <XCircle size={14} className="me-2" />
                  <div><strong>Re-check Failed:</strong> {recheckErrors.get(link.url)}</div>
                </div>
              )}

              {recheckSuccess.has(link.url) && (
                <div className="alert alert-success border-0 small py-2 d-flex align-items-center">
                  <CheckCircle size={14} className="me-2" />
                  <div><strong>Verification Success:</strong> {recheckSuccess.get(link.url)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {isExpanded && (
          <div className="p-4 bg-light bg-opacity-50 dark:bg-dark border-top fade-in">
            <div className="mb-4">
              <div className="d-flex align-items-center mb-3">
                <Hash size={16} className="text-primary me-2" />
                <h5 className="h6 mb-0 fw-bold">Referencing Locations</h5>
              </div>

              {uniquePages.length > 0 ? (
                <div className="row g-3">
                  {uniquePages.map((page, i) => {
                    let displayText = page;
                    const occurrences = pagesWithCounts.get(page) || 0;
                    let isSelfReference = false;

                    try {
                      if (page !== 'initial') {
                        const url = new URL(page);
                        displayText = url.pathname || url.hostname;
                        if (page === link.url) { isSelfReference = true; displayText = 'SELF-LINK: ' + displayText; }
                      } else { displayText = 'Genesis Page (Root)'; }
                    } catch { /* Use original */ }

                    return (
                      <div key={i} className="col-12">
                        <div className="bg-white dark:bg-dark border rounded-3 p-3 shadow-sm hover-shadow transition-all">
                          <div className="d-flex justify-between align-items-center">
                            <div className="d-flex align-items-center gap-2 overflow-hidden">
                              <div className={`p-1 rounded-circle ${isSelfReference ? 'bg-warning text-warning' : 'bg-primary bg-opacity-10 text-primary'}`}>
                                <ArrowRight size={14} />
                              </div>
                              <a href={page === 'initial' ? '#' : page} target="_blank" rel="noreferrer" className="text-decoration-none text-dark dark:text-light fw-semibold text-truncate small">
                                {displayText}
                              </a>
                              <span className="badge bg-light text-muted border small">{occurrences} instances</span>
                            </div>

                            <div className="d-flex gap-2">
                              <button
                                className="btn btn-sm btn-outline-secondary border-0 rounded-circle"
                                onClick={(e) => { e.stopPropagation(); setShowHtmlContext(isShowingHtmlContext === `${page}-${i}` ? null : `${page}-${i}`); }}
                                title="View HTML Source"
                              >
                                <Search size={14} />
                              </button>
                            </div>
                          </div>

                          {isShowingHtmlContext === `${page}-${i}` && (
                            <div className="mt-3 border-top pt-3 fade-in">
                              <div className="d-flex justify-content-between align-items-center mb-2">
                                <span className="x-small fw-bold text-uppercase text-muted tracking-widest">Source Context</span>
                              </div>
                              <div className="max-h-[400px] overflow-auto rounded-3">
                                {Array.from({ length: Math.min(3, occurrences) }, (_, idx) => {
                                  const htmlCode = generateHtmlContext(link.url, page, idx + 1);
                                  return (
                                    <div key={idx} className="position-relative mb-2 last:mb-0">
                                      <button
                                        className="btn btn-sm btn-dark position-absolute top-2 right-2 opacity-50 hover-opacity-100 z-1"
                                        onClick={() => handleCopyUrl(htmlCode)}
                                      >
                                        <ClipboardCopy size={12} />
                                      </button>
                                      <pre className="m-0 p-3 bg-dark text-light x-small font-monospace" style={{ borderRadius: '8px', lineHeight: '1.5' }}>
                                        <code dangerouslySetInnerHTML={{
                                          __html: htmlCode
                                            .replace(/&/g, '&amp;')
                                            .replace(/</g, '&lt;')
                                            .replace(/>/g, '&gt;')
                                            .replace(/"/g, '&quot;')
                                            .replace(/(&lt;!--.*?--&gt;)/g, '<span class="text-secondary">$1</span>')
                                            .replace(
                                              new RegExp(`(href=["'])${link.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'g'),
                                              '<span class="bg-danger bg-opacity-25 text-danger fw-bold px-1 rounded">$1' + link.url + '$2</span>'
                                            )
                                            .replace(/(&lt;[\/]?[a-zA-Z0-9-]+)(\s|&gt;)/g, '<span class="text-primary">$1</span>$2')
                                            .replace(/(\s+)([a-zA-Z0-9-]+)(=)/g, '$1<span class="text-info">$2</span>$3')
                                            .replace(/(&quot;)(.*?)(&quot;)/g, '<span class="text-warning">$1$2$3</span>')
                                        }} />
                                      </pre>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 bg-white dark:bg-dark border border-dashed rounded-3 mt-2">
                  <Info size={32} className="text-muted opacity-25 mb-2" />
                  <p className="text-muted small mb-0 fw-semibold">No parent references found (Primary Entry Node)</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render a list of links with collapsible items
  const renderLinksList = (links: SerializedScanResult[]) => {
    if (links.length === 0) {
      return (
        <div className="text-center py-5 bg-light rounded-4 border border-dashed my-4">
          <div className="mb-3 opacity-25">
            <Search size={48} className="text-muted" />
          </div>
          <h5 className="text-muted fw-bold">Zero records found</h5>
          <p className="text-muted small">No links match the selected filter category.</p>
        </div>
      );
    }

    // Group links by URL to avoid duplicates
    const uniqueLinks = getGroupedLinks(links);
    const paginatedItems = uniqueLinks.slice(startIndex, endIndex);

    return (
      <div className="w-100">
        {renderPagination()}
        <div className="bg-white dark:bg-dark border rounded-4 overflow-hidden mt-3 shadow-sm">
          {paginatedItems.map((link, index) => renderLinkItem(link, index, paginatedItems.length))}
        </div>
        {renderPagination()}
      </div>
    );
  };

  const handleCheckLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Update this function to compare domains properly, considering subdomains
  const isDifferentDomain = (url: string, baseUrl: string): boolean => {
    try {
      const urlDomain = new URL(url).hostname;
      const baseUrlDomain = new URL(baseUrl).hostname;

      // Extract root domains to handle subdomains
      const getBaseDomain = (domain: string) => {
        // Extract the base domain (e.g., example.com from sub.example.com)
        const parts = domain.split('.');
        // If we have enough parts for a subdomain
        if (parts.length > 2) {
          // Get the last two parts (e.g., example.com)
          return parts.slice(-2).join('.');
        }
        return domain;
      };

      const urlBaseDomain = getBaseDomain(urlDomain);
      const baseUrlBaseDomain = getBaseDomain(baseUrlDomain);

      return urlBaseDomain !== baseUrlBaseDomain;
    } catch {
      return false;
    }
  };

  return (
    <div className="w-100">
      <div className="row g-3 mb-5">
        {[
          { id: 'problematic', label: 'Broken & Errored', count: uniqueProblematicCount, icon: <XCircle size={20} />, color: 'danger' },
          { id: 'ok', label: 'Successful Links', count: uniqueOkCount, icon: <CheckCircle2 size={20} />, color: 'success' },
          { id: 'external', label: 'External Nodes', count: uniqueExternalCount, icon: <ArrowUpRight size={20} />, color: 'primary' },
          { id: 'skipped', label: 'Exclusion Rules', count: uniqueSkippedCount, icon: <Filter size={20} />, color: 'secondary' },
          { id: 'all', label: 'Unfiltered Catalog', count: uniqueAllCount, icon: <Activity size={20} />, color: 'dark' },
        ].map((tab, idx) => (
          <div key={tab.id} className="col-6 col-md-4 col-lg">
            <AnimatedCard
              className={`p-3 h-100 cursor-pointer shadow-sm transition-all hover-translate-y-2 border-2 ${activeTab === tab.id
                ? `border-${tab.color} bg-${tab.color} bg-opacity-10`
                : `bg-white dark:bg-dark border-transparent hover:border-${tab.color} hover:bg-light dark:hover:bg-opacity-10`
                }`}
              onClick={() => handleTabChange(tab.id)}
            >
              <div className="d-flex flex-column h-100">
                <div className={`mb-2 text-${tab.color} d-flex align-items-center justify-content-between`}>
                  {tab.icon}
                  {activeTab === tab.id && <div className={`p-1 bg-${tab.color} rounded-circle`}></div>}
                </div>
                <div className="text-muted x-small fw-bold text-uppercase tracking-wider mb-1">{tab.label}</div>
                <div className="h4 fw-black mb-0 text-dark dark:text-light">{tab.count}</div>
              </div>
            </AnimatedCard>
          </div>
        ))}
      </div>

      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h3 className="h4 fw-black text-dark dark:text-light mb-1">
            {activeTab === 'problematic' && 'Critical Breakdown'}
            {activeTab === 'ok' && 'Operational Integrity'}
            {activeTab === 'external' && 'Cross-Domain References'}
            {activeTab === 'skipped' && 'Rulebase Exclusions'}
            {activeTab === 'all' && 'Comprehensive Dataset'}
          </h3>
          <p className="text-muted small mb-0">Review the status and source locations for each identified node.</p>
        </div>
        <ExportScanButton scanId={scanId} scanUrl={_scanUrl} results={results} />
      </div>

      <div className="fade-in-up">
        {activeTab === 'problematic' && renderLinksList(problematicLinks)}
        {activeTab === 'ok' && renderLinksList(okLinks)}
        {activeTab === 'external' && renderLinksList(externalLinks)}
        {activeTab === 'skipped' && renderLinksList(skippedLinks)}
        {activeTab === 'all' && renderLinksList(results)}
      </div>
    </div>
  );
}