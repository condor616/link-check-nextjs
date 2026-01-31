'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Download, Maximize2, Minimize2, Pause, Play, Filter, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export interface LogEntry {
    id: string;
    timestamp: string;
    level: 'INFO' | 'WARN' | 'ERROR';
    message: string;
    data?: any;
}

interface TerminalLogViewProps {
    scanId: string;
    refreshInterval?: number; // ms
    initialLogs?: LogEntry[];
    isScanning?: boolean;
}

export default function TerminalLogView({
    scanId,
    refreshInterval = 2000,
    initialLogs = [],
    isScanning = false
}: TerminalLogViewProps) {
    const [logs, setLogs] = useState<LogEntry[]>(initialLogs);
    const [autoScroll, setAutoScroll] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [filter, setFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Fetch logs
    useEffect(() => {
        if (!scanId) return;

        let isMounted = true;
        const fetchLogs = async () => {
            try {
                const response = await fetch(`/api/logs/${scanId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (isMounted) {
                        setLogs(data.logs);
                    }
                }
            } catch (error) {
                console.error('Error fetching logs:', error);
            }
        };

        // Initial fetch
        fetchLogs();

        // Poll for updates if scanning
        let intervalId: NodeJS.Timeout;
        if (isScanning && !isPaused) {
            intervalId = setInterval(fetchLogs, refreshInterval);
        }

        return () => {
            isMounted = false;
            if (intervalId) clearInterval(intervalId);
        };
    }, [scanId, isScanning, isPaused, refreshInterval]);

    // Auto-scroll to bottom
    useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [logs, autoScroll]);

    // Handle scroll events to toggle auto-scroll
    const handleScroll = () => {
        if (!scrollRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const filteredLogs = logs.filter(log => filter === 'ALL' || log.level === filter);

    const downloadLogs = () => {
        const content = logs.map(log => `[${new Date(log.timestamp).toISOString()}] [${log.level}] ${log.message} ${log.data ? JSON.stringify(log.data) : ''}`).join('\n');
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan-logs-${scanId}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'ERROR': return <AlertCircle size={14} className="text-danger" />;
            case 'WARN': return <AlertTriangle size={14} className="text-warning" />;
            default: return <Info size={14} className="text-info" />;
        }
    };

    return (
        <div className={`terminal-view border rounded-3 overflow-hidden d-flex flex-column shadow-sm ${isExpanded ? 'position-fixed top-0 start-0 w-100 h-100 z-50' : ''}`}
            style={{ maxHeight: isExpanded ? '100vh' : '500px', backgroundColor: '#1e1e1e', transition: 'all 0.3s ease', minHeight: isExpanded ? '100vh' : '400px' }}>

            {/* Header */}
            <div className="d-flex align-items-center justify-content-between px-3 py-2 bg-dark border-bottom border-secondary">
                <div className="d-flex align-items-center gap-2">
                    <Terminal size={16} className="text-success" />
                    <span className="text-light fw-mono small">Debug Console {isScanning && <span className="badge bg-success ms-2 animate-pulse" style={{ fontSize: '0.6rem' }}>LIVE</span>}</span>
                </div>

                <div className="d-flex align-items-center gap-2">
                    <div className="d-flex align-items-center me-2">
                        <Filter size={14} className="text-secondary me-1" />
                        <select
                            className="form-select form-select-sm bg-dark text-light border-secondary py-0 px-2 shadow-none"
                            style={{ fontSize: '0.75rem', height: '24px', width: 'auto' }}
                            value={filter}
                            onChange={(e) => setFilter(e.target.value as any)}
                        >
                            <option value="ALL">All Levels</option>
                            <option value="INFO">Info</option>
                            <option value="WARN">Warnings</option>
                            <option value="ERROR">Errors</option>
                        </select>
                    </div>

                    <div className="vr bg-secondary mx-1 opacity-50"></div>

                    <button className="btn btn-sm btn-link text-secondary p-1 mx-1 hover-light" onClick={() => setIsPaused(!isPaused)} title={isPaused ? "Resume Auto-refresh" : "Pause Auto-refresh"}>
                        {isPaused ? <Play size={16} className="text-warning" /> : <Pause size={16} />}
                    </button>

                    <button className="btn btn-sm btn-link text-secondary p-1 mx-1 hover-light" onClick={downloadLogs} title="Download Logs">
                        <Download size={16} />
                    </button>

                    <button className="btn btn-sm btn-link text-secondary p-1 mx-1 hover-light" onClick={() => setIsExpanded(!isExpanded)} title={isExpanded ? "Collapse" : "Expand"}>
                        {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                </div>
            </div>

            {/* Log Content */}
            <div
                ref={scrollRef}
                className="flex-grow-1 overflow-auto p-3 font-monospace custom-scrollbar"
                style={{ fontSize: '0.8rem', backgroundColor: '#0d1117', color: '#c9d1d9' }}
                onScroll={handleScroll}
            >
                {filteredLogs.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center h-100 text-secondary py-5">
                        <Terminal size={32} className="mb-2 opacity-25" />
                        <div className="mb-2 opacity-50">Waiting for logs...</div>
                        {isScanning && !isPaused && <div className="spinner-border spinner-border-sm text-secondary opacity-50" role="status"></div>}
                    </div>
                ) : (
                    <div className="d-flex flex-column gap-1">
                        {filteredLogs.map((log, index) => (
                            <div key={log.id || index} className="d-flex gap-2 align-items-start log-entry p-1 rounded hover-bg-dark-light transition-colors">
                                <span className="text-secondary opacity-50 flex-shrink-0 font-monospace-numbers" style={{ minWidth: '85px', fontSize: '0.75rem' }}>
                                    {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })}
                                </span>
                                <span className={`fw-bold flex-shrink-0 text-center d-flex align-items-center justify-content-center ${log.level === 'ERROR' ? 'text-danger' :
                                        log.level === 'WARN' ? 'text-warning' : 'text-info'
                                    }`} style={{ minWidth: '24px' }} title={log.level}>
                                    {getLevelIcon(log.level)}
                                </span>
                                <div className="flex-grow-1 text-break" style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>
                                    <span className={log.level === 'ERROR' ? 'text-danger-emphasis' : log.level === 'WARN' ? 'text-warning-emphasis' : ''}>{log.message}</span>
                                    {log.data && (
                                        <details className="mt-1">
                                            <summary className="text-secondary cursor-pointer small opacity-75 hover-opacity-100 select-none">Show Data</summary>
                                            <div className="mt-1 p-2 rounded bg-black bg-opacity-50 text-light overflow-auto border border-secondary border-opacity-25" style={{ maxHeight: '200px' }}>
                                                <pre className="m-0 small text-light" style={{ fontSize: '0.7rem' }}>{typeof log.data === 'string' ? log.data : JSON.stringify(log.data, null, 2)}</pre>
                                            </div>
                                        </details>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Status */}
            <div className="px-3 py-1 bg-dark border-top border-secondary text-secondary d-flex justify-content-between align-items-center" style={{ fontSize: '0.7rem' }}>
                <div>{logs.length} events logged</div>
                <div className="d-flex align-items-center gap-2">
                    {!autoScroll && <span className="text-warning animate-pulse">Scroll paused</span>}
                    <div className={`rounded-circle ${isScanning ? 'bg-success' : 'bg-secondary'}`} style={{ width: '8px', height: '8px' }}></div>
                    {isScanning ? 'Scanning...' : 'Idle'}
                </div>
            </div>

            <style jsx global>{`
        .hover-bg-dark-light:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }
        .hover-light:hover {
            color: #f8f9fa !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
            background: #0d1117;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #30363d;
            border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #484f58;
        }
      `}</style>
        </div>
    );
}
