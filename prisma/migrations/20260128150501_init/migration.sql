-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Job" (
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
    "broken_links" INTEGER NOT NULL DEFAULT 0,
    "total_links" INTEGER NOT NULL DEFAULT 0,
    "scan_config" TEXT NOT NULL,
    "error" TEXT,
    "results" TEXT,
    "state" TEXT
);
INSERT INTO "new_Job" ("completed_at", "created_at", "current_url", "error", "id", "progress_percent", "results", "scan_config", "scan_url", "started_at", "state", "status", "total_urls", "urls_scanned") SELECT "completed_at", "created_at", "current_url", "error", "id", "progress_percent", "results", "scan_config", "scan_url", "started_at", "state", "status", "total_urls", "urls_scanned" FROM "Job";
DROP TABLE "Job";
ALTER TABLE "new_Job" RENAME TO "Job";
CREATE TABLE "new_ScanHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scan_url" TEXT NOT NULL,
    "scan_date" DATETIME NOT NULL,
    "duration_seconds" REAL NOT NULL,
    "broken_links" INTEGER NOT NULL DEFAULT 0,
    "total_links" INTEGER NOT NULL DEFAULT 0,
    "config" TEXT NOT NULL,
    "results" TEXT NOT NULL
);
INSERT INTO "new_ScanHistory" ("config", "duration_seconds", "id", "results", "scan_date", "scan_url") SELECT "config", "duration_seconds", "id", "results", "scan_date", "scan_url" FROM "ScanHistory";
DROP TABLE "ScanHistory";
ALTER TABLE "new_ScanHistory" RENAME TO "ScanHistory";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
