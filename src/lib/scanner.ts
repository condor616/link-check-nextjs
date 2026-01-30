import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

// Infer the Limit type from the pLimit function itself
type LimitFunction = ReturnType<typeof pLimit>;

// Define configuration interface (can be expanded)
export interface ScanConfig {
    depth?: number; // 0 or undefined means infinite
    scanSameLinkOnce?: boolean;
    concurrency?: number; // Max concurrent requests
    itemsPerPage?: number; // Items per page for results pagination
    regexExclusions?: string[]; // Array of regex patterns for URLs to exclude
    wildcardExclusions?: string[]; // Array of wildcard patterns for URLs to exclude (e.g., "example.com/about/*", "*/privacy/", "https://*.example.org")
    cssSelectors?: string[]; // Array of CSS selectors - links inside these elements will be excluded
    cssSelectorsForceExclude?: boolean; // Whether links in CSS selectors should be excluded entirely, even if found elsewhere
    requestTimeout?: number; // Timeout in milliseconds for each request (default: 10000)
    auth?: {
        username: string;
        password: string;
    }; // HTTP Basic Authentication credentials
    useAuthForAllDomains?: boolean; // Use auth headers for all domains instead of just the same domain
    processHtml?: boolean; // Whether to process HTML content for links (default: true)
    skipExternalDomains?: boolean; // Whether to skip external domains (default: true for re-scans)
    excludeSubdomains?: boolean; // Whether to exclude subdomains (default: true)
    // TODO: Add User-Agent
}

// Define result structure (will evolve)
export interface ScanResult {
    url: string; // The normalized URL that was checked
    // Status: ok, broken (4xx, 5xx, timeout, network error), skipped (depth, visited, excluded), error (internal scanner issue), external
    status: 'ok' | 'broken' | 'skipped' | 'error' | 'external';
    statusCode?: number;
    contentType?: string;
    foundOn: Set<string>; // Set of page URLs where this link was found
    errorMessage?: string;
    // Flag to indicate if HTTP Basic Auth was used for this URL
    usedAuth?: boolean;
}

/**
 * Interface for callbacks to provide real-time updates about the scanning process
 */
export interface ScanCallbacks {
    onStart?: (estimatedUrls: number) => void;
    onProgress?: (processedCount: number, currentUrl: string, brokenCount: number, totalCount: number) => void;
    onResult?: (result: ScanResult) => void;
    onComplete?: (results: ScanResult[]) => void;
    onError?: (error: Error) => void;
}

// Define the structure for serialized scan state
export interface ScanState {
    visitedLinks: string[];
    results: any[]; // Use any[] to allow for serialized structure
    queue: { url: string; depth: number }[];
    aborted?: { url: string; depth: number }[];
}

// Use classes for better state management during a scan
class Scanner {
    protected readonly startUrl: string;
    protected readonly baseUrl: string;
    // Use Partial for config during construction, then create required version
    protected readonly config: Required<Pick<ScanConfig, 'depth' | 'scanSameLinkOnce' | 'concurrency' | 'itemsPerPage' | 'regexExclusions' | 'wildcardExclusions' | 'cssSelectors' | 'cssSelectorsForceExclude' | 'requestTimeout' | 'useAuthForAllDomains' | 'processHtml' | 'skipExternalDomains' | 'excludeSubdomains'>> & ScanConfig;
    protected readonly visitedLinks: Set<string>; // Tracks links whose content has been fetched/processed
    protected readonly queuedLinks: Set<string>; // Tracks links that have been added to the queue
    protected readonly results: Map<string, ScanResult>; // Stores results for all encountered links
    // Track pending URLs explicitly for state serialization
    protected readonly pendingUrls: Map<string, number> = new Map();
    // Track aborted URLs explicitly to prioritize them on resume
    protected readonly abortedUrls: Map<string, number> = new Map();

    protected isRunning: boolean = false;
    protected isPaused: boolean = false;

    // Optimized counters for progress reporting
    private _brokenLinksCount: number = 0;

    // Use the inferred type for the limiter instance
    protected limit: LimitFunction | null = null;
    // Cache for auth headers to avoid recomputing for each request
    protected authHeadersCache: Record<string, string> | null = null;
    // Domain cache to optimize hostname lookups
    protected domainCache: Map<string, string> = new Map();
    protected abortController: AbortController = new AbortController();

    protected callbacks: ScanCallbacks;

    constructor(startUrl: string, config: ScanConfig = {}, callbacks: ScanCallbacks = {}, initialState?: ScanState) {
        const normalizedStart = this.normalizeUrl(startUrl, startUrl);
        if (!normalizedStart) {
            throw new Error(`Invalid start URL: ${startUrl}`);
        }
        this.startUrl = normalizedStart;
        this.baseUrl = new URL(this.startUrl).origin; // Base for internal link check

        // Set default config values
        this.config = {
            depth: config.depth ?? 0, // Default to infinite
            scanSameLinkOnce: config.scanSameLinkOnce ?? true,
            concurrency: config.concurrency ?? 10, // Default concurrency
            itemsPerPage: config.itemsPerPage ?? 10, // Default to 10 items per page
            regexExclusions: config.regexExclusions ?? [], // Default to empty array
            wildcardExclusions: config.wildcardExclusions ?? [], // Default to empty array
            cssSelectors: config.cssSelectors ?? [], // Default to empty array
            cssSelectorsForceExclude: config.cssSelectorsForceExclude ?? false, // Default to false
            requestTimeout: config.requestTimeout ?? 30000, // Default to 30 seconds
            useAuthForAllDomains: config.useAuthForAllDomains ?? false,
            processHtml: config.processHtml ?? true,
            skipExternalDomains: config.skipExternalDomains ?? true,
            excludeSubdomains: config.excludeSubdomains ?? true,
            ...config, // Include any other passed config options
        };

        if (this.config.concurrency <= 0) {
            throw new Error("Concurrency must be a positive number.");
        }

        if (this.config.requestTimeout <= 0) {
            throw new Error("Request timeout must be a positive number.");
        }

        // Initialize auth headers cache
        if (this.config.auth?.username && this.config.auth?.password) {
            const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
            this.authHeadersCache = {
                'User-Agent': 'LinkCheckerProBot/1.0',
                'Authorization': `Basic ${credentials}`,
                'Connection': 'keep-alive'
            };
        } else {
            this.authHeadersCache = {
                'User-Agent': 'LinkCheckerProBot/1.0',
                'Connection': 'keep-alive'
            };
        }

        this.callbacks = callbacks;

        // Initialize state
        if (initialState) {
            this.visitedLinks = new Set(initialState.visitedLinks);

            // Rehydrate results
            this.results = new Map();
            if (initialState.results) {
                initialState.results.forEach((r: any) => {
                    const foundOn = new Set<string>(Array.isArray(r.foundOn) ? r.foundOn : []);

                    const result: ScanResult = {
                        ...r,
                        foundOn
                    };
                    // Ensure unnecessary fields are removed if they sneak in from older serialized state
                    // @ts-ignore
                    delete result.htmlContexts;

                    this.results.set(result.url, result);
                });
            }

            this.recalculateBrokenLinksCount();
            this.queuedLinks = new Set();

            if (initialState.queue) {
                initialState.queue.forEach(item => {
                    this.pendingUrls.set(item.url, item.depth);
                });
            }

            if (initialState.aborted) {
                initialState.aborted.forEach(item => {
                    this.abortedUrls.set(item.url, item.depth);
                });
            }
        } else {
            this.visitedLinks = new Set<string>();
            this.queuedLinks = new Set<string>();
            this.results = new Map<string, ScanResult>();
            // Initialize results map with start URL
            this.addOrUpdateResultWithContext(this.startUrl, 'initial', '');
        }
    }

    // ... (normalizeUrl, isSameDomain, addOrUpdateResultWithContext methods remain unchanged)

    protected normalizeUrl(url: string, baseUrl: string): string | null {
        // Quick check for common non-HTTP protocols
        if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) {
            return null;
        }

        try {
            // Handle mailto:, tel:, etc. which are valid but not scannable http links
            if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('#')) {
                if (/^[a-zA-Z]+:/.test(url)) { // Check for other protocols like mailto:, tel:
                    return null;
                }
            }

            if (url.startsWith('#')) {
                // For anchors, cache and reuse base URL without fragment
                if (!this.domainCache.has(baseUrl)) {
                    const absoluteUrl = new URL(baseUrl);
                    absoluteUrl.hash = "";
                    this.domainCache.set(baseUrl, absoluteUrl.toString());
                }
                return this.domainCache.get(baseUrl) || baseUrl;
            }

            const absoluteUrl = new URL(url, baseUrl);
            absoluteUrl.hash = ""; // Remove fragment
            return absoluteUrl.toString();
        } catch (error) {
            console.warn(`Invalid URL encountered: ${url} (Base: ${baseUrl})`);
            return null;
        }
    }

    // Helper method to determine if a URL is from the same domain as the base URL
    protected isSameDomain(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const baseObj = new URL(this.baseUrl);

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

            const urlBaseDomain = getBaseDomain(urlObj.hostname);
            const baseUrlBaseDomain = getBaseDomain(baseObj.hostname);

            return urlBaseDomain === baseUrlBaseDomain;
        } catch {
            return false;
        }
    }

    protected isProblematic(status?: string, statusCode?: number): boolean {
        return status === 'broken' || status === 'error' || (statusCode !== undefined && statusCode >= 400);
    }

    private recalculateBrokenLinksCount(): void {
        let count = 0;
        for (const result of this.results.values()) {
            if (this.isProblematic(result.status, result.statusCode)) {
                count++;
            }
        }
        this._brokenLinksCount = count;
    }

    // Helper to add or update link results
    protected addOrUpdateResultWithContext(linkUrl: string, sourceUrl: string, _htmlContext: string, partialResult: Partial<Omit<ScanResult, 'url' | 'foundOn'>> = {}) {
        let entry = this.results.get(linkUrl);

        // Track if status changed from/to problematic
        const wasProblematic = entry ? this.isProblematic(entry.status, entry.statusCode) : false;

        if (entry) {
            if (sourceUrl !== 'initial') {
                entry.foundOn.add(sourceUrl);
            }

            // Logic to prevent overwriting definitive status with less definitive one
            if (!(entry.status && entry.status !== 'external' && (partialResult.status === 'skipped' || partialResult.status === 'external'))) {
                Object.assign(entry, partialResult);
            }

            // Update broken link count if status changed
            const isNowProblematic = this.isProblematic(entry.status, entry.statusCode);
            if (!wasProblematic && isNowProblematic) {
                this._brokenLinksCount++;
            } else if (wasProblematic && !isNowProblematic) {
                this._brokenLinksCount--;
            }

            if (this.callbacks.onResult) {
                this.callbacks.onResult(entry);
            }
        } else {
            entry = {
                url: linkUrl,
                status: partialResult.status ?? 'external',
                statusCode: partialResult.statusCode,
                contentType: partialResult.contentType,
                errorMessage: partialResult.errorMessage,
                foundOn: new Set(sourceUrl === 'initial' ? [] : [sourceUrl])
            };
            this.results.set(linkUrl, entry);

            // Update broken link count
            if (this.isProblematic(entry.status, entry.statusCode)) {
                this._brokenLinksCount++;
            }

            if (this.callbacks.onResult) {
                this.callbacks.onResult(entry);
            }
        }
    }

    protected get brokenLinksCount(): number {
        return this._brokenLinksCount;
    }

    // Function to process a single URL
    protected async processUrl(urlToProcess: string, depth: number): Promise<void> {
        // Remove from pending map as we are starting to process it
        this.pendingUrls.delete(urlToProcess);

        if (!this.limit) throw new Error("Scanner not running"); // Should not happen

        // If paused, do not process. This shouldn't happen if we clear queue correctly,
        // but serves as a safety check for race conditions.
        if (this.isPaused) return;

        const currentResult = this.results.get(urlToProcess);
        // Should always exist as it's added before queuing, but check defensively
        if (!currentResult) {
            console.error(`Error: Result object missing for ${urlToProcess} at depth ${depth}`);
            return;
        }

        // Check if URL should be processed
        if (this.shouldSkipUrl(urlToProcess, depth, currentResult)) {
            return;
        }

        // Mark as visited *before* fetching to prevent race conditions in queuing
        this.visitedLinks.add(urlToProcess);

        // Use optional chaining for limit properties in log
        console.log(`[${this.limit?.activeCount}/${this.limit?.pendingCount}] Scanning [Depth ${depth}]: ${urlToProcess}`);

        // Fetch and process
        try {
            // Only use auth headers for the same domain or when configured to use for all domains
            const isSameDomainUrl = this.isSameDomain(urlToProcess);
            const shouldUseAuth = isSameDomainUrl || this.config.useAuthForAllDomains;

            // Choose appropriate timeout based on whether it's same domain
            const timeoutDuration = isSameDomainUrl ?
                this.config.requestTimeout :
                Math.min(this.config.requestTimeout, 15000); // 15s max for external domains

            const fetchOptions: RequestInit = {
                headers: shouldUseAuth ? this.authHeadersCache || {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                } : {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                },
                redirect: 'follow',
                signal: AbortSignal.any([
                    this.abortController.signal,
                    AbortSignal.timeout(timeoutDuration)
                ]),
                cache: 'no-store',
                keepalive: true
            };

            const response = await fetch(urlToProcess, fetchOptions);

            const status = response.status;
            const contentType = response.headers.get('content-type') || '';
            const isBroken = status >= 400;

            // Always mark links with status >= 400 as broken, no exceptions
            currentResult.status = isBroken ? 'broken' : 'ok';
            currentResult.statusCode = status;
            currentResult.contentType = contentType;


            // Parse HTML and queue new links if applicable
            if (!isBroken && contentType.includes('text/html') && this.config.processHtml) {
                // Check depth is within limits for recursive scanning
                const maxDepth = this.config.depth;
                if (maxDepth === 0 || depth < maxDepth) {
                    const html = await response.text();
                    this.processPageLinks(html, urlToProcess, depth);
                }
            }
        } catch (error: any) {
            console.error(`Error scanning ${urlToProcess}:`, error.name, error.message);

            // Properly handle timeout errors with a specific message
            if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
                currentResult.status = 'broken';
                currentResult.errorMessage = `Request timed out after ${this.config.requestTimeout / 1000} seconds`;
            } else {
                currentResult.status = 'error';
                currentResult.errorMessage = error.message || 'Unknown error occurred';
            }
        }
    }

    // Extract and process links from a page
    protected processPageLinks(html: string, pageUrl: string, currentDepth: number): void {
        if (!this.limit || this.isPaused) return; // Safety check

        const $ = cheerio.load(html);

        // Get all links that are not in excluded CSS selectors
        let links = $('a[href]');
        let skippedLinks = new Set<string>();

        // Filter out links based on CSS selectors if configured
        if (this.config.cssSelectors && this.config.cssSelectors.length > 0) {
            // ... (CSS selector logic remains unchanged)
            this.config.cssSelectors.forEach(selector => {
                try {
                    const selectedElements = $(selector);
                    selectedElements.find('a[href]').each((_, el) => {
                        $(el).attr('data-link-checker-exclude', 'true');
                        const href = $(el).attr('href')?.trim();
                        if (href) {
                            const nextUrl = this.normalizeUrl(href, pageUrl);
                            if (nextUrl) {
                                skippedLinks.add(nextUrl);
                                this.addOrUpdateResultWithContext(
                                    nextUrl,
                                    pageUrl,
                                    '',
                                    {
                                        status: 'skipped',
                                        errorMessage: 'Excluded by CSS selector'
                                    }
                                );
                                if (this.config.cssSelectorsForceExclude) {
                                    this.visitedLinks.add(nextUrl);
                                }
                            }
                        }
                    });
                } catch (error) {
                    console.warn(`Invalid CSS selector: ${selector}`);
                }
            });
            links = links.filter((_, el) => !$(el).attr('data-link-checker-exclude'));
        }

        // Prepare a batch of links to process more efficiently
        const linkBatch: { url: string, context: string }[] = [];

        links.each((_, element) => {
            const href = $(element).attr('href')?.trim();
            if (!href) return;

            const nextUrl = this.normalizeUrl(href, pageUrl);
            if (!nextUrl) return;

            // Skip processing links we've already marked as skipped
            if (skippedLinks.has(nextUrl)) {
                return;
            }

            // Check if external domain and if we should skip processing external links
            const isExternal = !this.isSameDomain(nextUrl);
            if (isExternal) {
                // Always create a basic result entry for external links
                this.addOrUpdateResultWithContext(nextUrl, pageUrl, '', { status: 'external' });

                // If skipExternalDomains is true, don't queue external links for processing
                if (this.config.skipExternalDomains) {
                    return;
                }
            }

            // Add to batch
            linkBatch.push({ url: nextUrl, context: '' });
        });

        // Process the batch of links all at once 
        for (const { url, context } of linkBatch) {
            // Add or update result entry with HTML context
            this.addOrUpdateResultWithContext(url, pageUrl, context);

            // Queue for processing
            this.queueLinkForProcessing(url, currentDepth + 1);
        }
    }

    // Queue a link for processing if it meets criteria
    protected queueLinkForProcessing(url: string, depth: number): void {
        // Skip if already queued
        if (this.queuedLinks.has(url)) return;

        // Skip if paused
        if (this.isPaused) return;

        // Add to queue set to prevent duplicates
        this.queuedLinks.add(url);

        // Add to pending map for state tracking
        this.pendingUrls.set(url, depth);

        // Schedule processing with the limiter
        if (this.limit) {
            this.limit(() => this.processUrl(url, depth)).catch(error => {
                console.error(`Error processing ${url}:`, error);
                this.pendingUrls.delete(url); // Ensure cleanup on error
            });
        }
    }

    // ... (wildcardMatch, shouldSkipUrl methods remain unchanged)

    // Wildcard matching helper function
    protected wildcardMatch(text: string, pattern: string): boolean {
        // ... (implementation unchanged)
        if (!pattern.includes('://') && !pattern.startsWith('*')) {
            if (pattern.includes('/')) {
                const parts = pattern.split('/', 2);
                const domainPart = parts[0];
                try {
                    const urlObj = new URL(text);
                    const hostname = urlObj.hostname;
                    const normalizedHostname = hostname.replace('www.', '');
                    const normalizedDomainPart = domainPart.replace('www.', '');

                    const isExactMatch = hostname === domainPart || normalizedHostname === normalizedDomainPart;
                    const isSubdomainMatch = hostname.endsWith('.' + domainPart) || normalizedHostname.endsWith('.' + normalizedDomainPart);

                    if (!isExactMatch && !isSubdomainMatch) {
                        return false;
                    }
                    const pathPattern = pattern.substring(domainPart.length);
                    if (pathPattern === '/') {
                        return urlObj.pathname === '/' || urlObj.pathname === '';
                    } else if (pathPattern === '/*') {
                        return true;
                    } else {
                        pattern = '*' + pathPattern;
                        text = urlObj.pathname;
                    }
                } catch (e) { }
            } else {
                try {
                    const urlObj = new URL(text);
                    const hostname = urlObj.hostname;
                    const normalizedHostname = hostname.replace('www.', '');
                    const normalizedPattern = pattern.replace('www.', '');

                    return hostname === pattern ||
                        normalizedHostname === normalizedPattern ||
                        hostname.endsWith('.' + pattern) ||
                        normalizedHostname.endsWith('.' + normalizedPattern);
                } catch (e) { }
            }
        }
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }

    // Determines if a URL should be processed or skipped
    protected shouldSkipUrl(url: string, depth: number, result: ScanResult): boolean {
        // ... (implementation unchanged)
        if (this.config.scanSameLinkOnce && this.visitedLinks.has(url)) {
            if (result.status === 'external') result.status = 'skipped';
            return true;
        }
        const maxDepth = this.config.depth;
        if (maxDepth > 0 && depth > maxDepth) {
            result.status = 'skipped';
            result.errorMessage = `Exceeded max depth (${maxDepth})`;
            return true;
        }
        const urlObj = new URL(url);
        const isExternal = !url.startsWith(this.baseUrl);
        if (isExternal) {
            result.status = 'external';
        }
        if (this.config.excludeSubdomains) {
            const baseHostname = new URL(this.startUrl).hostname;
            const rootDomain = extractRootDomain(baseHostname);
            if (urlObj.hostname !== baseHostname && isSubdomainOfRoot(urlObj.hostname, rootDomain)) {
                result.status = 'skipped';
                result.errorMessage = `Skipped subdomain: ${urlObj.hostname}`;
                return true;
            }
        }
        if (this.config.wildcardExclusions && this.config.wildcardExclusions.length > 0) {
            for (const pattern of this.config.wildcardExclusions) {
                if (this.wildcardMatch(url, pattern)) {
                    result.status = 'skipped';
                    result.errorMessage = `URL matches wildcard exclusion pattern: ${pattern}`;
                    return true;
                }
            }
        }
        if (this.config.regexExclusions && this.config.regexExclusions.length > 0) {
            for (const pattern of this.config.regexExclusions) {
                try {
                    const regex = new RegExp(pattern);
                    if (regex.test(url)) {
                        result.status = 'skipped';
                        result.errorMessage = `URL matches exclusion pattern: ${pattern}`;
                        return true;
                    }
                } catch (error) {
                    console.warn(`Invalid regex pattern: ${pattern}`);
                }
            }
        }
        return false;
    }

    // Public method to pause the scan and return state
    public async pause(): Promise<ScanState> {
        this.isPaused = true;

        // Clear the p-limit queue so pending tasks don't start
        if (this.limit) {
            this.limit.clearQueue();
        }

        // Wait for active tasks to complete
        // We don't want to abort active requests, just wait for them
        while (this.limit && this.limit.activeCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        return this.getScanState();
    }

    /**
     * Aggressively stops the scan, clearing all queues and returning current state.
     */
    public async stop(): Promise<ScanState> {
        this.isPaused = true;
        this.isRunning = false;
        this.abortController.abort();

        if (this.limit) {
            this.limit.clearQueue();
        }

        return this.getScanState();
    }

    // Get current state for serialization
    public getScanState(): ScanState {
        // Convert complex objects to serializable format
        const serializedResults = Array.from(this.results.values()).map(r => {
            return {
                ...r,
                foundOn: Array.from(r.foundOn)
            };
        });

        return {
            visitedLinks: Array.from(this.visitedLinks),
            results: serializedResults,
            queue: Array.from(this.pendingUrls.entries()).map(([url, depth]) => ({ url, depth })),
            aborted: Array.from(this.abortedUrls.entries()).map(([url, depth]) => ({ url, depth }))
        };
    }
}

/**
 * Main function to scan a website and collect link information
 * @param startUrl The URL to start scanning from
 * @param config Configuration options for the scan
 * @param callbacks Optional callbacks for real-time updates
 * @param initialState Optional state to resume from
 * @returns A promise that resolves to an array of ScanResult objects
 */
export async function scanWebsite(startUrl: string, config: ScanConfig = {}, callbacks: ScanCallbacks = {}, initialState?: ScanState): Promise<ScanResult[]> {
    // Create a new scanner instance with domain filtering enabled by default
    const scanner = new WebsiteScanner(startUrl, {
        ...config,
        // Preserve user's explicit choice, otherwise default to true
        skipExternalDomains: config.skipExternalDomains !== undefined ? config.skipExternalDomains : true
    }, callbacks, initialState);

    // Run the scan
    return await scanner.scan();
}

/**
 * Extension of the base Scanner class with a public scan method
 * and improved domain filtering
 */
export class WebsiteScanner extends Scanner {

    /**
     * Runs the scan and returns the results
     * @returns A promise that resolves to an array of ScanResult objects
     */
    public async scan(): Promise<ScanResult[]> {
        // Initialize the limiter
        this.limit = pLimit(this.config.concurrency);
        this.isRunning = true;
        this.isPaused = false;
        // Re-initialize abort controller for new run
        this.abortController = new AbortController();

        console.log(`Starting scan of ${this.startUrl} with domain filtering ${this.config.skipExternalDomains ? 'enabled' : 'disabled'}`);

        if (this.callbacks.onStart) {
            this.callbacks.onStart(1); // Start with 1 URL
        }

        // If resuming, queue the pending URLs from state
        if (this.pendingUrls.size > 0 || this.abortedUrls.size > 0) {
            console.log(`Resuming scan with ${this.abortedUrls.size} aborted and ${this.pendingUrls.size} pending URLs...`);

            // First queue aborted URLs (prioritize them)
            const aborted = Array.from(this.abortedUrls.entries());
            this.abortedUrls.clear();
            for (const [url, depth] of aborted) {
                this.queueLinkForProcessing(url, depth);
            }

            // Then queue pending URLs
            // We need to queue them, but queueLinkForProcessing adds to pendingUrls again.
            // So we iterate a copy.
            const pending = Array.from(this.pendingUrls.entries());
            // Clear current pending because queueLinkForProcessing will re-add them
            this.pendingUrls.clear();

            for (const [url, depth] of pending) {
                this.queueLinkForProcessing(url, depth);
            }
        } else {
            // Start scanning from the initial URL at depth 0
            // We must use this.limit to ensure activeCount is incremented
            // so that pause() waits for this task to complete/abort.
            this.limit(() => this.processUrl(this.startUrl, 0).catch(error => {
                console.error("Error processing start URL:", error);
            }));
        }

        try {
            // Create a timer to check periodically if all tasks are complete
            const waitForComplete = () => {
                return new Promise<void>((resolve, reject) => {
                    const checkComplete = () => {
                        // If paused, resolve immediately (the pause method handles the waiting for active tasks)
                        if (this.isPaused) {
                            resolve();
                            return;
                        }

                        // If there are no active or pending tasks, we're done
                        if (this.limit && this.limit.activeCount === 0 && this.limit.pendingCount === 0) {
                            resolve();
                        } else {
                            setTimeout(checkComplete, 100);
                        }
                    };
                    checkComplete();
                });
            };

            // Wait for all tasks to complete or pause
            await waitForComplete();

            // Convert results map to array
            const resultsArray = Array.from(this.results.values());

            // Only call onComplete if we finished naturally, not if paused
            if (!this.isPaused && this.callbacks.onComplete) {
                this.callbacks.onComplete(resultsArray);
            }

            return resultsArray;
        } catch (error: any) {
            if (this.callbacks.onError) {
                this.callbacks.onError(error);
            }
            throw error;
        } finally {
            this.isRunning = false;
        }
    }

    // ... (processUrl override remains mostly unchanged, but calls super.processUrl logic)
    // Actually, I need to copy the processUrl override logic here because it's specific to WebsiteScanner

    // Override pause to abort active requests
    public async pause(): Promise<ScanState> {
        if (this.abortController) {
            this.abortController.abort();
        }
        return super.pause();
    }

    /**
     * Override stop to abort all active and pending work immediately
     */
    public async stop(): Promise<ScanState> {
        return super.stop();
    }

    /**
     * Override the processUrl method to implement domain filtering
     * Only process HTML content for links from the same domain
     */
    protected async processUrl(urlToProcess: string, depth: number): Promise<void> {
        if (!this.limit) throw new Error("Scanner not running"); // Should not happen

        if (this.isPaused) return;

        // Remove from pending map as we are starting to process it
        this.pendingUrls.delete(urlToProcess);

        const currentResult = this.results.get(urlToProcess);
        // Should always exist as it's added before queuing, but check defensively
        if (!currentResult) {
            console.error(`Error: Result object missing for ${urlToProcess} at depth ${depth}`);
            return;
        }

        // Check if URL should be processed
        if (this.shouldSkipUrl(urlToProcess, depth, currentResult)) {
            return;
        }

        // Check if it's an external domain and we should skip processing it
        // (But we still want to include the link in our results, just not fetch/analyze it)
        if (this.config.skipExternalDomains && !this.isSameDomain(urlToProcess) && urlToProcess !== this.startUrl) {
            console.log(`Skipping external domain: ${urlToProcess} (not scanning for content)`);
            currentResult.status = 'external';
            // Mark as visited to prevent queuing attempts
            this.visitedLinks.add(urlToProcess);
            return;
        }

        // Mark as visited *before* fetching to prevent race conditions in queuing
        this.visitedLinks.add(urlToProcess);

        // Use optional chaining for limit properties in log
        console.log(`[${this.limit?.activeCount}/${this.limit?.pendingCount}] Scanning [Depth ${depth}]: ${urlToProcess}`);

        if (this.callbacks.onProgress) {
            this.callbacks.onProgress(this.visitedLinks.size, urlToProcess, this.brokenLinksCount, this.results.size);
        }

        // Fetch and process
        try {
            // Determine if this URL is from the same domain as the start URL
            const isSameDomainUrl = this.isSameDomain(urlToProcess);
            const shouldUseAuth = isSameDomainUrl || this.config.useAuthForAllDomains;

            // Log authentication decision
            if (this.config.auth) {
                if (shouldUseAuth) {
                    console.log(`Using HTTP Basic Auth for ${urlToProcess} (same domain as scan URL)`);
                } else {
                    console.log(`Skipping HTTP Basic Auth for ${urlToProcess} (different domain than scan URL)`);
                }
            }

            // Choose appropriate timeout based on whether it's same domain
            const timeoutDuration = isSameDomainUrl ?
                this.config.requestTimeout :
                Math.min(this.config.requestTimeout, 15000); // 15s max for external domains

            // Create a controller for this request that listens to the main abort controller
            const requestController = new AbortController();
            const signal = requestController.signal;

            // Abort if the main controller aborts (pause)
            const onMainAbort = () => requestController.abort();
            if (this.abortController) {
                this.abortController.signal.addEventListener('abort', onMainAbort);
            }

            // Abort on timeout
            const timeoutId = setTimeout(() => requestController.abort(), timeoutDuration);

            const fetchOptions: RequestInit = {
                headers: shouldUseAuth ? this.authHeadersCache || {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                } : {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                },
                redirect: 'follow',
                signal: signal,
                cache: 'no-store',
                keepalive: true
            };

            let response;
            try {
                response = await fetch(urlToProcess, fetchOptions);
            } finally {
                clearTimeout(timeoutId);
                if (this.abortController) {
                    this.abortController.signal.removeEventListener('abort', onMainAbort);
                }
            }

            const status = response.status;
            const contentType = response.headers.get('content-type') || '';
            const isBroken = status >= 400;

            // Always mark links with status >= 400 as broken, no exceptions
            currentResult.status = isBroken ? 'broken' : 'ok';
            currentResult.statusCode = status;
            currentResult.contentType = contentType;
            currentResult.usedAuth = shouldUseAuth && !!this.config.auth;

            // Parse HTML and queue new links if applicable
            // Only process HTML for links from the same domain or if skipExternalDomains is false
            const shouldProcessHtml = !isBroken &&
                contentType.includes('text/html') &&
                this.config.processHtml &&
                (!this.config.skipExternalDomains || isSameDomainUrl);

            if (shouldProcessHtml) {
                // Check depth is within limits for recursive scanning
                const maxDepth = this.config.depth;
                if (maxDepth === 0 || depth < maxDepth) {
                    const html = await response.text();
                    this.processPageLinks(html, urlToProcess, depth);
                }
            }
        } catch (error: any) {
            // Check for abort due to pause
            // We check isPaused because abortController might be nullified by scan() finally block
            // before this catch block runs in a race condition
            if (this.isPaused || this.abortController?.signal.aborted) {
                console.log(`Aborted ${urlToProcess} due to pause`);
                // Re-queue the URL so it gets processed when resumed
                // Add to abortedUrls so it gets prioritized
                this.abortedUrls.set(urlToProcess, depth);
                // Remove from visited so it can be picked up again
                this.visitedLinks.delete(urlToProcess);
                return;
            }

            console.error(`Error scanning ${urlToProcess}:`, error.name, error.message);

            // Properly handle timeout errors with a specific message
            if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
                currentResult.status = 'broken';
                currentResult.errorMessage = `Request timed out after ${this.config.requestTimeout / 1000} seconds`;
            } else {
                currentResult.status = 'error';
                currentResult.errorMessage = error.message || 'Unknown error occurred';
            }
        }
    }
}

// Extract the root domain from a hostname (e.g., "www.example.com" -> "example.com")
function extractRootDomain(hostname: string): string {
    const parts = hostname.split('.');
    // If we have a standard domain like example.com
    if (parts.length === 2) return hostname;
    // For domains like www.example.com, or sub.example.com
    // Return just the main domain (example.com)
    return parts.slice(-2).join('.');
}

// Check if hostname is a subdomain of the root domain
function isSubdomainOfRoot(hostname: string, rootDomain: string): boolean {
    // Not a subdomain if it's the same as the root
    if (hostname === rootDomain) return false;

    // Check if the hostname ends with the root domain
    return hostname.endsWith('.' + rootDomain);
}

// Original isSubdomain function is no longer used for subdomain checking
function isSubdomain(subdomain: string, parentDomain: string): boolean {
    // Skip identical domains
    if (subdomain === parentDomain) {
        return false;
    }

    // Extract domain parts
    const subdomainParts = subdomain.split('.');
    const parentDomainParts = parentDomain.split('.');

    // Subdomain must have more parts
    if (subdomainParts.length <= parentDomainParts.length) {
        return false;
    }

    // Check if the subdomain ends with the parent domain
    // For example, "reporting.novartis.com" should be a subdomain of "novartis.com"
    const parentLength = parentDomainParts.length;
    for (let i = 0; i < parentLength; i++) {
        const subIdx = subdomainParts.length - parentLength + i;
        if (subdomainParts[subIdx] !== parentDomainParts[i]) {
            return false;
        }
    }

    return true;
}