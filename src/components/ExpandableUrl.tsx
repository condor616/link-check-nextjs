'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

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
    showIcon = true,
    externalExpanded
}: ExpandableUrlProps & { externalExpanded?: boolean }) {
    if (!url) return <span className="text-muted-foreground italic">Waiting...</span>;

    const isExpanded = externalExpanded ?? false;
    const needsTruncation = url.length > truncateLength;
    const displayUrl = needsTruncation && !isExpanded
        ? `${url.substring(0, truncateLength)}...`
        : url;

    return (
        <div className={cn("flex flex-col w-full min-w-0", className)}>
            <div className="flex items-start gap-1 group w-full">
                <div
                    className={cn(
                        "flex-1 min-w-0 transition-all duration-200",
                        !isExpanded ? "truncate" : "break-all"
                    )}
                    title={!isExpanded ? url : undefined}
                >
                    {displayUrl}
                </div>

                <div className="flex items-center shrink-0">
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
