'use client';

import React, { useState, useEffect } from 'react';
import { ScanResult } from '@/lib/scanner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from 'lucide-react';
import * as cheerio from 'cheerio';
import { PopoverAnchor } from '@radix-ui/react-popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import ExportScanButton from './ExportScanButton';
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

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
}

export default function ScanResults({ results, scanUrl: _scanUrl, itemsPerPage = 10, scanId, scanConfig }: ScanResultsProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [currentItemsPerPage, setCurrentItemsPerPage] = useState<number>(itemsPerPage);
  const [recheckingUrls, setRecheckingUrls] = useState<Set<string>>(new Set());
  const [recheckErrors, setRecheckErrors] = useState<Map<string, string>>(new Map());
  const [recheckSuccess, setRecheckSuccess] = useState<Map<string, string>>(new Map());
  const [localResults, setLocalResults] = useState<SerializedScanResult[]>(results);
  
  // Update local results when props change
  useEffect(() => {
    setLocalResults(results);
  }, [results]);

  // Filter results by status
  const brokenLinks = localResults.filter(r => r.status === 'broken' || (r.statusCode !== undefined && r.statusCode >= 400));
  const errorLinks = localResults.filter(r => r.status === 'error');
  const skippedLinks = localResults.filter(r => r.status === 'skipped');
  const externalLinks = localResults.filter(r => r.status === 'external');
  const okLinks = localResults.filter(r => {
    // Only include links that are:
    // 1. Marked as "ok" status
    // 2. Have no status code, or a status code < 400
    // 3. Not already included in brokenLinks (double check)
    return r.status === 'ok' && 
           (r.statusCode === undefined || r.statusCode < 400) &&
           !brokenLinks.some(link => link.url === r.url);
  });
  
  // Combined problematic links (broken + error)
  const problematicLinks = [...brokenLinks, ...errorLinks.filter(link => 
    // Avoid duplicates from links that may be in both arrays
    !brokenLinks.some(broken => broken.url === link.url)
  )];

  // Group links by URL for pagination calculation
  const getGroupedLinks = (links: SerializedScanResult[]) => {
    const groupedLinks = new Map<string, SerializedScanResult>();
    links.forEach(link => {
      if (!groupedLinks.has(link.url)) {
        groupedLinks.set(link.url, {...link});
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
  const uniqueAllCount = getUniqueCount(results);

  // Pagination state and handlers
  const [activeTab, setActiveTab] = useState<string>("problematic");
  
  // Get current list based on active tab
  const getCurrentList = () => {
    switch (activeTab) {
      case "problematic": return problematicLinks;
      case "ok": return okLinks;
      case "external": return externalLinks;
      case "skipped": return skippedLinks;
      case "all": return results;
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
    
    foundOn.forEach(page => {
      const count = pageMap.get(page) || 0;
      pageMap.set(page, count + 1);
    });
    
    return pageMap;
  };
  
  // Helper to extract and clean the relevant HTML context around the link
  const cleanHtmlContext = (html: string, url: string) => {
    try {
      // Load the HTML into cheerio
      const $ = cheerio.load(html);
      
      // Remove all style tags, script tags, and other unnecessary elements
      $('style, script, link, meta').remove();
      
      // Find the anchor tag with the broken link
      const anchorElement = $(`a[href="${url}"]`);
      
      if (anchorElement.length) {
        // First, try to get just the anchor element
        const anchorHtml = $.html(anchorElement);
        
        // Get up to 1 parent element for minimal context
        let parentElement = anchorElement.parent();
        if (parentElement.length) {
          // Check if parent provides useful context
          const parentTag = parentElement.prop('tagName')?.toLowerCase();
          
          // Only use parent if it's a meaningful HTML element (not body, div, etc.)
          const usefulParents = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'figcaption', 'button', 'label'];
          if (parentTag && usefulParents.includes(parentTag)) {
            return `<!-- Link with immediate parent -->\n${$.html(parentElement)}`;
          }
        }
        
        // Default to just showing the anchor element
        return `<!-- Just the link element -->\n${anchorHtml}`;
      }
      
      // If we couldn't find the exact link, show a minimal version
      // Look for any a tag that might contain the URL
      const possibleAnchors = $('a').filter((_, el) => {
        const href = $(el).attr('href') || '';
        return href.includes(url) || url.includes(href);
      });
      
      if (possibleAnchors.length) {
        return `<!-- Best matching link -->\n${$.html(possibleAnchors.first())}`;
      }
      
      // Last resort: return a small, cleaned snippet of the HTML
      const bodyContent = $('body').html() || html;
      const cleanedHtml = bodyContent
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
        .replace(/<link\b[^>]*>/gi, '') // Remove link tags
        .replace(/<meta\b[^>]*>/gi, '') // Remove meta tags
        .substring(0, 300); // Limit to 300 chars
      
      return `<!-- Cleaned HTML snippet -->\n${cleanedHtml}${cleanedHtml.length > 300 ? '...' : ''}`;
    } catch (e) {
      // If parsing fails, return a minimal version of the original HTML
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
    let variant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default';
    let icon = null;
    let className = "flex items-center";
    
    // Always consider any status code >= 400 as "broken" regardless of status value
    const isBroken = code !== undefined && code >= 400;
    const displayStatus = isBroken ? 'broken' : status;
    
    switch (displayStatus) {
      case 'broken':
        variant = 'destructive';
        icon = <XCircle className="h-3 w-3 mr-1" />;
        className += " bg-destructive/90 text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground";
        break;
      case 'error':
        variant = 'destructive';
        icon = <AlertTriangle className="h-3 w-3 mr-1" />;
        className += " bg-destructive/90 text-destructive-foreground hover:bg-destructive/90 hover:text-destructive-foreground";
        break;
      case 'ok':
        variant = 'secondary';
        icon = <CheckCircle2 className="h-3 w-3 mr-1" />;
        className += " bg-green-500/90 text-white hover:bg-green-500/90 hover:text-white";
        break;
      case 'external':
        variant = 'secondary';
        icon = <ArrowUpRight className="h-3 w-3 mr-1" />;
        break;
      case 'skipped':
        variant = 'outline';
        break;
    }
    
    return (
      <div className="flex items-center gap-1">
        <Badge variant={variant} className={className}>
          {icon}
          {displayStatus}{code ? ` (${code})` : ''}
        </Badge>
        {usedAuth && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs px-1">
                  <LockIcon className="h-2.5 w-2.5 mr-0.5" />
                  Auth
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">HTTP Basic Auth was used</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  };
  
  // Render pagination controls
  const renderPagination = () => {
    return (
      <div className="flex items-center justify-between py-4">
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground">
            {uniqueCurrentList.length > 0 ? 
              `Showing ${startIndex + 1}-${endIndex} of ${uniqueCurrentList.length} items` : 
              "No items to display"}
          </div>
          <div className="flex items-center ml-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 px-2 flex items-center gap-1 text-xs">
                  <ListFilter className="h-3.5 w-3.5" />
                  {currentItemsPerPage} per page
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48" align="start">
                <div className="space-y-2">
                  <p className="text-xs font-medium">Items per page</p>
                  <Select 
                    value={currentItemsPerPage.toString()} 
                    onValueChange={handleItemsPerPageChange}
                  >
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select number" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 items</SelectItem>
                      <SelectItem value="10">10 items</SelectItem>
                      <SelectItem value="20">20 items</SelectItem>
                      <SelectItem value="50">50 items</SelectItem>
                      <SelectItem value="100">100 items</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-xs px-2">
            Page {currentPage} of {Math.max(1, totalPages)}
          </span>
          
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-7 w-7"
            onClick={() => goToPage(totalPages)}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
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
          ? `Link is broken (Status code: ${data.result.statusCode || 'unknown'})${
              data.authMessage ? ` - ${data.authMessage}` : ''
            }` 
          : `Link check result: ${data.result.status}${
              data.authMessage ? ` - ${data.authMessage}` : ''
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
  
  // Render a list of links with collapsible items
  const renderLinksList = (links: SerializedScanResult[], isProblematic = false) => {
    if (links.length === 0) {
      return <p className="text-muted-foreground text-center py-8">No links in this category.</p>;
    }
    
    // For problematic links, use the enhanced card-style display
    if (isProblematic) {
      return renderProblematicLinksList(links);
    }
    
    // Group links by URL to avoid duplicates
    const uniqueLinks = getGroupedLinks(links);
    const paginatedItems = uniqueLinks.slice(startIndex, endIndex);
    
    // Make sure to check each item's status code when filtering
    const problematicItems = paginatedItems.filter(link => 
      link.status === 'broken' || 
      link.status === 'error' || 
      (link.statusCode !== undefined && link.statusCode >= 400)
    );
    
    const nonProblematicItems = paginatedItems.filter(link => 
      (link.status !== 'broken' && link.status !== 'error') && 
      (link.statusCode === undefined || link.statusCode < 400)
    );
    
    // If we're in the "All" tab, we need to handle both types
    const isAllTab = activeTab === 'all';
    
    return (
      <div className="w-full">
        {renderPagination()}
        <div className="border rounded-md">
          {/* Non-problematic links (always non-expandable) */}
          {nonProblematicItems.map((link, index) => (
            <div
              key={link.url}
              className={`p-3 text-sm ${(index !== paginatedItems.length - 1 && (!isAllTab || index !== nonProblematicItems.length - 1)) ? 'border-b' : ''}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 truncate max-w-[80%]">
                  <StatusBadge status={link.status} code={link.statusCode} usedAuth={link.usedAuth} />
                  <span className="truncate font-medium">{link.url.replace(/^https?:\/\//, '')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {link.status === 'ok' && 'Working link'}
                    {link.status === 'external' && 'External link'}
                    {link.status === 'skipped' && 'Skipped link'}
                  </span>
                  <div className="flex">
                    {scanId && (
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-8 px-3 shrink-0 ${
                          recheckingUrls.has(link.url) 
                            ? 'bg-purple-100 text-purple-700' 
                            : ''
                        }`}
                        onClick={() => handleRecheck(link.url)}
                        disabled={recheckingUrls.has(link.url)}
                      >
                        {recheckingUrls.has(link.url) ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Checking...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Re-check
                          </>
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      onClick={() => handleCopyUrl(link.url)}
                      title="Copy URL"
                    >
                      {copiedUrl === link.url ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <ClipboardCopy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 shrink-0"
                      asChild
                    >
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open URL"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
              {recheckErrors.has(link.url) && (
                <div className="mt-2">
                  <Alert variant="destructive" className="py-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Re-check failed</AlertTitle>
                    <AlertDescription>{recheckErrors.get(link.url)}</AlertDescription>
                  </Alert>
                </div>
              )}
              {recheckSuccess.has(link.url) && (
                <div className="mt-2">
                  <Alert variant="default" className="py-2 bg-green-50 text-green-800 border-green-200">
                    <CheckCircle className="h-4 w-4" />
                    <AlertTitle>Re-check completed</AlertTitle>
                    <AlertDescription>
                      {/* Split the message into main message and auth info */}
                      {(() => {
                        const message = recheckSuccess.get(link.url) || '';
                        // Check if there's an auth message in parentheses or after a dash
                        const authStart = message.indexOf(' (HTTP Basic Auth') !== -1 
                          ? message.indexOf(' (HTTP Basic Auth') 
                          : message.indexOf(' - HTTP Basic Auth');
                        
                        if (authStart !== -1) {
                          const mainMessage = message.substring(0, authStart);
                          const authMessage = message.substring(authStart);
                          
                          return (
                            <>
                              {mainMessage}
                              <span className="block mt-1 text-blue-700 text-xs">
                                <LockIcon className="h-3.5 w-3.5 inline-block mr-1" />
                                {authMessage.startsWith(' - ') ? authMessage.substring(3) : 
                                 authMessage.startsWith(' (') ? authMessage.substring(2, authMessage.length - 1) : 
                                 authMessage}
                              </span>
                            </>
                          );
                        }
                        
                        return message;
                      })()}
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          ))}
          
          {/* Problematic links in the All tab (expandable) */}
          {isAllTab && problematicItems.length > 0 && (
            problematicItems.map((link, index) => {
              // Get unique pages with counts
              const pagesWithCounts = countUniquePages(link.foundOn);
              const uniquePages = Array.from(pagesWithCounts.keys());
              
              // Extract domain for display
              const urlDomain = (() => {
                try {
                  return new URL(link.url).hostname;
                } catch {
                  return link.url;
                }
              })();
              
              const isExpanded = expandedItems.has(link.url);
              
              return (
                <div 
                  key={link.url} 
                  className={`text-sm ${index !== problematicItems.length - 1 ? 'border-b' : ''}`}
                >
                  <div className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => toggleItemExpansion(link.url)}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-start gap-1.5">
                        {link.statusCode ? (
                          <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5">
                            {link.statusCode}
                          </span>
                        ) : (
                          <span className={`text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5 ${
                            link.errorMessage?.toLowerCase().includes('timeout') ? 
                            'bg-amber-500' : 
                            'bg-destructive'
                          }`}>
                            {link.errorMessage?.toLowerCase().includes('timeout') ? 'TIMEOUT' : 'ERR'}
                          </span>
                        )}
                        <div className="flex flex-col">
                          <code className="text-destructive font-medium break-all">
                            {urlDomain}{link.url.replace(/^https?:\/\/[^\/]+/, '')}
                          </code>
                          {link.usedAuth && (
                            <span className="flex items-center gap-0.5 text-xs text-blue-600 mt-0.5">
                              <LockIcon className="h-3 w-3" />
                              HTTP Basic Auth
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-muted-foreground mr-2">
                          {uniquePages.length} page{uniquePages.length !== 1 ? 's' : ''}
                        </span>
                        {scanId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 px-3 shrink-0 ${
                              recheckingUrls.has(link.url) 
                                ? 'bg-purple-100 text-purple-700' 
                                : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRecheck(link.url);
                            }}
                            disabled={recheckingUrls.has(link.url)}
                          >
                            {recheckingUrls.has(link.url) ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Checking...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Re-check
                              </>
                            )}
                          </Button>
                        )}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyUrl(link.url);
                          }}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Copy URL"
                        >
                          {copiedUrl === link.url ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <ClipboardCopy className="h-4 w-4" />
                          )}
                        </button>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground shrink-0"
                          title="Open URL"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <ChevronDown 
                          className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                        />
                      </div>
                    </div>
                    
                    {link.errorMessage && (
                      <div className="text-muted-foreground mt-1.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                          link.errorMessage.toLowerCase().includes('timeout') ?
                          'bg-amber-500/10 text-amber-700' :
                          'bg-destructive/10 text-destructive'
                        }`}>
                          {link.errorMessage.toLowerCase().includes('timeout') ? (
                            <>
                              <Clock className="h-3 w-3 mr-1" />
                              {link.errorMessage}
                              <span className="ml-1 text-xs opacity-75">(Try increasing timeout in advanced settings)</span>
                            </>
                          ) : (
                            link.errorMessage
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {isExpanded && uniquePages.length > 0 && (
                    <div className="px-3 pb-3 pt-0 bg-muted/30">
                      <div className="bg-muted/40 p-2 rounded-sm">
                        <p className="text-xs text-muted-foreground mb-1.5 flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                          Found on: {uniquePages.length} page(s)
                        </p>
                        <ul className="space-y-1.5 pl-4 text-xs">
                          {uniquePages.map((page, i) => {
                            // Format found-on page display
                            let displayText = page;
                            const occurrences = pagesWithCounts.get(page) || 0;
                            let isSelfReference = false;
                            
                            try {
                              if (page !== 'initial') {
                                const url = new URL(page);
                                displayText = url.pathname || url.hostname;
                                
                                // Check if the page contains a broken link to itself
                                if (page === link.url) {
                                  isSelfReference = true;
                                  displayText = 'Self reference: ' + displayText;
                                }
                              } else {
                                displayText = 'Initial scan page';
                              }
                            } catch {
                              // Keep original if parsing fails
                            }
                            
                            return (
                              <li key={i} className="list-disc flex items-center gap-1">
                                {page === 'initial' || isSelfReference ? (
                                  <span className={`${isSelfReference ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                    {displayText} {occurrences > 1 && `(${occurrences} occurrences)`}
                                  </span>
                                ) : (
                                  <>
                                    <a
                                      href={page}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline inline-flex items-center"
                                      title={page}
                                    >
                                      {displayText} {occurrences > 1 && `(${occurrences} occurrences)`}
                                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                                    </a>
                                    
                                    <TooltipProvider>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                                            <Info className="h-3.5 w-3.5" />
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[500px] p-3" align="start" side="left">
                                          <div className="space-y-2">
                                            <h4 className="text-sm font-medium">Link HTML Context:</h4>
                                            <div className="max-h-[300px] overflow-y-auto space-y-3">
                                              {Array.from({length: Math.min(3, occurrences)}, (_, idx) => {
                                                const html = generateHtmlContext(link.url, page, idx + 1);
                                                return (
                                                  <div key={idx} className="relative">
                                                    <div className="absolute top-1 right-1 flex space-x-1">
                                                      <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-6 w-6 p-0 text-muted-foreground"
                                                        onClick={() => handleCopyUrl(html)}
                                                        title="Copy HTML"
                                                      >
                                                        <ClipboardCopy className="h-3.5 w-3.5" />
                                                      </Button>
                                                    </div>
                                                    <pre className="text-xs p-3 bg-muted rounded-md whitespace-pre-wrap overflow-x-auto border border-muted-foreground/20" 
                                                      style={{maxHeight: "250px", fontSize: "12px"}}>
                                                      <code dangerouslySetInnerHTML={{
                                                        __html: html
                                                          // Use syntax highlighting for HTML
                                                          .replace(/&/g, '&amp;')
                                                          .replace(/</g, '&lt;')
                                                          .replace(/>/g, '&gt;')
                                                          .replace(/"/g, '&quot;')
                                                          // Highlight comments
                                                          .replace(/(&lt;!--.*?--&gt;)/g, '<span style="color: #6A9955;">$1</span>')
                                                          // Highlight the attribute containing the broken link
                                                          .replace(
                                                            new RegExp(`(href=["'])${link.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'g'),
                                                            '<span style="background-color: rgba(255,0,0,0.2); color: #d20000; font-weight: bold; padding: 0 3px; border-radius: 2px;">$1' + link.url + '$2</span>'
                                                          )
                                                          // Highlight tags
                                                          .replace(/(&lt;[\/]?[a-zA-Z0-9-]+)(\s|&gt;)/g, '<span style="color: #569cd6;">$1</span>$2')
                                                          // Highlight attributes
                                                          .replace(/(\s+)([a-zA-Z0-9-]+)(=)/g, '$1<span style="color: #9cdcfe;">$2</span>$3')
                                                          // Highlight quotes and their content
                                                          .replace(/(&quot;)(.*?)(&quot;)/g, '<span style="color: #ce9178;">$1$2$3</span>')
                                                      }} />
                                                    </pre>
                                                  </div>
                                                );
                                              })}
                                              {occurrences > 3 && (
                                                <p className="text-xs text-muted-foreground">
                                                  {occurrences - 3} more occurrence(s) on this page...
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    </TooltipProvider>
                                  </>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
        {renderPagination()}
      </div>
    );
  };
  
  // Enhanced display for problematic links (broken and errors)
  const renderProblematicLinksList = (links: SerializedScanResult[]) => {
    // Group links by URL to avoid duplicates
    const uniqueLinks = getGroupedLinks(links);
    const paginatedItems = uniqueLinks.slice(startIndex, endIndex);
    
    return (
      <div className="w-full">
        {renderPagination()}
        <div className="border rounded-md">
          {paginatedItems.map((link, index) => {
            // Get unique pages with counts
            const pagesWithCounts = countUniquePages(link.foundOn);
            const uniquePages = Array.from(pagesWithCounts.keys());
            
            // Extract domain for display
            const urlDomain = (() => {
              try {
                return new URL(link.url).hostname;
              } catch {
                return link.url;
              }
            })();
            
            const isExpanded = expandedItems.has(link.url);
            
            return (
              <div 
                key={link.url} 
                className={`text-sm ${index !== paginatedItems.length - 1 ? 'border-b' : ''}`}
              >
                <div className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => toggleItemExpansion(link.url)}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-1.5">
                      {link.statusCode ? (
                        <span className="bg-destructive text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5">
                          {link.statusCode}
                        </span>
                      ) : (
                        <span className={`text-white text-xs px-1.5 py-0.5 rounded font-mono mt-0.5 ${
                          link.errorMessage?.toLowerCase().includes('timeout') ? 
                          'bg-amber-500' : 
                          'bg-destructive'
                        }`}>
                          {link.errorMessage?.toLowerCase().includes('timeout') ? 'TIMEOUT' : 'ERR'}
                        </span>
                      )}
                      <div className="flex flex-col">
                        <code className="text-destructive font-medium break-all">
                          {urlDomain}{link.url.replace(/^https?:\/\/[^\/]+/, '')}
                        </code>
                        {link.usedAuth && (
                          <span className="flex items-center gap-0.5 text-xs text-blue-600 mt-0.5">
                            <LockIcon className="h-3 w-3" />
                            HTTP Basic Auth
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <span className="text-xs text-muted-foreground mr-2">
                        {uniquePages.length} page{uniquePages.length !== 1 ? 's' : ''}
                      </span>
                      {scanId && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-8 px-3 shrink-0 ${
                            recheckingUrls.has(link.url) 
                              ? 'bg-purple-100 text-purple-700' 
                              : ''
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRecheck(link.url);
                          }}
                          disabled={recheckingUrls.has(link.url)}
                        >
                          {recheckingUrls.has(link.url) ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="h-4 w-4 mr-1" />
                              Re-check
                            </>
                          )}
                        </Button>
                      )}
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyUrl(link.url);
                        }}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Copy URL"
                      >
                        {copiedUrl === link.url ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <ClipboardCopy className="h-4 w-4" />
                        )}
                      </button>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        title="Open URL"
                        onClick={e => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      />
                    </div>
                  </div>
                  
                  {link.errorMessage && (
                    <div className="text-muted-foreground mt-1.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                        link.errorMessage.toLowerCase().includes('timeout') ?
                        'bg-amber-500/10 text-amber-700' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {link.errorMessage.toLowerCase().includes('timeout') ? (
                          <>
                            <Clock className="h-3 w-3 mr-1" />
                            {link.errorMessage}
                            <span className="ml-1 text-xs opacity-75">(Try increasing timeout in advanced settings)</span>
                          </>
                        ) : (
                          link.errorMessage
                        )}
                      </span>
                    </div>
                  )}
                  {recheckErrors.has(link.url) && (
                    <div className="mt-2">
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Re-check failed</AlertTitle>
                        <AlertDescription>{recheckErrors.get(link.url)}</AlertDescription>
                      </Alert>
                    </div>
                  )}
                  {recheckSuccess.has(link.url) && (
                    <div className="mt-2">
                      <Alert variant="default" className="py-2 bg-green-50 text-green-800 border-green-200">
                        <CheckCircle className="h-4 w-4" />
                        <AlertTitle>Re-check completed</AlertTitle>
                        <AlertDescription>
                          {/* Split the message into main message and auth info */}
                          {(() => {
                            const message = recheckSuccess.get(link.url) || '';
                            // Check if there's an auth message in parentheses or after a dash
                            const authStart = message.indexOf(' (HTTP Basic Auth') !== -1 
                              ? message.indexOf(' (HTTP Basic Auth') 
                              : message.indexOf(' - HTTP Basic Auth');
                            
                            if (authStart !== -1) {
                              const mainMessage = message.substring(0, authStart);
                              const authMessage = message.substring(authStart);
                              
                              return (
                                <>
                                  {mainMessage}
                                  <span className="block mt-1 text-blue-700 text-xs">
                                    <LockIcon className="h-3.5 w-3.5 inline-block mr-1" />
                                    {authMessage.startsWith(' - ') ? authMessage.substring(3) : 
                                     authMessage.startsWith(' (') ? authMessage.substring(2, authMessage.length - 1) : 
                                     authMessage}
                                  </span>
                                </>
                              );
                            }
                            
                            return message;
                          })()}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
                
                {isExpanded && uniquePages.length > 0 && (
                  <div className="px-3 pb-3 pt-0 bg-muted/30">
                    <div className="bg-muted/40 p-2 rounded-sm">
                      <p className="text-xs text-muted-foreground mb-1.5 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                        Found on: {uniquePages.length} page(s)
                      </p>
                      <ul className="space-y-1.5 pl-4 text-xs">
                        {uniquePages.map((page, i) => {
                          // Format found-on page display
                          let displayText = page;
                          const occurrences = pagesWithCounts.get(page) || 0;
                          let isSelfReference = false;
                          
                          try {
                            if (page !== 'initial') {
                              const url = new URL(page);
                              displayText = url.pathname || url.hostname;
                              
                              // Check if the page contains a broken link to itself
                              if (page === link.url) {
                                isSelfReference = true;
                                displayText = 'Self reference: ' + displayText;
                              }
                            } else {
                              displayText = 'Initial scan page';
                            }
                          } catch {
                            // Keep original if parsing fails
                          }
                          
                          return (
                            <li key={i} className="list-disc flex items-center gap-1">
                              {page === 'initial' || isSelfReference ? (
                                <span className={`${isSelfReference ? 'text-amber-600' : 'text-muted-foreground'}`}>
                                  {displayText} {occurrences > 1 && `(${occurrences} occurrences)`}
                                </span>
                              ) : (
                                <>
                                  <a
                                    href={page}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline inline-flex items-center"
                                    title={page}
                                  >
                                    {displayText} {occurrences > 1 && `(${occurrences} occurrences)`}
                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-1"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                                  </a>
                                  
                                  <TooltipProvider>
                                    <Popover>
                                      <PopoverTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground">
                                          <Info className="h-3.5 w-3.5" />
                                        </Button>
                                      </PopoverTrigger>
                                      <PopoverContent className="w-[500px] p-3" align="start" side="left">
                                        <div className="space-y-2">
                                          <h4 className="text-sm font-medium">Link HTML Context:</h4>
                                          <div className="max-h-[300px] overflow-y-auto space-y-3">
                                            {Array.from({length: Math.min(3, occurrences)}, (_, idx) => {
                                              const html = generateHtmlContext(link.url, page, idx + 1);
                                              return (
                                                <div key={idx} className="relative">
                                                  <div className="absolute top-1 right-1 flex space-x-1">
                                                    <Button 
                                                      variant="outline" 
                                                      size="sm" 
                                                      className="h-6 w-6 p-0 text-muted-foreground"
                                                      onClick={() => handleCopyUrl(html)}
                                                      title="Copy HTML"
                                                    >
                                                      <ClipboardCopy className="h-3.5 w-3.5" />
                                                    </Button>
                                                  </div>
                                                  <pre className="text-xs p-3 bg-muted rounded-md whitespace-pre-wrap overflow-x-auto border border-muted-foreground/20" 
                                                    style={{maxHeight: "250px", fontSize: "12px"}}>
                                                    <code dangerouslySetInnerHTML={{
                                                      __html: html
                                                        // Use syntax highlighting for HTML
                                                        .replace(/&/g, '&amp;')
                                                        .replace(/</g, '&lt;')
                                                        .replace(/>/g, '&gt;')
                                                        .replace(/"/g, '&quot;')
                                                        // Highlight comments
                                                        .replace(/(&lt;!--.*?--&gt;)/g, '<span style="color: #6A9955;">$1</span>')
                                                        // Highlight the attribute containing the broken link
                                                        .replace(
                                                          new RegExp(`(href=["'])${link.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(["'])`, 'g'),
                                                          '<span style="background-color: rgba(255,0,0,0.2); color: #d20000; font-weight: bold; padding: 0 3px; border-radius: 2px;">$1' + link.url + '$2</span>'
                                                        )
                                                        // Highlight tags
                                                        .replace(/(&lt;[\/]?[a-zA-Z0-9-]+)(\s|&gt;)/g, '<span style="color: #569cd6;">$1</span>$2')
                                                        // Highlight attributes
                                                        .replace(/(\s+)([a-zA-Z0-9-]+)(=)/g, '$1<span style="color: #9cdcfe;">$2</span>$3')
                                                        // Highlight quotes and their content
                                                        .replace(/(&quot;)(.*?)(&quot;)/g, '<span style="color: #ce9178;">$1$2$3</span>')
                                                    }} />
                                                  </pre>
                                                </div>
                                              );
                                            })}
                                            {occurrences > 3 && (
                                              <p className="text-xs text-muted-foreground">
                                                {occurrences - 3} more occurrence(s) on this page...
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </PopoverContent>
                                    </Popover>
                                  </TooltipProvider>
                                </>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {renderPagination()}
      </div>
    );
  };
  
  const handleCheckLink = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Add this function to compare domains
  const isDifferentDomain = (url: string, baseUrl: string): boolean => {
    try {
      const urlDomain = new URL(url).hostname;
      const baseUrlDomain = new URL(baseUrl).hostname;
      return urlDomain !== baseUrlDomain;
    } catch {
      return false;
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
            <TabsList>
              <TabsTrigger value="problematic" className="flex items-center gap-1">
                <span>Problematic</span>
                <Badge variant="outline" className="ml-1 py-0">{uniqueProblematicCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="ok" className="flex items-center gap-1">
                <span>OK</span>
                <Badge variant="outline" className="ml-1 py-0">{uniqueOkCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="external" className="flex items-center gap-1">
                <span>External</span>
                <Badge variant="outline" className="ml-1 py-0">{uniqueExternalCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="skipped" className="flex items-center gap-1">
                <span>Skipped</span>
                <Badge variant="outline" className="ml-1 py-0">{uniqueSkippedCount}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-1">
                <span>All</span>
                <Badge variant="outline" className="ml-1 py-0">{uniqueAllCount}</Badge>
              </TabsTrigger>
            </TabsList>
            
            {/* Add Export Button */}
            <ExportScanButton scanId={scanId} scanUrl={_scanUrl} results={results} className="ml-auto" />
          </div>
        </Tabs>
      </div>
      <Tabs value={activeTab} className="w-full" onValueChange={handleTabChange}>
        <TabsContent value="problematic" className="mt-4">
          {renderLinksList(problematicLinks, true)}
        </TabsContent>
        
        <TabsContent value="ok" className="mt-4">
          {renderLinksList(okLinks)}
        </TabsContent>
        
        <TabsContent value="external" className="mt-4">
          {renderLinksList(externalLinks)}
        </TabsContent>
        
        <TabsContent value="skipped" className="mt-4">
          {renderLinksList(skippedLinks)}
        </TabsContent>
        
        <TabsContent value="all" className="mt-4">
          {renderLinksList(results)}
        </TabsContent>
      </Tabs>
    </div>
  );
} 