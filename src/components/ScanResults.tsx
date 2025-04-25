'use client';

import React, { useState } from 'react';
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
import { ExternalLink, ClipboardCopy, CheckCircle2, XCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';

interface ScanResultsProps {
  results: ScanResult[];
  scanUrl: string; // We keep this param as it might be used for future features
}

export default function ScanResults({ results, scanUrl: _scanUrl }: ScanResultsProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  // Filter results by status
  const brokenLinks = results.filter(r => r.status === 'broken');
  const errorLinks = results.filter(r => r.status === 'error');
  const skippedLinks = results.filter(r => r.status === 'skipped');
  const externalLinks = results.filter(r => r.status === 'external');
  const okLinks = results.filter(r => r.status === 'ok');
  
  // Combined problematic links (broken + error)
  const problematicLinks = [...brokenLinks, ...errorLinks];
  
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
  const formatFoundOn = (foundOn: string[] | Set<string>) => {
    const pages = Array.isArray(foundOn) ? foundOn : Array.from(foundOn);
    return pages;
  };
  
  // Status badge component
  const StatusBadge = ({ status, code }: { status: string, code?: number }) => {
    let variant: 'default' | 'destructive' | 'secondary' | 'outline' = 'default';
    let icon = null;
    let className = "flex items-center";
    
    switch (status) {
      case 'broken':
        variant = 'destructive';
        icon = <XCircle className="h-3 w-3 mr-1" />;
        break;
      case 'error':
        variant = 'destructive';
        icon = <AlertTriangle className="h-3 w-3 mr-1" />;
        break;
      case 'ok':
        variant = 'secondary';
        icon = <CheckCircle2 className="h-3 w-3 mr-1" />;
        className += " bg-green-500/20 text-green-700 hover:bg-green-500/20 hover:text-green-700";
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
      <Badge variant={variant} className={className}>
        {icon}
        {status}{code ? ` (${code})` : ''}
      </Badge>
    );
  };
  
  // Render a list of links with accordions
  const renderLinksList = (links: ScanResult[]) => {
    if (links.length === 0) {
      return <p className="text-muted-foreground text-center py-8">No links in this category.</p>;
    }
    
    return (
      <Accordion type="multiple" className="w-full">
        {links.map((link) => (
          <AccordionItem key={link.url} value={link.url}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center justify-between w-full pr-4">
                <div className="flex items-center gap-2 truncate max-w-[80%]">
                  <StatusBadge status={link.status} code={link.statusCode} />
                  <span className="truncate font-medium">{link.url.replace(/^https?:\/\//, '')}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {link.foundOn && formatFoundOn(link.foundOn).length} occurrences
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-2">
                  <code className="text-xs bg-muted p-2 rounded w-full overflow-x-auto flex-1">
                    {link.url}
                  </code>
                  <Button
                    variant="outline"
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
                    variant="outline"
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
                
                {link.errorMessage && (
                  <div className="text-destructive text-sm border border-destructive rounded p-2">
                    Error: {link.errorMessage}
                  </div>
                )}
                
                {link.foundOn && formatFoundOn(link.foundOn).length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Found on:</h4>
                    <ul className="list-disc list-inside text-sm space-y-1 max-h-40 overflow-y-auto">
                      {formatFoundOn(link.foundOn).map((page, i) => (
                        <li key={i} className="truncate">
                          <a
                            href={page}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline inline-flex items-center"
                          >
                            {page === 'initial' ? 'Initial scan page' : getHost(page)}
                            {page !== 'initial' && <ExternalLink className="h-3 w-3 ml-1" />}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    );
  };
  
  return (
    <div className="w-full">
      <Tabs defaultValue="problematic" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="problematic" className="flex items-center gap-1.5">
            <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center">
              {problematicLinks.length}
            </Badge>
            Broken & Errors
          </TabsTrigger>
          <TabsTrigger value="ok" className="flex items-center gap-1.5">
            <Badge variant="secondary" className="h-5 min-w-5 flex items-center justify-center bg-green-500/20 text-green-700">
              {okLinks.length}
            </Badge>
            OK
          </TabsTrigger>
          <TabsTrigger value="external" className="flex items-center gap-1.5">
            <Badge variant="secondary" className="h-5 min-w-5 flex items-center justify-center">
              {externalLinks.length}
            </Badge>
            External
          </TabsTrigger>
          <TabsTrigger value="skipped" className="flex items-center gap-1.5">
            <Badge variant="outline" className="h-5 min-w-5 flex items-center justify-center">
              {skippedLinks.length}
            </Badge>
            Skipped
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-1.5">
            <Badge variant="default" className="h-5 min-w-5 flex items-center justify-center">
              {results.length}
            </Badge>
            All
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="problematic" className="mt-4">
          {renderLinksList(problematicLinks)}
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