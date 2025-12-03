import crypto from 'crypto';
import { ScanConfig, ScanResult } from '@/lib/scanner';
import { getSupabaseClient, isUsingSupabase } from '@/lib/supabase';
import { prisma } from './prisma';

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

export class HistoryService {
    async saveScan(payload: SaveScanPayload, id?: string): Promise<string> {
        // Generate unique ID if not provided
        let scanId = id;
        if (!scanId) {
            const timestamp = new Date(payload.scanDate).getTime();
            const uniquePart = crypto.randomBytes(4).toString('hex'); // 8 hex characters
            scanId = `scan_${timestamp}_${uniquePart}`;
        }

        // Serialize results to ensure Sets and Maps are converted to JSON-compatible formats
        const serializedResults = payload.results.map(r => ({
            ...r,
            foundOn: Array.from(r.foundOn || []),
            htmlContexts: r.htmlContexts ? Object.fromEntries(r.htmlContexts) : undefined
        }));

        const savedData: SavedScan = {
            id: scanId,
            ...payload,
            results: serializedResults as any // Cast to any to match ScanResult[] interface which expects Set/Map
        };

        // Check if using Supabase
        const useSupabase = await isUsingSupabase();

        if (useSupabase) {
            await this.saveScanToSupabase(savedData);
        } else {
            await this.saveScanToPrisma(savedData);
        }

        return scanId;
    }

    // Save scan data to Prisma (SQLite)
    private async saveScanToPrisma(savedData: SavedScan) {
        try {
            await prisma.scanHistory.create({
                data: {
                    id: savedData.id,
                    scan_url: savedData.scanUrl,
                    scan_date: new Date(savedData.scanDate),
                    duration_seconds: savedData.durationSeconds,
                    config: JSON.stringify(savedData.config),
                    results: JSON.stringify(savedData.results)
                }
            });

            console.log(`Scan saved successfully to Prisma: ${savedData.id}`);
        } catch (error) {
            console.error("Error saving scan to Prisma:", error);
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
