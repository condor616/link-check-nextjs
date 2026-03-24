import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { isUsingSupabase, getSupabaseClient } from '@/lib/supabase';
import { getAppSettings } from '@/lib/settings';
import { checkIsSetup } from '@/lib/setup';

export async function GET() {
    try {
        const useSupabase = await isUsingSupabase();
        const settings = await getAppSettings();

        const envDefaults = {
            storageType: process.env.STORAGE_TYPE || 'sqlite',
            supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
            supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '',
            supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        };

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase credentials missing',
                    storageType: 'supabase',
                    defaults: envDefaults,
                    hasAdmin: false
                });
            }

            // Check if tables exist
            const { error: tableError } = await supabase.from('users').select('id').limit(1);
            const tablesExist = !tableError || !(tableError.message.includes('does not exist') || tableError.message.includes('schema cache'));
            
            if (!tablesExist) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase tables not initialized',
                    storageType: 'supabase',
                    defaults: envDefaults,
                    hasAdmin: false
                });
            }

            const isSetup = await checkIsSetup();
            
            return NextResponse.json({ 
                isSetup, 
                storageType: 'supabase', 
                defaults: envDefaults,
                hasAdmin: isSetup
            });
        } else {
            // Local SQLite check
            try {
                const isSetup = await checkIsSetup();
                return NextResponse.json({ 
                    isSetup, 
                    storageType: 'sqlite', 
                    defaults: envDefaults,
                    hasAdmin: isSetup
                });
            } catch (error: any) {
                // If tables don't exist, it's NOT setup
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Local database tables not initialized',
                    storageType: 'sqlite',
                    defaults: envDefaults,
                    hasAdmin: false
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
