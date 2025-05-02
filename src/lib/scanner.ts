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
    cssSelectors?: string[]; // Array of CSS selectors - links inside these elements will be excluded
    requestTimeout?: number; // Timeout in milliseconds for each request (default: 10000)
    auth?: {
        username: string;
        password: string;
    }; // HTTP Basic Authentication credentials
    useAuthForAllDomains?: boolean; // Use auth headers for all domains instead of just the same domain
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
    protected readonly config: Required<Pick<ScanConfig, 'depth' | 'scanSameLinkOnce' | 'concurrency' | 'itemsPerPage' | 'regexExclusions' | 'cssSelectors' | 'requestTimeout' | 'useAuthForAllDomains'>> & ScanConfig;
    protected readonly visitedLinks: Set<string>; // Tracks links whose content has been fetched/processed
    protected readonly queuedLinks: Set<string>; // Tracks links that have been added to the queue
    protected readonly results: Map<string, ScanResult>; // Stores results for all encountered links
    // No longer need instance queue, managed by p-limit
    // private readonly queue: { url: string; depth: number; sourceUrl: string }[];
    protected isRunning: boolean = false;
    // Use the inferred type for the limiter instance
    protected limit: LimitFunction | null = null;
    // Cache for auth headers to avoid recomputing for each request
    private authHeadersCache: Record<string, string> | null = null;
    // Domain cache to optimize hostname lookups
    private domainCache: Map<string, string> = new Map();

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
            cssSelectors: config.cssSelectors ?? [], // Default to empty array
            requestTimeout: config.requestTimeout ?? 30000, // Default to 30 seconds (up from 10)
            useAuthForAllDomains: config.useAuthForAllDomains ?? false,
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

    private normalizeUrl(url: string, baseUrl: string): string | null {
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
    private isSameDomain(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const baseObj = new URL(this.baseUrl);
            return urlObj.hostname === baseObj.hostname;
        } catch {
            return false;
        }
    }

    // Helper to add or update link results with HTML context
    private addOrUpdateResultWithContext(linkUrl: string, sourceUrl: string, htmlContext: string, partialResult: Partial<Omit<ScanResult, 'url' | 'foundOn' | 'htmlContexts'>> = {}) {
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
            if (!isBroken && contentType.includes('text/html')) {
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
    private processPageLinks(html: string, pageUrl: string, currentDepth: number): void {
        if (!this.limit) return; // Safety check

        const $ = cheerio.load(html);
        
        // Get all links that are not in excluded CSS selectors
        let links = $('a[href]');
        
        // Filter out links based on CSS selectors if configured
        if (this.config.cssSelectors && this.config.cssSelectors.length > 0) {
            // For each CSS selector, mark links that should be excluded
            this.config.cssSelectors.forEach(selector => {
                try {
                    $(selector).find('a[href]').each((_, el) => {
                        // Mark elements to be excluded
                        $(el).attr('data-link-checker-exclude', 'true');
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

            // Capture the HTML context (the <a> tag and its content)
            // Streamlined context capture for better performance
            let htmlContext = '';
            try {
                // Just grab the immediate parent for context - reduces processing time
                const parent = $(element).parent();
                htmlContext = parent.length ? 
                    $.html(parent).substring(0, 200) : // Smaller context size
                    $.html(element);
            } catch (e) {
                // Fallback to just the element itself if there's an error
                htmlContext = $.html(element);
            }

            // Add to batch instead of processing immediately
            linkBatch.push({ url: nextUrl, context: htmlContext });
        });

        // Process the batch of links all at once
        for (const { url, context } of linkBatch) {
            // Add or update result entry with HTML context
            this.addOrUpdateResultWithContext(url, pageUrl, context);

            // Queue for processing if meets criteria
            this.queueLinkForProcessing(url, currentDepth + 1);
        }
    }

    // Determines if a URL should be processed or skipped
    private shouldSkipUrl(url: string, depth: number, result: ScanResult): boolean {
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

        // 4. Check regex exclusions
        if (this.config.regexExclusions && this.config.regexExclusions.length > 0) {
            for (const pattern of this.config.regexExclusions) {
                try {
                    const regex = new RegExp(pattern);
                    if (regex.test(url)) {
                        result.status = 'skipped';
                        result.errorMessage = `Matched regex exclusion: ${pattern}`;
                        return true;
                    }
                } catch (error) {
                    console.warn(`Invalid regex pattern: ${pattern}`);
                }
            }
        }

        return false;
    }

    // Adds a link to the processing queue if eligible
    private queueLinkForProcessing(url: string, depth: number): void {
        if (!this.limit) return;
        
        // Don't requeue already visited or queued links if scanSameLinkOnce is true
        if (this.config.scanSameLinkOnce && (this.visitedLinks.has(url) || this.queuedLinks.has(url))) {
            return;
        }
        
        // Skip external links
        if (!url.startsWith(this.baseUrl)) {
            return;
        }
        
        // Skip if beyond depth limit
        const maxDepth = this.config.depth;
        if (maxDepth !== 0 && depth > maxDepth) {
            return;
        }
        
        // Mark as queued and add to processing queue
        this.queuedLinks.add(url);
        this.limit(() => this.processUrl(url, depth));
    }

    async run(): Promise<Map<string, ScanResult>> {
        if (this.isRunning) {
            throw new Error("Scan already in progress.");
        }
        this.isRunning = true;
        
        // Adjust concurrency for authenticated requests if needed
        const effectiveConcurrency = this.config.auth 
            ? Math.min(this.config.concurrency, 15) // Limit concurrent auth requests to prevent server throttling
            : this.config.concurrency;
            
        this.limit = pLimit(effectiveConcurrency);
        console.log(`Starting concurrent scan (concurrency: ${effectiveConcurrency}) for ${this.startUrl}`);

        // Queue the initial URL
        this.queuedLinks.add(this.startUrl);
        this.limit(() => this.processUrl(this.startUrl, 0));

        // Wait for the queue to become idle
        await new Promise<void>(resolve => {
            const checkIdle = () => {
                // Add null check for this.limit before accessing properties
                if (this.limit && this.limit.activeCount === 0 && this.limit.pendingCount === 0) {
                    resolve();
                } else {
                    // Check again shortly
                    setTimeout(checkIdle, 100);
                }
            };
            checkIdle();
        });

        console.log('Scan finished.');
        this.isRunning = false;
        this.limit = null; // Clean up limiter
        return this.results;
    }
}

/**
 * Starts the website scan by instantiating and running the Scanner.
 * @param startUrl The initial URL to start scanning from.
 * @param config Scan configuration.
 * @returns A promise that resolves with the scan results (Map<string, ScanResult>).
 */
export async function startScan(startUrl: string, config: ScanConfig = {}): Promise<Map<string, ScanResult>> {
    const scanner = new Scanner(startUrl, config);
    return scanner.run();
}

/**
 * Starts a website scan with real-time updates via callbacks
 * @param startUrl The URL to start scanning from
 * @param config Scan configuration options
 * @param callbacks Callbacks for real-time updates
 * @returns A promise that resolves when the scan is complete
 */
export async function scanWebsite(
  startUrl: string, 
  config: ScanConfig = {}, 
  callbacks: ScanCallbacks = {}
): Promise<ScanResult[]> {
  try {
    // Create a scanner instance
    const scanner = new ScannerWithCallbacks(startUrl, config, callbacks);
    
    // Run the scan
    const resultsMap = await scanner.run();
    
    // Convert results map to array
    const resultsArray = Array.from(resultsMap.values());
    
    // Call the completion callback
    if (callbacks.onComplete) {
      callbacks.onComplete(resultsArray);
    }
    
    return resultsArray;
  } catch (error) {
    // Call the error callback
    if (callbacks.onError && error instanceof Error) {
      callbacks.onError(error);
    }
    
    throw error; // Re-throw to allow caller to handle it
  }
}

/**
 * Extended Scanner class that supports callbacks for real-time updates
 */
class ScannerWithCallbacks extends Scanner {
  private readonly callbacks: ScanCallbacks;
  private processedCount: number = 0;
  
  constructor(startUrl: string, config: ScanConfig = {}, callbacks: ScanCallbacks = {}) {
    super(startUrl, config);
    this.callbacks = callbacks;
  }
  
  // Override the run method to add callback support
  async run(): Promise<Map<string, ScanResult>> {
    // Estimate the number of URLs based on depth
    const estimatedUrls = this.estimateUrlCount();
    
    // Call the onStart callback
    if (this.callbacks.onStart) {
      this.callbacks.onStart(estimatedUrls);
    }
    
    // Run the original scan
    return await super.run();
  }
  
  // Override the processUrl method to add progress updates
  protected async processUrl(urlToProcess: string, depth: number): Promise<void> {
    // Call the onProgress callback
    if (this.callbacks.onProgress) {
      this.processedCount++;
      this.callbacks.onProgress(this.processedCount, urlToProcess);
    }
    
    // Process the URL as usual
    await super.processUrl(urlToProcess, depth);
    
    // Get the processed result
    const result = this.results.get(urlToProcess);
    
    // Double-check the result status based on status code
    if (result && result.statusCode !== undefined && result.statusCode >= 400) {
      result.status = 'broken'; // Ensure consistent status
    }
    
    // Call the onResult callback if result exists
    if (result && this.callbacks.onResult) {
      this.callbacks.onResult(result);
    }
  }
  
  // Add a method to estimate the number of URLs that will be processed
  private estimateUrlCount(): number {
    const depth = this.config.depth;
    
    // Use a simple formula based on depth
    // This is just a rough estimate
    if (depth === 0) {
      return 1000; // Arbitrary number for unlimited depth
    } else {
      // Estimate with a branching factor of ~5 links per page
      return Math.min(1000, Math.pow(5, depth + 1));
    }
  }
}
 