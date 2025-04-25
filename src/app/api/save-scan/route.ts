import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ScanConfig, ScanResult } from '@/lib/scanner'; // Use alias

// Define the expected structure for saving
interface SaveScanPayload {
    scanUrl: string;
    scanDate: string; // ISO string
    durationSeconds: number;
    config: ScanConfig;
    results: ScanResult[]; // Already serialized results from frontend
}

// Define the structure of the saved file
interface SavedScan extends SaveScanPayload {
    id: string;
}

const historyDir = path.join(process.cwd(), '.scan_history');

// Ensure history directory exists
async function ensureHistoryDir() {
    try {
        await fs.access(historyDir);
    } catch (_) {
        // Directory doesn't exist, create it
        await fs.mkdir(historyDir, { recursive: true });
    }
}

export async function POST(request: NextRequest) {
    try {
        await ensureHistoryDir();
        const payload = await request.json() as SaveScanPayload;

        // Validate payload basic structure (add more specific checks as needed)
        if (!payload.scanUrl || !payload.scanDate || payload.durationSeconds == null || !payload.config || !payload.results) {
            return NextResponse.json({ error: 'Invalid payload for saving scan' }, { status: 400 });
        }

        // Generate unique ID
        const timestamp = new Date(payload.scanDate).getTime();
        const uniquePart = crypto.randomBytes(4).toString('hex'); // 8 hex characters
        const scanId = `scan_${timestamp}_${uniquePart}`;

        const savedData: SavedScan = {
            id: scanId,
            ...payload,
        };

        const filePath = path.join(historyDir, `${scanId}.json`);

        // Save the data as JSON
        await fs.writeFile(filePath, JSON.stringify(savedData, null, 2));

        console.log(`Scan saved successfully: ${scanId}`);
        return NextResponse.json({ message: 'Scan saved successfully', scanId: scanId }, { status: 201 });

    } catch (error) {
        console.error("API Save Scan Error:", error);
        let errorMessage = 'Failed to save scan history';
        if (error instanceof SyntaxError) {
            errorMessage = 'Invalid JSON in request body';
        } else if (error instanceof Error) {
            errorMessage = error.message;
        }
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
} 