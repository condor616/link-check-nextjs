import { NextRequest, NextResponse } from 'next/server';
import { historyService, SaveScanPayload } from '@/lib/history';
import { getCurrentUser } from '@/lib/auth';
import { ensureUserInSupabase, isUsingSupabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
    try {
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await request.json() as SaveScanPayload;

        // Validate payload basic structure (add more specific checks as needed)
        if (!payload.scanUrl || !payload.scanDate || payload.durationSeconds == null || !payload.config || !payload.results) {
            return NextResponse.json({ error: 'Invalid payload for saving scan' }, { status: 400 });
        }

        // Add user ID to payload
        payload.userId = user.id;

        // Ensure user row exists in Supabase public.users before FK-referencing insert
        const useSupabase = await isUsingSupabase();
        if (useSupabase) {
            await ensureUserInSupabase(user);
        }

        const scanId = await historyService.saveScan(payload);

        return NextResponse.json({
            message: 'Scan saved successfully',
            scanId: scanId
        }, { status: 201 });

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
