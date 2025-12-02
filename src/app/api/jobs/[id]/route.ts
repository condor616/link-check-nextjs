import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const job = await jobService.getJob(id);

        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error: any) {
        console.error('Error fetching job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch job' },
            { status: 500 }
        );
    }
}
