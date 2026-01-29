import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { isUsingSupabase, getSupabaseClient } from '@/lib/supabase';
import { getAppSettings } from '@/lib/settings';

export async function GET() {
    try {
        const useSupabase = await isUsingSupabase();
        const settings = await getAppSettings();

        const envDefaults = {
            storageType: process.env.STORAGE_TYPE || 'sqlite',
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || ''
        };

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase credentials missing',
                    storageType: 'supabase',
                    defaults: envDefaults
                });
            }

            // Check if tables exist
            const { error } = await supabase.from('scan_history').select('id').limit(1);
            if (error && (error.message.includes('does not exist') || error.message.includes('schema cache'))) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase tables not initialized',
                    storageType: 'supabase',
                    defaults: envDefaults
                });
            }

            if (error) {
                return NextResponse.json({
                    isSetup: false,
                    reason: `Supabase connection error: ${error.message}`,
                    storageType: 'supabase',
                    defaults: envDefaults
                });
            }

            return NextResponse.json({ isSetup: true, storageType: 'supabase', defaults: envDefaults });
        } else {
            // Local SQLite check
            try {
                // If we can count, it's definitely setup
                await prisma.scanHistory.count();
                return NextResponse.json({ isSetup: true, storageType: 'sqlite', defaults: envDefaults });
            } catch (error: any) {
                // If tables don't exist, it's NOT setup
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Local database tables not initialized',
                    storageType: 'sqlite',
                    defaults: envDefaults
                });
            }
        }
    } catch (error: any) {
        console.error('Setup status check error:', error);
        return NextResponse.json({
            isSetup: false,
            reason: error.message || 'Unknown error during setup check'
        });
    }
}
