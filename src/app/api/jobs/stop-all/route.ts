import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';

export async function POST(request: NextRequest) {
    try {
        await jobService.stopAllJobs();
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error stopping all jobs:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to stop all jobs' },
            { status: 500 }
        );
    }
}
