# Background Processing Architecture for Link-Check Application

## Overview

This document describes implementing a background processing architecture for the Link-Check application to support long-running scans (1+ hours) without timeouts. The architecture allows users to:

1. Start a scan
2. Navigate away from the scan page
3. Return later to view scan progress or results
4. Support multiple concurrent scans with different priorities

### Current System Limitations

- Scans run within HTTP connections (timeout risks)
- User must stay on scan page for completion
- Limited visibility of scan progress after page navigation

### Architectural Goals

- Decouple scan execution from user session
- Support real-time progress updates
- Allow scans to continue running when user navigates away
- Maintain compatibility with existing scanning code
- Local deployment of all components except Supabase

## Architecture Components

```
┌─────────────────┐     ┌──────────────┐     ┌───────────────────┐
│                 │     │              │     │                   │
│  Next.js App    │────▶│  Redis Queue │────▶│  Worker Process   │
│  (Web UI)       │     │  (Bull)      │     │  (Node.js)        │
│                 │     │              │     │                   │
└────────┬────────┘     └──────────────┘     └──────────┬────────┘
         │                                               │
         │                                               │
         │                                               │
         │           ┌──────────────────────┐            │
         └──────────▶│                      │◀───────────┘
                     │  Supabase Database   │
                     │                      │
                     └──────────────────────┘
```

### 1. Next.js Application (Existing)
- Handles user interface and scan configuration
- Submits scan jobs to the queue
- Displays real-time scan progress and results
- Subscribes to changes in scan status via Supabase Realtime

### 2. Redis + Bull Queue (New)
- Manages scan job queue, priorities, and metadata
- Provides job scheduling, retries, and concurrency control
- Tracks job status and progress
- Self-hosted Redis instance (runs locally)

### 3. Worker Process (New)
- Separate Node.js application that consumes jobs from the queue
- Executes link scanning logic
- Updates scan progress and results in Supabase
- Can be scaled horizontally for higher throughput

### 4. Supabase Database (Existing)
- Stores scan configurations, results, and progress information
- Provides real-time updates via Supabase Realtime
- Remains as the external service (using free tier)

## Data Model Changes

### 1. Scan Jobs Table
```sql
CREATE TABLE scan_jobs (
  id UUID PRIMARY KEY,
  status VARCHAR(20) NOT NULL, -- 'queued', 'running', 'completed', 'failed'
  job_id VARCHAR(100), -- Bull queue job ID
  scan_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percent SMALLINT DEFAULT 0,
  current_url TEXT,
  urls_scanned INTEGER DEFAULT 0,
  total_urls INTEGER,
  scan_config JSONB NOT NULL,
  error TEXT
);

-- Add indexes
CREATE INDEX idx_scan_jobs_status ON scan_jobs(status);
CREATE INDEX idx_scan_jobs_created_at ON scan_jobs(created_at);
```

### 2. Scan Results Table (Existing, No Changes)
Continue using the existing scan results storage approach.

## Implementation Plan

### 1. Setup Redis and Bull Queue

#### Local Redis Installation
```bash
# Install Redis locally
sudo apt-get install redis-server  # Ubuntu/Debian
brew install redis                 # macOS

# Configure Redis to run on startup
sudo systemctl enable redis-server # Ubuntu/Debian

# Start Redis
sudo systemctl start redis-server  # Ubuntu/Debian
brew services start redis          # macOS
```

#### Queue Configuration (in worker application)
```javascript
// src/queue/index.js
import Queue from 'bull';

// Create scan queue
export const scanQueue = new Queue('link-scanning', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000
    },
    removeOnComplete: false,
    removeOnFail: false,
    timeout: 0 // No timeout for long-running jobs
  }
});

// Set up event handlers and logging
scanQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

scanQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error:`, err);
});

scanQueue.on('stalled', (job) => {
  console.warn(`Job ${job.id} stalled`);
});
```

### 2. Create Worker Application

Create a new Node.js application for the worker:

#### Project Structure
```
link-check-worker/
├── package.json
├── .env
├── src/
│   ├── index.js        # Main worker entry point
│   ├── queue/
│   │   └── index.js    # Queue configuration
│   ├── workers/
│   │   └── scanner.js  # Scan worker implementation
│   ├── services/
│   │   ├── supabase.js # Supabase client
│   │   └── scanner.js  # Scanner implementation
│   └── utils/
│       └── logger.js   # Logging utilities
└── README.md
```

#### Worker Implementation
```javascript
// src/workers/scanner.js
import { scanQueue } from '../queue/index.js';
import { supabase } from '../services/supabase.js';
import { scanUrl } from '../services/scanner.js';
import { logger } from '../utils/logger.js';

// Process jobs from the queue
scanQueue.process(async (job) => {
  logger.info(`Processing job ${job.id} - Scanning ${job.data.scanUrl}`);
  
  try {
    // Update job status in database
    await updateJobStatus(job.data.scanJobId, 'running');
    
    // Extract scan parameters from job
    const { scanUrl, scanJobId, scanConfig } = job.data;
    
    // Initialize scan
    const scanner = createScanner(scanUrl, scanConfig);
    
    // Set up progress tracking
    scanner.on('progress', async (data) => {
      // Update progress in Bull job
      await job.progress(data.progressPercent);
      
      // Update progress in database
      await updateJobProgress(scanJobId, data);
    });
    
    // Run the scan
    const results = await scanner.execute();
    
    // Save results to database
    await saveResults(scanJobId, results);
    
    // Mark job as completed
    await updateJobStatus(scanJobId, 'completed');
    
    return { completed: true, resultsCount: results.length };
  } catch (error) {
    logger.error(`Error processing job ${job.id}:`, error);
    
    // Update job status in database
    await updateJobStatus(job.data.scanJobId, 'failed', error.message);
    
    // Re-throw to mark job as failed in Bull
    throw error;
  }
});

// Helper functions
async function updateJobStatus(scanJobId, status, error = null) {
  const updateData = {
    status,
    ...(status === 'running' ? { started_at: new Date() } : {}),
    ...(status === 'completed' ? { completed_at: new Date() } : {}),
    ...(error ? { error } : {})
  };
  
  const { error: dbError } = await supabase
    .from('scan_jobs')
    .update(updateData)
    .eq('id', scanJobId);
    
  if (dbError) {
    logger.error(`Failed to update job status: ${dbError.message}`);
  }
}

async function updateJobProgress(scanJobId, progressData) {
  const { progressPercent, currentUrl, urlsScanned, totalUrls } = progressData;
  
  const { error } = await supabase
    .from('scan_jobs')
    .update({
      progress_percent: progressPercent,
      current_url: currentUrl,
      urls_scanned: urlsScanned,
      total_urls: totalUrls
    })
    .eq('id', scanJobId);
    
  if (error) {
    logger.error(`Failed to update job progress: ${error.message}`);
  }
}

async function saveResults(scanJobId, results) {
  // Use existing results saving logic
  // This may involve saving to scan_history or another table
}
```

#### Scanner Service
Adapt your existing scanner code to support progress events:

```javascript
// src/services/scanner.js
import EventEmitter from 'events';

export function createScanner(url, config) {
  const scanner = new ScannerEmitter(url, config);
  return scanner;
}

class ScannerEmitter extends EventEmitter {
  constructor(url, config) {
    super();
    this.url = url;
    this.config = config;
    this.results = [];
    this.urlsToScan = new Set([url]);
    this.scannedUrls = new Set();
    this.inProgress = new Set();
  }
  
  async execute() {
    // Initialize counters
    let totalDiscovered = 1; // Start with 1 for the initial URL
    let scannedCount = 0;
    
    // Keep scanning until we've processed all URLs or reached depth limit
    while (this.urlsToScan.size > 0) {
      // Get next batch of URLs to scan based on concurrency
      const batchSize = this.config.concurrency || 5;
      const batch = this.getBatch(batchSize);
      
      // Mark URLs as in progress
      batch.forEach(url => {
        this.inProgress.add(url);
        this.urlsToScan.delete(url);
      });
      
      // Scan URLs in parallel
      const promises = batch.map(url => this.scanSingleUrl(url));
      const batchResults = await Promise.all(promises);
      
      // Process results and add new URLs to scan
      batchResults.forEach((result, index) => {
        const url = batch[index];
        
        // Add result to results array
        this.results.push(result);
        
        // Mark URL as scanned
        this.scannedUrls.add(url);
        this.inProgress.delete(url);
        scannedCount++;
        
        // Add new URLs to scan if within depth limit
        if (result.depth < this.config.depth) {
          result.links.forEach(link => {
            if (!this.scannedUrls.has(link) && 
                !this.inProgress.has(link) && 
                !this.urlsToScan.has(link)) {
              this.urlsToScan.add(link);
              totalDiscovered++;
            }
          });
        }
      });
      
      // Emit progress event
      this.emit('progress', {
        progressPercent: Math.floor((scannedCount / totalDiscovered) * 100),
        currentUrl: batch[batch.length - 1],
        urlsScanned: scannedCount,
        totalUrls: totalDiscovered
      });
    }
    
    // Return all results
    return this.results;
  }
  
  getBatch(size) {
    const batch = [];
    const iterator = this.urlsToScan.values();
    
    for (let i = 0; i < size && i < this.urlsToScan.size; i++) {
      batch.push(iterator.next().value);
    }
    
    return batch;
  }
  
  async scanSingleUrl(url) {
    // Implement your existing URL scanning logic here
    // ...
  }
}
```

### 3. Next.js Application Changes

#### Job Submission
```javascript
// src/app/scan/page.tsx
import { v4 as uuidv4 } from 'uuid';
import { scanQueue } from '@/lib/queue';

// ...existing code...

const startScan = async (url, config) => {
  try {
    setIsScanning(true);
    
    // Generate a unique scan job ID
    const scanJobId = uuidv4();
    
    // Create job in database
    const { data, error } = await supabase
      .from('scan_jobs')
      .insert({
        id: scanJobId,
        status: 'queued',
        scan_url: url,
        scan_config: config,
        created_at: new Date()
      })
      .select();
      
    if (error) {
      throw new Error(`Failed to create scan job: ${error.message}`);
    }
    
    // Add job to queue
    const job = await scanQueue.add({
      scanUrl: url,
      scanJobId,
      scanConfig: config
    }, {
      priority: 1,
      jobId: scanJobId
    });
    
    // Redirect to job status page
    router.push(`/history/${scanJobId}`);
  } catch (error) {
    console.error('Failed to start scan:', error);
    toast.error('Failed to start scan');
    setIsScanning(false);
  }
};
```

#### Queue Client
```javascript
// src/lib/queue.js
import Queue from 'bull';

// Use only for adding jobs in the web app
export const scanQueue = new Queue('link-scanning', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined
  }
});
```

#### Progress Tracking Page
```jsx
// src/app/history/[scanId]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button, Card, Progress, Alert } from '@/components/ui';

export default function ScanProgressPage() {
  const params = useParams();
  const router = useRouter();
  const scanId = params.scanId;
  
  const [scan, setScan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Fetch initial scan data
  useEffect(() => {
    const fetchScanJob = async () => {
      try {
        const { data, error } = await supabase
          .from('scan_jobs')
          .select('*')
          .eq('id', scanId)
          .single();
          
        if (error) {
          throw error;
        }
        
        setScan(data);
      } catch (err) {
        console.error('Error fetching scan:', err);
        setError('Failed to load scan data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchScanJob();
  }, [scanId]);
  
  // Subscribe to real-time updates
  useEffect(() => {
    if (!scanId) return;
    
    const subscription = supabase
      .channel(`scan-job-${scanId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'scan_jobs',
        filter: `id=eq.${scanId}`
      }, (payload) => {
        setScan(payload.new);
      })
      .subscribe();
      
    return () => {
      subscription.unsubscribe();
    };
  }, [scanId]);
  
  if (loading) {
    return <div>Loading scan information...</div>;
  }
  
  if (error) {
    return <Alert variant="destructive">{error}</Alert>;
  }
  
  if (!scan) {
    return <Alert>Scan not found</Alert>;
  }
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Scan Progress</h1>
      
      <Card className="mb-4 p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">URL: {scan.scan_url}</h2>
          <p className="text-muted-foreground">
            Status: <span className="font-medium">{scan.status}</span>
          </p>
        </div>
        
        {scan.status === 'running' && (
          <>
            <Progress value={scan.progress_percent || 0} max={100} className="mb-2" />
            <p className="text-sm text-muted-foreground">
              {scan.progress_percent || 0}% Complete
            </p>
            <p className="text-sm text-muted-foreground">
              Currently scanning: {scan.current_url || 'N/A'}
            </p>
            <p className="text-sm text-muted-foreground">
              URLs Scanned: {scan.urls_scanned || 0} / {scan.total_urls || '?'}
            </p>
          </>
        )}
        
        {scan.status === 'completed' && (
          <Button onClick={() => router.push(`/scan-results/${scan.id}`)}>
            View Results
          </Button>
        )}
        
        {scan.status === 'failed' && (
          <Alert variant="destructive">
            Scan failed: {scan.error || 'Unknown error'}
          </Alert>
        )}
        
        {scan.status === 'queued' && (
          <div>
            <p>Scan is queued and will start soon...</p>
            <Progress value={0} max={100} className="mt-2" />
          </div>
        )}
      </Card>
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.push('/scan')}>
          New Scan
        </Button>
        <Button variant="outline" onClick={() => router.push('/history')}>
          Back to History
        </Button>
      </div>
    </div>
  );
}
```

### 4. History Page Updates

Update the history page to show job status and in-progress scans:

```jsx
// src/app/history/page.tsx
// Modify existing fetchScans function to get scan_jobs data

const fetchScans = async () => {
  setIsLoading(true);
  
  try {
    // Get active jobs from scan_jobs table
    const { data: activeJobs, error: activeJobsError } = await supabase
      .from('scan_jobs')
      .select('*')
      .in('status', ['queued', 'running'])
      .order('created_at', { ascending: false });
      
    if (activeJobsError) {
      throw activeJobsError;
    }
    
    // Get completed jobs (from existing scan_history or scan_jobs)
    const { data: completedScans, error: completedScansError } = await supabase
      .from('scan_history') // Or 'scan_jobs' with status='completed'
      .select('*')
      .order('scan_date', { ascending: false });
      
    if (completedScansError) {
      throw completedScansError;
    }
    
    // Combine active jobs and completed scans
    const allScans = [
      ...activeJobs.map(job => ({
        id: job.id,
        scanUrl: job.scan_url,
        scanDate: job.created_at,
        status: job.status,
        durationSeconds: job.completed_at 
          ? (new Date(job.completed_at) - new Date(job.started_at)) / 1000 
          : null,
        progress: job.progress_percent || 0,
        // Other fields as needed
      })),
      ...completedScans.map(scan => ({
        // Map existing scan data structure
        // ...
      }))
    ];
    
    setScans(allScans);
  } catch (error) {
    console.error('Error fetching scans:', error);
    toast.error('Failed to fetch scan history');
  } finally {
    setIsLoading(false);
  }
};
```

## Deployment

### 1. Local Redis Setup
```bash
# Start Redis server
redis-server --daemonize yes
```

### 2. Worker Process Deployment
```bash
# Install dependencies
cd link-check-worker
npm install

# Start worker process
npm start

# For production with PM2
npm install -g pm2
pm2 start src/index.js --name link-check-worker
pm2 save
```

### 3. Production Considerations
- Use PM2 for process management and auto-restart
- Set up health checks for the worker process
- Configure logging to file for debugging
- Consider adding a dashboard for queue monitoring (Bull Board)

## Migration Strategy

1. Create the new `scan_jobs` table in Supabase
2. Implement the worker application
3. Modify the Next.js app to use the queue for new scans
4. Test with increasing concurrency and depth limits
5. Add monitoring and alerting for worker process

## Scaling Considerations

- Run multiple worker processes for higher throughput
- Shard the queue by domain or other criteria if needed
- Add rate limiting to prevent overloading target websites
- Implement job prioritization based on user tier/needs

## Conclusion

This architecture significantly improves the link checking application by:

1. Eliminating HTTP timeout concerns
2. Supporting background processing regardless of user actions
3. Enabling real-time progress tracking across browser sessions
4. Maintaining compatibility with the existing application structure
5. Using self-hosted components where possible (Redis, worker)

The implementation uses established patterns (queue/worker) with reliable technologies (Bull, Redis, Node.js) while leveraging Supabase for data persistence and real-time updates. 