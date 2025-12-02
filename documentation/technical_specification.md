# Link Checker Pro - Technical Specification

## 1. System Overview
Link Checker Pro is a Next.js-based web application designed to crawl websites, detect broken links, and provide detailed health reports. It features a dual-storage architecture (File System & Supabase), a configurable crawling engine, and a responsive React frontend.

## 2. Architecture

### 2.1 Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Shadcn UI
- **Backend**: Next.js API Routes (Serverless functions)
- **Crawling Engine**: Custom implementation using `cheerio` (HTML parsing) and `p-limit` (concurrency).
- **Storage**: 
  - Local File System (JSON)
  - Supabase (PostgreSQL) - Optional

### 2.2 Data Flow
1.  **Initiation**: User submits a URL and config via the Frontend (`/scan`).
2.  **Processing**: 
    - `POST /api/scan` receives the request.
    - `Scanner` class initializes and begins crawling.
    - Results are streamed back or returned as a complete payload (current implementation returns complete payload).
3.  **Display**: Frontend renders results in real-time (simulated via progress) or upon completion.
4.  **Persistence**: 
    - Completed scans are sent to `POST /api/save-scan`.
    - Data is written to `.scan_history/` or Supabase `scan_history` table.

## 3. Core Components

### 3.1 Scanner Engine (`src/lib/scanner.ts`)
The heart of the application. It implements a breadth-first search (BFS) crawler with the following characteristics:

*   **Normalization**:
    *   Resolves relative URLs against the base URL.
    *   Strips fragments (`#hash`).
    *   Ignores non-HTTP protocols (`mailto:`, `tel:`, `javascript:`).
*   **Concurrency**:
    *   Uses `p-limit` to restrict the number of simultaneous HTTP requests (default: 10).
*   **Politeness**:
    *   `visitedLinks` Set prevents processing the same URL twice.
    *   `queuedLinks` Set prevents double-queueing.
*   **Exclusion Logic**:
    *   **CSS Selectors**: 
        *   Parses HTML with `cheerio`.
        *   Finds elements matching selectors (e.g., `.footer`).
        *   Marks links inside them as `skipped`.
        *   **Force Exclude**: If enabled, adds these URLs to `visitedLinks` to prevent them from being scanned even if found elsewhere.
    *   **Wildcards**: Custom matcher supports `*` (any string) and `?` (single char).
    *   **Regex**: Standard JS RegExp matching.
    *   **Domain Filtering**:
        *   `skipExternalDomains`: If true, external links are recorded as `status: 'external'` but not followed/fetched.
        *   `excludeSubdomains`: Checks if hostname is a subdomain of the root (e.g., `blog.example.com` vs `example.com`).

### 3.2 API Endpoints (`src/app/api/`)

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| `/api/scan` | POST | Triggers a new scan. Accepts `url`, `config`, `auth`. Returns `ScanResult[]`. |
| `/api/save-scan` | POST | Saves scan results. Generates ID: `scan_<timestamp>_<hex>`. |
| `/api/history` | GET | Returns list of scan summaries (omits full `results` array for performance). |
| `/api/history/[id]` | GET | Returns full details of a specific scan. |
| `/api/recheck` | POST | Re-validates a specific URL from a past scan. |
| `/api/settings` | GET/POST | Manages storage preference (`file` vs `supabase`). |

### 3.3 Frontend Components

*   **`ScannerContent`** (`src/app/scan/page.tsx`):
    *   Main state machine: `initializing` -> `running` -> `completed` | `error`.
    *   Handles the "Confirm Scan" dialog and parameter editing.
    *   Auto-saves results upon completion.
*   **`ScanResults`** (`src/components/ScanResults.tsx`):
    *   Displays results in tabs: All, Problematic, OK, External, Skipped.
    *   Implements client-side pagination.
    *   **HTML Context**: Cleans and renders the HTML snippet where the link was found.
    *   **Re-check**: Allows individual link re-validation without re-scanning the whole site.
*   **`JSONPreview`**: Utility to view/edit the raw configuration JSON.

## 4. Data Models

### 4.1 Scan Configuration (`ScanConfig`)
```typescript
interface ScanConfig {
  depth?: number;              // 0 = current page, >0 = recursive depth
  concurrency?: number;        // Max simultaneous requests
  requestTimeout?: number;     // Timeout in ms
  scanSameLinkOnce?: boolean;  // Deduplication flag
  skipExternalDomains?: boolean;
  excludeSubdomains?: boolean;
  processHtml?: boolean;       // Whether to parse HTML for more links
  regexExclusions?: string[];  // Array of regex patterns
  wildcardExclusions?: string[]; // Array of wildcard patterns
  cssSelectors?: string[];     // Array of CSS selectors to ignore
  cssSelectorsForceExclude?: boolean; // Global exclusion for CSS matches
  auth?: {                     // HTTP Basic Auth
    username: string;
    password: string;
  };
  useAuthForAllDomains?: boolean;
}
```

### 4.2 Scan Result (`ScanResult`)
```typescript
interface ScanResult {
  url: string;
  status: 'ok' | 'broken' | 'skipped' | 'error' | 'external';
  statusCode?: number;         // HTTP Status (e.g., 200, 404)
  errorMessage?: string;       // For network errors/timeouts
  contentType?: string;
  foundOn: Set<string>;        // Pages where this link was found
  htmlContexts?: Map<string, string[]>; // HTML snippets per page
  usedAuth?: boolean;          // If auth was used for this request
}
```

## 5. Storage Schema

### 5.1 File System
*   **Location**: `.scan_history/`
*   **Format**: JSON files named `<scan_id>.json`.
*   **Structure**: Contains the full `SavedScan` object (Config + Results).

### 5.2 Supabase
*   **Table**: `scan_history`
*   **Columns**:
    *   `id` (text, PK)
    *   `scan_url` (text)
    *   `scan_date` (timestamp)
    *   `duration_seconds` (numeric)
    *   `config` (jsonb)
    *   `results` (jsonb)

## 6. Error Handling

*   **Scanner Level**:
    *   **Timeouts**: Caught and marked as `status: 'broken'`, `errorMessage: 'Request timed out...'`.
    *   **Network Errors**: Caught and marked as `status: 'error'`.
    *   **Invalid URLs**: Logged and skipped.
*   **API Level**:
    *   Returns 504 for timeouts.
    *   Returns 502 for bad gateway (connection failures).
    *   Returns 500 for internal logic errors.
*   **Frontend Level**:
    *   Displays user-friendly error alerts.
    *   Retains partial progress if possible (though currently scan is atomic).

## 7. Limits & Constraints
*   **Max Concurrency**: 50 (Frontend validation).
*   **Max Timeout**: 180 seconds (Frontend validation).
*   **API Timeout**: Next.js default (usually 10-60s depending on hosting), but the `scan` endpoint sets a custom 10-minute timeout signal.
