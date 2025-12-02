# Link Checker Pro - Technical Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Technology Stack](#technology-stack)
4. [Core Components](#core-components)
5. [Data Flow](#data-flow)
6. [API Architecture](#api-architecture)
7. [Storage Layer](#storage-layer)
8. [Scanner Engine](#scanner-engine)
9. [Component Structure](#component-structure)
10. [State Management](#state-management)
11. [Deployment Architecture](#deployment-architecture)

---

## System Overview

Link Checker Pro is a **server-side rendered (SSR) Next.js application** that performs web crawling and link validation. The architecture follows a **client-server model** with the following characteristics:

- **Frontend**: React-based UI with TypeScript
- **Backend**: Next.js API Routes handling scan logic
- **Storage**: Dual-mode (File-based or Supabase)
- **Rendering**: Server-side rendering with client-side hydration
- **Deployment**: Docker-ready with environment-based configuration

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Home   │  │   Scan   │  │ History  │  │ Settings │   │
│  │   Page   │  │   Page   │  │   Page   │  │   Page   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         │              │              │              │       │
│         └──────────────┴──────────────┴──────────────┘       │
│                          │                                    │
│                    React Components                          │
│                    (Client-Side State)                       │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP/REST
┌─────────────────────────▼───────────────────────────────────┐
│                    Next.js Server Layer                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              API Routes (Backend)                      │ │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐   │ │
│  │  │ Scan │  │Config│  │History│  │Settings│  │Supabase│   │ │
│  │  │  API │  │  API │  │  API  │  │  API   │  │  API   │   │ │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Core Business Logic                       │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐            │ │
│  │  │ Scanner  │  │ Storage  │  │ Supabase │            │ │
│  │  │  Engine  │  │ Manager  │  │  Client  │            │ │
│  │  └──────────┘  └──────────┘  └──────────┘            │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    Storage Layer                             │
│  ┌────────────────────┐         ┌────────────────────┐     │
│  │  File-Based        │   OR    │  Supabase          │     │
│  │  Storage           │         │  PostgreSQL        │     │
│  │  ┌──────────────┐ │         │  ┌──────────────┐  │     │
│  │  │.scan_configs │ │         │  │scan_configs  │  │     │
│  │  │.scan_history │ │         │  │scan_history  │  │     │
│  │  │.scan_params  │ │         │  │scan_params   │  │     │
│  │  └──────────────┘ │         │  └──────────────┘  │     │
│  └────────────────────┘         └────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 15.3.1 | React framework with SSR/SSG |
| **React** | 19.0.0 | UI library |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **Radix UI** | Various | Accessible component primitives |
| **Framer Motion** | 12.9.4 | Animation library |
| **next-themes** | 0.4.6 | Dark mode support |
| **Sonner** | 2.0.3 | Toast notifications |

### Backend Technologies

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime environment |
| **Cheerio** | 1.0.0 | HTML parsing and traversal |
| **p-limit** | 6.2.0 | Concurrency control |
| **@supabase/supabase-js** | 2.49.4 | Supabase client |

### Development Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **PostCSS** | CSS processing |
| **Docker** | Containerization |
| **Git** | Version control |

---

## Core Components

### 1. Scanner Engine (`/src/lib/scanner.ts`)

**Purpose**: Core link validation and web crawling logic

**Key Interfaces**:

```typescript
interface ScanConfig {
  maxDepth?: number;           // Default: 2
  concurrency?: number;        // Default: 5
  timeout?: number;            // Default: 30000ms
  excludePatterns?: string[];  // Regex patterns
  cssExclusions?: string[];    // CSS selectors
  auth?: {
    username: string;
    password: string;
  };
}

interface ScanResult {
  url: string;
  status: 'ok' | 'broken' | 'external' | 'skipped';
  statusCode?: number;
  error?: string;
  foundOn: Set<string>;
  depth: number;
  isExternal: boolean;
  htmlContexts?: Map<string, string>;
}
```

**Main Function**:
```typescript
async function scanWebsite(
  startUrl: string, 
  config: ScanConfig = {}
): Promise<ScanResult[]>
```

**Features**:
- Concurrent request handling with p-limit
- URL deduplication
- Depth-based crawling
- Regex and CSS exclusion filtering
- HTTP authentication support
- Error handling and timeout management
- HTML parsing with Cheerio

### 2. Storage Manager (`/src/lib/supabase.ts`)

**Purpose**: Abstraction layer for data persistence

**Key Functions**:

```typescript
async function getSupabaseClient(): Promise<SupabaseClient | null>
async function isUsingSupabase(): Promise<boolean>
```

**Storage Modes**:
1. **File-Based**: JSON files in `.scan_*` directories
2. **Supabase**: PostgreSQL database via Supabase client

**Data Types Stored**:
- Scan configurations
- Scan history/results
- Scan parameters
- Application settings

### 3. UI Components (`/src/components/`)

**Component Hierarchy**:

```
src/components/
├── ui/                      # Radix UI wrappers
│   ├── button.tsx
│   ├── input.tsx
│   ├── dialog.tsx
│   ├── select.tsx
│   ├── tabs.tsx
│   └── ... (19 components)
├── AnimatedButton.tsx       # Framer Motion button
├── AnimatedCard.tsx         # Framer Motion card
├── ExportScanButton.tsx     # Export functionality
├── JSONPreview.tsx          # JSON viewer
├── NotificationContext.tsx  # Toast notifications
├── PageTransition.tsx       # Page animations
├── ScanResults.tsx          # Results display (66KB - largest component)
└── TransitionLink.tsx       # Animated navigation
```

**Key Component**: `ScanResults.tsx`
- Displays scan results with filtering
- Handles export functionality
- Manages result state
- Implements pagination (if needed)
- Provides status-based filtering

---

## Data Flow

### Scan Execution Flow

```
1. User Input (Scan Page)
   └─> User enters URL and configuration
   
2. Client-Side Validation
   └─> Form validation with React state
   
3. API Request
   └─> POST /api/scan with config
   
4. Server-Side Processing
   ├─> Validate request body
   ├─> Initialize scanner engine
   ├─> Execute scanWebsite()
   │   ├─> Fetch start URL
   │   ├─> Parse HTML with Cheerio
   │   ├─> Extract links
   │   ├─> Filter by exclusions
   │   ├─> Queue URLs for crawling
   │   ├─> Process with concurrency limit
   │   └─> Collect results
   └─> Return results to client
   
5. Client-Side Processing
   ├─> Display results
   ├─> Auto-save to history
   └─> Enable export options
   
6. Storage
   └─> Save to file system or Supabase
```

### Configuration Load Flow

```
1. User Action (Load Scan)
   └─> Click "Load Scan" button
   
2. API Request
   └─> GET /api/saved-configs
   
3. Server-Side Processing
   ├─> Check storage mode (file vs Supabase)
   ├─> Read from appropriate storage
   └─> Return configuration list
   
4. Client-Side Display
   ├─> Show dialog with configurations
   └─> User selects configuration
   
5. Form Population
   └─> Populate scan form with selected config
```

---

## API Architecture

### API Route Structure

```
src/app/api/
├── scan/
│   └── route.ts              # POST: Execute scan
├── last-scan/
│   └── route.ts              # GET: Retrieve last scan
├── recheck/
│   └── route.ts              # POST: Re-scan URLs
├── saved-configs/
│   ├── route.ts              # GET: List configs
│   └── [id]/
│       └── route.ts          # DELETE: Remove config
├── save-scan/
│   └── route.ts              # POST: Save configuration
├── delete-scan/
│   └── route.ts              # DELETE: Remove scan
├── scan-params/
│   └── route.ts              # GET: Get parameters
├── save-scan-params/
│   └── route.ts              # POST: Save parameters
├── history/
│   ├── route.ts              # GET: List all scans
│   └── [scanId]/
│       └── route.ts          # GET: Get scan details
├── settings/
│   └── route.ts              # GET/POST: App settings
└── supabase/
    ├── setup-sql/
    │   └── route.ts          # POST: Initialize schema
    ├── check-table/
    │   └── route.ts          # GET: Verify connection
    ├── clear-data/
    │   └── route.ts          # POST: Clear data
    └── delete-tables/
        └── route.ts          # DELETE: Remove tables
```

### API Request/Response Examples

#### POST /api/scan

**Request**:
```json
{
  "url": "https://example.com",
  "config": {
    "maxDepth": 2,
    "concurrency": 5,
    "timeout": 30000,
    "excludePatterns": ["\/assets\/.*\\.pdf$"],
    "cssExclusions": [".footer"]
  },
  "auth": {
    "username": "user",
    "password": "pass"
  }
}
```

**Response**:
```json
{
  "message": "Scan completed successfully",
  "durationSeconds": 12.45,
  "resultsCount": 47,
  "status": "completed",
  "results": [
    {
      "url": "https://example.com/page1",
      "status": "ok",
      "statusCode": 200,
      "foundOn": ["https://example.com"],
      "depth": 1,
      "isExternal": false
    },
    // ... more results
  ]
}
```

---

## Storage Layer

### File-Based Storage

**Directory Structure**:
```
project-root/
├── .scan_configs/
│   ├── config_1701234567890_abc123.json
│   └── config_1701234567891_def456.json
├── .scan_history/
│   ├── scan_1701234567890_abc123.json
│   └── scan_1701234567891_def456.json
├── .scan_params/
│   └── params.json
└── .app_settings.json
```

**File Format Example** (`.scan_history/scan_*.json`):
```json
{
  "scanId": "scan_1701234567890_abc123",
  "url": "https://example.com",
  "timestamp": 1701234567890,
  "config": {
    "maxDepth": 2,
    "concurrency": 5
  },
  "results": [
    {
      "url": "https://example.com/page1",
      "status": "ok",
      "statusCode": 200
    }
  ],
  "durationSeconds": 12.45,
  "resultsCount": 47
}
```

### Supabase Storage

**Database Schema**:

```sql
-- Scan Configurations Table
CREATE TABLE scan_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scan History Table
CREATE TABLE scan_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  scan_id TEXT UNIQUE NOT NULL,
  url TEXT NOT NULL,
  config JSONB,
  results JSONB NOT NULL,
  duration_seconds FLOAT,
  results_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Scan Parameters Table
CREATE TABLE scan_params (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  params JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Advantages**:
- Cloud-based persistence
- Multi-user support potential
- Scalable storage
- Query capabilities
- Backup and recovery

---

## Scanner Engine

### Crawling Algorithm

```
1. Initialize
   ├─> Create URL queue with start URL
   ├─> Initialize visited set
   └─> Set up concurrency limiter

2. Process Queue
   WHILE queue not empty:
     ├─> Dequeue URL
     ├─> Check if visited
     ├─> Check depth limit
     ├─> Check exclusion patterns
     ├─> Fetch URL (with timeout)
     ├─> Parse HTML (if same domain)
     ├─> Extract links
     ├─> Filter links
     ├─> Add to queue
     └─> Record result

3. Return Results
   └─> Convert Map to Array
```

### Concurrency Control

Uses `p-limit` for controlled parallel requests:

```typescript
import pLimit from 'p-limit';

const limit = pLimit(config.concurrency || 5);

const promises = urls.map(url => 
  limit(() => fetchAndProcess(url))
);

await Promise.all(promises);
```

### Error Handling

**Error Types**:
1. **Network Errors**: Connection failures, timeouts
2. **HTTP Errors**: 4xx, 5xx status codes
3. **Parse Errors**: Invalid HTML
4. **Configuration Errors**: Invalid regex, CSS selectors

**Error Recovery**:
- Individual URL failures don't stop the scan
- Errors recorded in results with details
- Graceful degradation for parsing issues

---

## Component Structure

### Page Components

#### `/src/app/page.tsx` (Home/Scan Page)

**State Management**:
```typescript
const [url, setUrl] = useState('');
const [scanDepth, setScanDepth] = useState(2);
const [concurrency, setConcurrency] = useState(5);
const [timeout, setTimeout] = useState(30);
const [regexExclusions, setRegexExclusions] = useState<string[]>([]);
const [cssExclusions, setCssExclusions] = useState<string[]>([]);
const [results, setResults] = useState<ScanResult[]>([]);
const [isScanning, setIsScanning] = useState(false);
```

**Key Functions**:
- `handleScan()`: Initiates scan via API
- `handleSaveScan()`: Saves configuration
- `addRegexExclusion()`: Manages exclusion patterns
- `fetchLastScan()`: Retrieves previous scan

#### `/src/app/history/page.tsx` (History List)

**Features**:
- Lists all historical scans
- Provides view/delete actions
- Supports filtering by date
- Pagination for large datasets

#### `/src/app/history/[scanId]/page.tsx` (Scan Details)

**Features**:
- Displays detailed scan results
- Implements result filtering
- Provides export functionality
- Shows scan metadata

---

## State Management

### Client-Side State

**React State Hooks**:
- `useState`: Local component state
- `useEffect`: Side effects and data fetching
- `useContext`: Notification system

**No Global State Management**:
- No Redux, Zustand, or similar
- State localized to components
- API calls for data synchronization

### Server-Side State

**Next.js Caching**:
- API routes are not cached by default
- Static pages cached at build time
- Dynamic routes rendered on-demand

---

## Deployment Architecture

### Docker Deployment

**Dockerfile Structure**:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

**Volume Mounts** (for persistence):
```bash
-v ./scan_history:/app/.scan_history
-v ./scan_configs:/app/.scan_configs
-v ./scan_params:/app/.scan_params
-v ./app_settings.json:/app/.app_settings.json
```

### Environment Variables

**Required for Supabase**:
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
```

**Optional**:
```
NODE_ENV=production
PORT=3000
```

### Production Considerations

1. **Performance**:
   - Server-side rendering for fast initial load
   - Code splitting with Next.js
   - Image optimization (if used)

2. **Security**:
   - Environment variable protection
   - API rate limiting (recommended)
   - Input validation on all endpoints

3. **Scalability**:
   - Horizontal scaling with load balancer
   - Supabase for distributed storage
   - Stateless API design

4. **Monitoring**:
   - Console logging for debugging
   - Error tracking (recommended: Sentry)
   - Performance monitoring (recommended: Vercel Analytics)

---

## Summary

Link Checker Pro employs a **modern, scalable architecture** with:

✅ **Clean separation of concerns** (UI, API, Business Logic, Storage)  
✅ **Flexible storage** (File-based or cloud)  
✅ **Type-safe codebase** (TypeScript throughout)  
✅ **Concurrent processing** (Controlled with p-limit)  
✅ **Docker-ready deployment** (Containerized for easy deployment)  
✅ **Extensible design** (Easy to add new features)  

The architecture supports both **local development** and **production deployment** with minimal configuration changes.
