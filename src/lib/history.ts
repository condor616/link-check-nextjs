import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';

// Define the expected structure for saving
export interface SaveScanPayload {
    scanUrl: string;
    scanDate: string; // ISO string
    durationSeconds: number;
    config: ScanConfig;
    results: ScanResult[];
}

// Define the structure of the saved file
export interface SavedScan extends SaveScanPayload {
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

export class HistoryService {
    async saveScan(payload: SaveScanPayload, id?: string): Promise<string> {
        // Generate unique ID if not provided
        let scanId = id;
        if (!scanId) {
            const timestamp = new Date(payload.scanDate).getTime();
            const uniquePart = crypto.randomBytes(4).toString('hex'); // 8 hex characters
            scanId = `scan_${timestamp}_${uniquePart}`;
        }

        const savedData: SavedScan = {
            id: scanId,
            ...payload,
        };

        // Check if using Supabase
        const useSupabase = await isUsingSupabase();

        if (useSupabase) {
            await this.saveScanToSupabase(savedData);
        } else {
            await this.saveScanToFile(savedData);
        }

        return scanId;
    }

    // Save scan data to file
    private async saveScanToFile(savedData: SavedScan) {
        try {
            await ensureHistoryDir();

            const filePath = path.join(historyDir, `${savedData.id}.json`);

            // Save the data as JSON
            await fs.writeFile(filePath, JSON.stringify(savedData, null, 2));

            console.log(`Scan saved successfully to file: ${savedData.id}`);
        } catch (error) {
            console.error("Error saving scan to file:", error);
            throw error;
        }
    }

    // Save scan data to Supabase
    private async saveScanToSupabase(savedData: SavedScan) {
        try {
            const supabase = await getSupabaseClient();

            if (!supabase) {
                throw new Error('Supabase client is not available');
            }

            // Insert scan data into database
            // Insert scan data into database
            const { error } = await (supabase
                .from('scan_history') as any)
                .insert({
                    id: savedData.id,
                    scan_url: savedData.scanUrl,
                    scan_date: savedData.scanDate,
                    duration_seconds: savedData.durationSeconds,
                    config: savedData.config,
                    results: savedData.results
                });

            if (error) {
                throw new Error(`Supabase error: ${error.message}`);
            }

            console.log(`Scan saved successfully to Supabase: ${savedData.id}`);
        } catch (error) {
            console.error("Error saving scan to Supabase:", error);
            throw error;
        }
    }
}

export const historyService = new HistoryService();
