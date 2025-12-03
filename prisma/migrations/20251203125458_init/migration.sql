-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "scan_url" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "progress_percent" REAL NOT NULL DEFAULT 0,
    "current_url" TEXT,
    "urls_scanned" INTEGER NOT NULL DEFAULT 0,
    "total_urls" INTEGER NOT NULL DEFAULT 0,
    "scan_config" TEXT NOT NULL,
    "error" TEXT,
    "results" TEXT,
    "state" TEXT
);

-- CreateTable
CREATE TABLE "ScanHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scan_url" TEXT NOT NULL,
    "scan_date" DATETIME NOT NULL,
    "duration_seconds" REAL NOT NULL,
    "config" TEXT NOT NULL,
    "results" TEXT NOT NULL
);
