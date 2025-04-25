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
    // TODO: Add exclusions (urls: string[], regex: string[], selectors: string[])
    // TODO: Add User-Agent
    // TODO: Add request timeout
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
    protected readonly config: Required<Pick<ScanConfig, 'depth' | 'scanSameLinkOnce' | 'concurrency' | 'itemsPerPage'> & ScanConfig>;
    protected readonly visitedLinks: Set<string>; // Tracks links whose content has been fetched/processed
    protected readonly queuedLinks: Set<string>; // Tracks links that have been added to the queue
    protected readonly results: Map<string, ScanResult>; // Stores results for all encountered links
    // No longer need instance queue, managed by p-limit
    // private readonly queue: { url: string; depth: number; sourceUrl: string }[];
    protected isRunning: boolean = false;
    // Use the inferred type for the limiter instance
    protected limit: LimitFunction | null = null;

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
            ...config, // Include any other passed config options
        };

        if (this.config.concurrency <= 0) {
             throw new Error("Concurrency must be a positive number.");
        }

        this.visitedLinks = new Set<string>();
        this.queuedLinks = new Set<string>();
        this.results = new Map<string, ScanResult>();
        // Initialize results map with start URL
        this.addOrUpdateResultWithContext(this.startUrl, 'initial', '');
    }

    private normalizeUrl(url: string, baseUrl: string): string | null {
        try {
            // Handle mailto:, tel:, etc. which are valid but not scannable http links
            if (!url.startsWith('http') && !url.startsWith('/') && !url.startsWith('#')) {
                 if (/^[a-zA-Z]+:/.test(url)) { // Check for other protocols like mailto:, tel:
                    return null;
                 }
            }

            if (url.startsWith('#')) {
                const absoluteUrl = new URL(baseUrl);
                absoluteUrl.hash = "";
                return absoluteUrl.toString();
            }

            const absoluteUrl = new URL(url, baseUrl);
            absoluteUrl.hash = ""; // Remove fragment
            return absoluteUrl.toString();
        } catch (error) {
            console.warn(`Invalid URL encountered: ${url} (Base: ${baseUrl})`);
            return null;
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
            const response = await fetch(urlToProcess, {
                headers: { 'User-Agent': 'LinkCheckerProBot/1.0' },
                redirect: 'follow',
                signal: AbortSignal.timeout(10000), // 10 second timeout
            });

            const status = response.status;
            const contentType = response.headers.get('content-type') || '';
            const isBroken = status >= 400;

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
            currentResult.status = 'error';
            if (error.name === 'TimeoutError') {
                currentResult.status = 'broken';
            }
            currentResult.errorMessage = error.message;
        }
    }

    // Extract and process links from a page
    private processPageLinks(html: string, pageUrl: string, currentDepth: number): void {
        if (!this.limit) return; // Safety check

        const $ = cheerio.load(html);

        $('a[href]').each((_, element) => {
            const href = $(element).attr('href')?.trim();
            if (!href) return;

            const nextUrl = this.normalizeUrl(href, pageUrl);
            if (!nextUrl) return;

            // Capture the HTML context (the <a> tag and its content)
            // Get up to 5 parents to give enough context
            const parents = $(element).parents().slice(0, 5);
            let htmlContext = '';
            if (parents.length > 0) {
                // Get the outermost parent for context
                const parentHtml = $.html(parents.last());
                // Trim to a reasonable size
                htmlContext = parentHtml.length > 500 ? 
                    parentHtml.substring(0, 500) + '...' : 
                    parentHtml;
            } else {
                // If no parents, just get the link element HTML
                htmlContext = $.html(element);
            }

            // Add or update result entry with HTML context
            this.addOrUpdateResultWithContext(nextUrl, pageUrl, htmlContext);

            // Queue for processing if meets criteria
            this.queueLinkForProcessing(nextUrl, currentDepth + 1);
        });
    }

    // Determines if a URL should be processed or skipped
    private shouldSkipUrl(url: string, depth: number, result: ScanResult): boolean {
        // 1. Already fetched/processed?
        if (this.config.scanSameLinkOnce && this.visitedLinks.has(url)) {
            if (result.status === 'external') result.status = 'skipped';
            return true;
        }
        
        // 2. Depth limit exceeded?
        const maxDepth = this.config.depth;
        if (maxDepth !== 0 && depth > maxDepth) {
            console.log(`Skipping due to depth limit (${depth} > ${maxDepth}): ${url}`);
            result.status = 'skipped';
            return true;
        }
        
        // 3. External URL?
        if (!url.startsWith(this.baseUrl)) {
            result.status = 'external';
            return true;
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
        this.limit = pLimit(this.config.concurrency);
        console.log(`Starting concurrent scan (concurrency: ${this.config.concurrency}) for ${this.startUrl}`);

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
 