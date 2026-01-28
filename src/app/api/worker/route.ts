import { NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';
import { processJob } from '@/lib/worker-core';

export const dynamic = 'force-dynamic';

export async function GET() {
    console.log('Serverless worker triggered...');

    try {
        const job = await jobService.getNextPendingJob();

        if (!job) {
            return NextResponse.json({ message: 'No pending jobs found.' });
        }

        console.log(`Picked up job ${job.id} for processing.`);

        // Start processing background-style (don't wait for full completion if possible, 
        // but Vercel functions might kill it if we don't await).
        // For serverless, we usually MUST await to ensure it runs to completion within the timeout.
        const results = await processJob(job);

        return NextResponse.json({
            message: 'Job processed successfully.',
            jobId: job.id,
            resultsCount: results?.length || 0
        });

    } catch (error: any) {
        console.error('Serverless worker error:', error);
        return NextResponse.json({
            error: 'Failed to process job.',
            details: error.message
        }, { status: 500 });
    }
}
