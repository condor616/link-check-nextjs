import { NextRequest, NextResponse } from 'next/server';
import { historyService, SaveScanPayload } from '@/lib/history';

export async function POST(request: NextRequest) {
    try {
        const payload = await request.json() as SaveScanPayload;

        // Validate payload basic structure (add more specific checks as needed)
        if (!payload.scanUrl || !payload.scanDate || payload.durationSeconds == null || !payload.config || !payload.results) {
            return NextResponse.json({ error: 'Invalid payload for saving scan' }, { status: 400 });
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
