import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isUsingSupabase, getSupabaseClient } from '@/lib/supabase';
import { getAppSettings } from '@/lib/settings';

export async function GET() {
    try {
        const useSupabase = await isUsingSupabase();
        const settings = await getAppSettings();

        if (useSupabase) {
            const supabase = await getSupabaseClient();
            if (!supabase) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase credentials missing',
                    storageType: 'supabase'
                });
            }

            // Check if tables exist
            const { error } = await supabase.from('scan_history').select('id').limit(1);
            if (error && (error.message.includes('does not exist') || error.message.includes('schema cache'))) {
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Supabase tables not initialized',
                    storageType: 'supabase'
                });
            }

            if (error) {
                return NextResponse.json({
                    isSetup: false,
                    reason: `Supabase connection error: ${error.message}`,
                    storageType: 'supabase'
                });
            }

            return NextResponse.json({ isSetup: true, storageType: 'supabase' });
        } else {
            // Local SQLite check
            try {
                await prisma.scanHistory.count();
                return NextResponse.json({ isSetup: true, storageType: 'sqlite' });
            } catch (error: any) {
                // If table doesn't exist, it's not setup
                return NextResponse.json({
                    isSetup: false,
                    reason: 'Local database tables not initialized',
                    storageType: 'sqlite'
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
