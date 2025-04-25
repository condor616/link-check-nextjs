import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

// Infer the Limit type from the pLimit function itself
type LimitFunction = ReturnType<typeof pLimit>;

// Define configuration interface (can be expanded)
export interface ScanConfig {
    depth?: number; // 0 or undefined means infinite
    scanSameLinkOnce?: boolean;
    concurrency?: number; // Max concurrent requests
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
}

// Use classes for better state management during a scan
class Scanner {
    private readonly startUrl: string;
    private readonly baseUrl: string;
    // Use Partial for config during construction, then create required version
    private readonly config: Required<Pick<ScanConfig, 'depth' | 'scanSameLinkOnce' | 'concurrency'> & ScanConfig>;
    private readonly visitedLinks: Set<string>; // Tracks links whose content has been fetched/processed
    private readonly results: Map<string, ScanResult>; // Stores results for all encountered links
    // No longer need instance queue, managed by p-limit
    // private readonly queue: { url: string; depth: number; sourceUrl: string }[];
    private isRunning: boolean = false;
    // Use the inferred type for the limiter instance
    private limit: LimitFunction | null = null;

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
            ...config, // Include any other passed config options
        };

        if (this.config.concurrency <= 0) {
             throw new Error("Concurrency must be a positive number.");
        }

        this.visitedLinks = new Set<string>();
        this.results = new Map<string, ScanResult>();
        // Initialize results map with start URL
        this.addOrUpdateResult(this.startUrl, 'initial');
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

    // Helper to add or update link results, especially the foundOn set
    // Ensure this is safe for concurrent calls (Set/Map ops are generally atomic)
    private addOrUpdateResult(linkUrl: string, sourceUrl: string, partialResult: Partial<Omit<ScanResult, 'url' | 'foundOn'>> = {}) {
        let entry = this.results.get(linkUrl);
        if (entry) {
            if (sourceUrl !== 'initial') {
                entry.foundOn.add(sourceUrl);
            }
            // Logic to prevent overwriting definitive status with less definitive one
             if (!(entry.status && entry.status !== 'external' && (partialResult.status === 'skipped' || partialResult.status === 'external'))) {
                 Object.assign(entry, partialResult);
             }
        } else {
            entry = {
                url: linkUrl,
                status: partialResult.status ?? 'external',
                statusCode: partialResult.statusCode,
                contentType: partialResult.contentType,
                errorMessage: partialResult.errorMessage,
                foundOn: new Set(sourceUrl === 'initial' ? [] : [sourceUrl]),
            };
            this.results.set(linkUrl, entry);
        }
    }

    // Function to process a single URL
    private async processUrl(urlToProcess: string, depth: number): Promise<void> {
         if (!this.limit) throw new Error("Scanner not running"); // Should not happen

         const currentResult = this.results.get(urlToProcess);
         // Should always exist as it's added before queuing, but check defensively
         if (!currentResult) {
             console.error(`Error: Result object missing for ${urlToProcess} at depth ${depth}`);
             return;
         }

        // Combined checks before fetching:
        // 1. Already fetched/processed?
        if (this.config.scanSameLinkOnce && this.visitedLinks.has(urlToProcess)) {
            if (currentResult.status === 'external') currentResult.status = 'skipped'; // Mark as skipped if appropriate
            // console.log(`Skipping already processed: ${urlToProcess}`);
            return; // Already handled this URL
        }
        // 2. Depth limit?
        const maxDepth = this.config.depth;
        if (maxDepth !== 0 && depth > maxDepth) {
            console.log(`Skipping due to depth limit (${depth} > ${maxDepth}): ${urlToProcess}`);
            currentResult.status = 'skipped';
            return; // Exceeded depth
        }
        // 3. External?
        const isInternal = urlToProcess.startsWith(this.baseUrl);
        if (!isInternal) {
            currentResult.status = 'external';
            // console.log(`Skipping external link processing: ${urlToProcess}`);
            // TODO: Option to HEAD external links (add to queue with special flag?)
            return; // Don't fetch external links
        }

        // Mark as visited *before* fetching to prevent race conditions in queuing
        this.visitedLinks.add(urlToProcess);
        // Use optional chaining for limit properties in log
        console.log(`[${this.limit?.activeCount}/${this.limit?.pendingCount}] Scanning [Depth ${depth}]: ${urlToProcess}`);

        // Fetch and process
        try {
            const response = await fetch(urlToProcess, {
                headers: { /* ... User-Agent ... */ 'User-Agent': 'LinkCheckerProBot/1.0' }, // Added default UA
                redirect: 'follow',
                signal: AbortSignal.timeout(10000), // TODO: Configurable timeout
            });

            const status = response.status;
            const contentType = response.headers.get('content-type') || '';
            const isBroken = status >= 400;

            currentResult.status = isBroken ? 'broken' : 'ok';
            currentResult.statusCode = status;
            currentResult.contentType = contentType;

            // Parse HTML and queue new links if applicable
            if (!isBroken && contentType.includes('text/html') && (maxDepth === 0 || depth < maxDepth)) {
                const html = await response.text();
                const $ = cheerio.load(html);

                $('a[href]').each((_, element) => {
                    const href = $(element).attr('href')?.trim();
                    if (!href) return;

                    const nextUrl = this.normalizeUrl(href, urlToProcess);
                    if (!nextUrl) return;

                    // TODO: Add exclusion checks here

                    // Add/update result entry first, marking where it was found
                    this.addOrUpdateResult(nextUrl, urlToProcess);

                    // Queue the link for processing if it's internal and hasn't been visited/processed yet
                    if (nextUrl.startsWith(this.baseUrl) && !this.visitedLinks.has(nextUrl)) {
                         // Add task to the limiter queue
                         this.limit!(() => this.processUrl(nextUrl, depth + 1));
                    }
                });
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

    async run(): Promise<Map<string, ScanResult>> {
        if (this.isRunning) {
            throw new Error("Scan already in progress.");
        }
        this.isRunning = true;
        this.limit = pLimit(this.config.concurrency);
        console.log(`Starting concurrent scan (concurrency: ${this.config.concurrency}) for ${this.startUrl}`);

        // Queue the initial URL
        this.limit(() => this.processUrl(this.startUrl, 0));

        // Wait for the queue to become idle
        await new Promise<void>(resolve => {
            const checkIdle = () => {
                // Add null check for this.limit before accessing properties
                if (this.limit && this.limit.activeCount === 0 && this.limit.pendingCount === 0) {
                    resolve();
                } else {
                    // Check again shortly using requestAnimationFrame for better performance in some environments
                    // or stick to setTimeout for server-side
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
 