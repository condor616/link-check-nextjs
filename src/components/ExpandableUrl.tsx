'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';

interface ExpandableUrlProps {
    url?: string;
    className?: string;
    truncateLength?: number;
    showIcon?: boolean;
    externalExpanded?: boolean;
}

export function ExpandableUrl({
    url,
    className = '',
    truncateLength = 60,
    showIcon = true,
    externalExpanded = false
}: ExpandableUrlProps) {
    if (!url) return <span className="text-muted small italic">Waiting...</span>;

    const isExpanded = externalExpanded;
    const needsTruncation = url.length > truncateLength;
    const displayUrl = needsTruncation && !isExpanded
        ? `${url.substring(0, truncateLength)}...`
        : url;

    return (
        <div className={`d-flex flex-column w-100 min-w-0 ${className}`}>
            <div className="d-flex align-items-start gap-1 w-100">
                <div
                    className={`flex-grow-1 min-w-0 transition-all ${!isExpanded ? 'text-truncate' : 'text-break'}`}
                    title={!isExpanded ? url : undefined}
                >
                    {displayUrl}
                </div>

                <div className="d-flex align-items-center flex-shrink-0">
                    {showIcon && (
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-muted hover-text-primary transition-all"
                        >
                            <ExternalLink size={14} />
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
