'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ExpandableUrlProps {
    url?: string;
    className?: string;
    truncateLength?: number;
    showIcon?: boolean;
}

export function ExpandableUrl({
    url,
    className,
    truncateLength = 60,
    showIcon = true
}: ExpandableUrlProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    if (!url) return <span className="text-muted-foreground italic">Waiting...</span>;

    const needsTruncation = url.length > truncateLength;
    const displayUrl = needsTruncation && !isExpanded
        ? `${url.substring(0, truncateLength)}...`
        : url;

    return (
        <div className={cn("inline-flex flex-col max-w-full min-w-0", className)}>
            <div className="flex items-start gap-1 group">
                <div
                    className={cn(
                        "min-w-0 transition-all duration-200",
                        !isExpanded ? "truncate" : "break-all"
                    )}
                    title={!isExpanded ? url : undefined}
                >
                    {displayUrl}
                </div>

                <div className="flex items-center shrink-0">
                    {needsTruncation && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 p-0 hover:bg-muted/50"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                            )}
                        </Button>
                    )}

                    {showIcon && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-muted-foreground hover:text-accent-primary transition-colors"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
