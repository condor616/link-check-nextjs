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
    // Map of page URLs to arrays of HTML snippets containing this link
    htmlContexts?: Map<string, string[]>;
    // Flag to indicate if HTTP Basic Auth was used for this URL
    usedAuth?: boolean;
}

/**
 * Interface for callbacks to provide real-time updates about the scanning process
 */
export interface ScanCallbacks {
  onStart?: (estimatedUrls: number) => void;
  onProgress?: (processedCount: number, currentUrl: string) => void;
  onResult?: (result: ScanResult) => void;
  onComplete?: (results: ScanResult[]) => void;
  onError?: (error: Error) => void;
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
    // No longer need instance queue, managed by p-limit
    // private readonly queue: { url: string; depth: number; sourceUrl: string }[];
    protected isRunning: boolean = false;
    // Use the inferred type for the limiter instance
    protected limit: LimitFunction | null = null;
    // Cache for auth headers to avoid recomputing for each request
    protected authHeadersCache: Record<string, string> | null = null;
    // Domain cache to optimize hostname lookups
    protected domainCache: Map<string, string> = new Map();

    constructor(startUrl: string, config: ScanConfig = {}) {
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
            requestTimeout: config.requestTimeout ?? 30000, // Default to 30 seconds (up from 10)
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

        // Initialize auth headers cache if auth is provided
        if (this.config.auth?.username && this.config.auth?.password) {
            const credentials = Buffer.from(`${this.config.auth.username}:${this.config.auth.password}`).toString('base64');
            this.authHeadersCache = {
                'User-Agent': 'LinkCheckerProBot/1.0',
                'Authorization': `Basic ${credentials}`,
                'Connection': 'keep-alive' // Enable connection reuse
            };
        } else {
            this.authHeadersCache = {
                'User-Agent': 'LinkCheckerProBot/1.0',
                'Connection': 'keep-alive' // Enable connection reuse
            };
        }
        
        this.visitedLinks = new Set<string>();
        this.queuedLinks = new Set<string>();
        this.results = new Map<string, ScanResult>();
        // Initialize results map with start URL
        this.addOrUpdateResultWithContext(this.startUrl, 'initial', '');
    }

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

    // Helper to add or update link results with HTML context
    protected addOrUpdateResultWithContext(linkUrl: string, sourceUrl: string, htmlContext: string, partialResult: Partial<Omit<ScanResult, 'url' | 'foundOn' | 'htmlContexts'>> = {}) {
        let entry = this.results.get(linkUrl);
        if (entry) {
            if (sourceUrl !== 'initial') {
                entry.foundOn.add(sourceUrl);
                
                // Add HTML context
                if (!entry.htmlContexts) {
                    entry.htmlContexts = new Map<string, string[]>();
                }
                
                if (!entry.htmlContexts.has(sourceUrl)) {
                    entry.htmlContexts.set(sourceUrl, [htmlContext]);
                } else {
                    entry.htmlContexts.get(sourceUrl)?.push(htmlContext);
                }
            }
            
            // Logic to prevent overwriting definitive status with less definitive one
            if (!(entry.status && entry.status !== 'external' && (partialResult.status === 'skipped' || partialResult.status === 'external'))) {
                Object.assign(entry, partialResult);
            }
        } else {
            const htmlContexts = new Map<string, string[]>();
            if (sourceUrl !== 'initial') {
                htmlContexts.set(sourceUrl, [htmlContext]);
            }
            
            entry = {
                url: linkUrl,
                status: partialResult.status ?? 'external',
                statusCode: partialResult.statusCode,
                contentType: partialResult.contentType,
                errorMessage: partialResult.errorMessage,
                foundOn: new Set(sourceUrl === 'initial' ? [] : [sourceUrl]),
                htmlContexts
            };
            this.results.set(linkUrl, entry);
        }
    }

    // Function to process a single URL
    protected async processUrl(urlToProcess: string, depth: number): Promise<void> {
         if (!this.limit) throw new Error("Scanner not running"); // Should not happen

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
                signal: AbortSignal.timeout(timeoutDuration),
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
                currentResult.errorMessage = `Request timed out after ${this.config.requestTimeout/1000} seconds`;
            } else {
                currentResult.status = 'error';
                currentResult.errorMessage = error.message || 'Unknown error occurred';
            }
        }
    }

    // Extract and process links from a page
    protected processPageLinks(html: string, pageUrl: string, currentDepth: number): void {
        if (!this.limit) return; // Safety check

        const $ = cheerio.load(html);
        
        // Get all links that are not in excluded CSS selectors
        let links = $('a[href]');
        let skippedLinks = new Set<string>();
        
        // Filter out links based on CSS selectors if configured
        if (this.config.cssSelectors && this.config.cssSelectors.length > 0) {
            // For each CSS selector, mark links that should be excluded
            this.config.cssSelectors.forEach(selector => {
                try {
                    // Select the elements with the selector first, then find all links within them
                    const selectedElements = $(selector);
                    
                    // Then find all links within those elements
                    selectedElements.find('a[href]').each((_, el) => {
                        // Mark elements to be excluded
                        $(el).attr('data-link-checker-exclude', 'true');
                        
                        // Track the URL to mark as skipped
                        const href = $(el).attr('href')?.trim();
                        if (href) {
                            const nextUrl = this.normalizeUrl(href, pageUrl);
                            if (nextUrl) {
                                skippedLinks.add(nextUrl);
                                
                                // Add as skipped to results immediately
                                this.addOrUpdateResultWithContext(
                                    nextUrl, 
                                    pageUrl, 
                                    $.html(el), 
                                    { 
                                        status: 'skipped',
                                        errorMessage: 'Excluded by CSS selector' 
                                    }
                                );

                                // If cssSelectorsForceExclude is enabled, update the shouldSkipUrls logic by
                                // adding the URL to visitedLinks to prevent it from being scanned anywhere
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
            
            // Filter out the marked links
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
                this.addOrUpdateResultWithContext(nextUrl, pageUrl, $.html(element), { status: 'external' });
                
                // If skipExternalDomains is true, don't queue external links for processing
                if (this.config.skipExternalDomains) {
                    return;
                }
            }

            // Capture the HTML context
            let htmlContext = '';
            try {
                const parent = $(element).parent();
                htmlContext = parent.length ? 
                    $.html(parent).substring(0, 200) : 
                    $.html(element);
            } catch (e) {
                htmlContext = $.html(element);
            }

            // Add to batch
            linkBatch.push({ url: nextUrl, context: htmlContext });
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
        
        // Add to queue set to prevent duplicates
        this.queuedLinks.add(url);
        
        // Schedule processing with the limiter
        if (this.limit) {
            this.limit(() => this.processUrl(url, depth)).catch(error => {
                console.error(`Error processing ${url}:`, error);
            });
        }
    }

    // Wildcard matching helper function
    protected wildcardMatch(text: string, pattern: string): boolean {
        // Handle patterns that are meant to match any part of the URL
        if (!pattern.includes('://') && !pattern.startsWith('*')) {
            // If pattern doesn't have protocol and doesn't start with *, check if it's a domain or path pattern
            if (pattern.includes('/')) {
                // Contains a slash, could be domain + path like "example.com/about/*"
                const parts = pattern.split('/', 2);
                const domainPart = parts[0];
                
                try {
                    // Try to extract the domain from the URL
                    const urlObj = new URL(text);
                    
                    // Check if domain matches (supports subdomains)
                    if (!urlObj.hostname.endsWith(domainPart) && 
                        !urlObj.hostname.replace('www.', '').endsWith(domainPart)) {
                        return false;
                    }
                    
                    // For domain matches, we want to match the rest of the pattern against the pathname
                    // Rebuild the pattern as a path-only pattern
                    const pathPattern = pattern.substring(domainPart.length);
                    if (pathPattern === '/') {
                        // If pattern is exactly domain.com/, then only match the domain root
                        return urlObj.pathname === '/' || urlObj.pathname === '';
                    } else if (pathPattern === '/*') {
                        // If pattern is domain.com/*, then match everything on the domain
                        return true;
                    } else {
                        // Convert the pattern to match against the pathname
                        // If pattern is domain.com/about/*, use */about/* to match the pathname
                        pattern = '*' + pathPattern;
                        text = urlObj.pathname;
                    }
                } catch (e) {
                    // If URL parsing fails, fall back to direct string matching
                }
            } else {
                // Might be just a domain pattern like "example.com"
                try {
                    const urlObj = new URL(text);
                    // Check both with and without www prefix
                    return urlObj.hostname.endsWith(pattern) || 
                           urlObj.hostname.replace('www.', '').endsWith(pattern);
                } catch (e) {
                    // If URL parsing fails, fall back to direct string matching
                }
            }
        }
        
        // Convert wildcard pattern to regex
        // Escape special regex chars, but convert * to .* and ? to .
        const regexPattern = pattern
            .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
            .replace(/\*/g, '.*')                 // * becomes .*
            .replace(/\?/g, '.');                 // ? becomes .
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(text);
    }

    // Determines if a URL should be processed or skipped
    protected shouldSkipUrl(url: string, depth: number, result: ScanResult): boolean {
        // 1. Already fetched/processed?
        if (this.config.scanSameLinkOnce && this.visitedLinks.has(url)) {
            if (result.status === 'external') result.status = 'skipped';
            return true;
        }

        // 2. Check max depth (if configured)
        const maxDepth = this.config.depth;
        if (maxDepth > 0 && depth > maxDepth) {
            result.status = 'skipped';
            result.errorMessage = `Exceeded max depth (${maxDepth})`;
            return true;
        }

        // 3. Check if external (different hostname)
        const urlObj = new URL(url);
        const isExternal = !url.startsWith(this.baseUrl);
        
        if (isExternal) {
            result.status = 'external';
        }

        // 4. Check for subdomains that should be excluded
        if (this.config.excludeSubdomains) {
            const baseHostname = new URL(this.startUrl).hostname;
            if (isSubdomain(urlObj.hostname, baseHostname)) {
                result.status = 'skipped';
                result.errorMessage = `Skipped subdomain: ${urlObj.hostname}`;
                return true;
            }
        }

        // 5. Check wildcard exclusions (new feature)
        if (this.config.wildcardExclusions && this.config.wildcardExclusions.length > 0) {
            // Wildcard exclusions allow easy URL filtering without complex regex
            // Examples of wildcard patterns:
            // - "example.com/about/*" - Skips all URLs on example.com in the about section
            // - "*/privacy-policy*" - Skips all privacy policy pages on any domain
            // - "example.org/blog/*/comments" - Skips all comment sections of blog posts
            for (const pattern of this.config.wildcardExclusions) {
                if (this.wildcardMatch(url, pattern)) {
                    result.status = 'skipped';
                    result.errorMessage = `URL matches wildcard exclusion pattern: ${pattern}`;
                    return true;
                }
            }
        }

        // 6. Check regex exclusions
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
}

/**
 * Main function to scan a website and collect link information
 * @param startUrl The URL to start scanning from
 * @param config Configuration options for the scan
 * @returns A promise that resolves to an array of ScanResult objects
 */
export async function scanWebsite(startUrl: string, config: ScanConfig = {}): Promise<ScanResult[]> {
    // Create a new scanner instance with domain filtering enabled by default
    const scanner = new WebsiteScanner(startUrl, {
        ...config,
        // Preserve user's explicit choice, otherwise default to true
        skipExternalDomains: config.skipExternalDomains !== undefined ? config.skipExternalDomains : true
    });
    
    // Run the scan
    return await scanner.scan();
}

/**
 * Extension of the base Scanner class with a public scan method
 * and improved domain filtering
 */
class WebsiteScanner extends Scanner {
    /**
     * Runs the scan and returns the results
     * @returns A promise that resolves to an array of ScanResult objects
     */
    public async scan(): Promise<ScanResult[]> {
        // Initialize the limiter
        this.limit = pLimit(this.config.concurrency);
        this.isRunning = true;

        console.log(`Starting scan of ${this.startUrl} with domain filtering ${this.config.skipExternalDomains ? 'enabled' : 'disabled'}`);

        try {
            // Start scanning from the initial URL at depth 0
            await this.processUrl(this.startUrl, 0);
            
            // Create a timer to check periodically if all tasks are complete
            const waitForComplete = () => {
                return new Promise<void>(resolve => {
                    const checkComplete = () => {
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
            
            // Wait for all tasks to complete
            await waitForComplete();
            
            // Convert results map to array
            return Array.from(this.results.values());
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Override the processUrl method to implement domain filtering
     * Only process HTML content for links from the same domain
     */
    protected async processUrl(urlToProcess: string, depth: number): Promise<void> {
        if (!this.limit) throw new Error("Scanner not running"); // Should not happen

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
            
            const fetchOptions: RequestInit = {
                headers: shouldUseAuth ? this.authHeadersCache || {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                } : {
                    'User-Agent': 'LinkCheckerProBot/1.0',
                    'Connection': 'keep-alive'
                },
                redirect: 'follow',
                signal: AbortSignal.timeout(timeoutDuration),
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
            console.error(`Error scanning ${urlToProcess}:`, error.name, error.message);
            
            // Properly handle timeout errors with a specific message
            if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('aborted')) {
                currentResult.status = 'broken';
                currentResult.errorMessage = `Request timed out after ${this.config.requestTimeout/1000} seconds`;
            } else {
                currentResult.status = 'error';
                currentResult.errorMessage = error.message || 'Unknown error occurred';
            }
        }
    }
}

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