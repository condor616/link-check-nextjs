# Link Checker Pro - Feature Documentation

## Overview
Link Checker Pro is a comprehensive web application designed to scan websites for broken links, analyze link health, and manage scan history. It offers advanced configuration options for crawling, exclusion rules, and authentication.

## Core Scanning Capabilities

### 1. Recursive Scanning
- **Depth Control**: Users can configure the crawl depth.
  - `0`: Scans only the single page provided.
  - `>0`: Follows links recursively up to the specified depth.
- **Cross-Domain Handling**:
  - **External Domains**: Option to skip scanning links that point to different domains (`skipExternalDomains`).
  - **Subdomains**: Option to exclude subdomains from the scan (`excludeSubdomains`).

### 2. Performance & Concurrency
- **Concurrency Control**: Configurable number of simultaneous requests (1-50) to balance speed and server load.
- **Request Timeout**: Adjustable timeout (5-180 seconds) for individual link checks to prevent hanging on slow responses.
- **Politeness**: "Check each link only once" optimization to avoid redundant requests.

### 3. Advanced Exclusion Rules
Users can precisely control which links are scanned using multiple methods:
- **Regex Exclusions**: Exclude URLs matching specific Regular Expression patterns (e.g., `\.pdf$`, `/api/`).
- **Wildcard Exclusions**: Simple pattern matching using `*` and `?` (e.g., `example.com/blog/*`).
- **CSS Selector Exclusions**:
  - Exclude links found within specific HTML elements (e.g., `.footer`, `#nav`, `[data-ignore]`).
  - **Force Exclude**: Option to globally exclude links found in these selectors, even if they appear elsewhere on the site.

### 4. Authentication
- **HTTP Basic Auth**: Supports scanning protected resources using username and password.
- **Scope Control**: Auth can be applied to:
  - Only the starting domain.
  - All domains encountered during the scan.

## Results & Analysis

### 1. Real-time Monitoring
- **Progress Dashboard**: Shows live updates of:
  - Processed vs. Total URLs.
  - Count of Broken, OK, External, and Skipped links.
  - Elapsed time.
  - Visual progress bar.

### 2. Comprehensive Link Status
Links are categorized into:
- **OK**: Valid links (Status 200).
- **Broken**: HTTP 4xx/5xx errors, timeouts, or network failures.
- **External**: Links to outside domains (when skipping is enabled).
- **Skipped**: Links matching exclusion rules or depth limits.

### 3. Detailed Context
For every link, the application provides:
- **Status Code**: Exact HTTP status (e.g., 404, 500).
- **Error Message**: specific error details for broken links.
- **Found On**: A list of all pages where the link was discovered.
- **HTML Context**: The actual HTML snippet surrounding the link (e.g., `<a href="...">Link Text</a>`), helping users locate it in the source code.

## History & Data Management

### 1. Scan History
- **Automatic Saving**: Completed scans are automatically saved.
- **History Dashboard**: View a list of past scans with summary metrics (Date, Duration, Broken Links count).
- **Detailed Reports**: Access full results for any historical scan.
- **Management**: Delete individual scan records.

### 2. Storage Options
- **Dual Storage Support**:
  - **File-based**: Stores scan data in local JSON files (default).
  - **Supabase**: Optional integration with Supabase (PostgreSQL) for scalable storage.
- **Settings Management**: UI to switch between storage backends.

### 3. Configuration Management
- **Saved Configs**: Users can save scan configurations (presets) for frequently scanned sites.
- **Re-scan**: Quickly re-run a past scan using its original configuration.

## User Interface (UI/UX)

### 1. Modern Design
- **Tech Stack**: Built with Next.js, Tailwind CSS, and Shadcn UI.
- **Responsive**: Fully responsive layout for desktop and mobile.
- **Visual Feedback**:
  - Toast notifications for actions (save, delete, error).
  - Loading spinners and animated transitions.
  - Color-coded status indicators (Green for OK, Red for Broken).

### 2. Interactive Tools
- **JSON Preview**: View the raw configuration object before scanning.
- **Help Tooltips**: Contextual help for complex features like Regex and CSS selectors.
- **Clipboard Actions**: Copy scan configurations or results.
