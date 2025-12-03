import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';

// Helper function to serialize results for JSON (same as in scan/route.ts)
function serializeResults(results: any[]): any[] {
    if (!results) return [];
    return results.map(r => ({
        ...r,
        foundOn: r.foundOn instanceof Set ? Array.from(r.foundOn) : r.foundOn,
        htmlContexts: r.htmlContexts instanceof Map ? Object.fromEntries(r.htmlContexts) : r.htmlContexts
    }));
}

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

        // Serialize results if present to ensure Sets/Maps are converted for JSON
        if (job.results) {
            job.results = serializeResults(job.results);
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
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;
        const body = await request.json();
        const { action } = body;

        if (!action) {
            return NextResponse.json({ error: 'Action is required' }, { status: 400 });
        }

        const job = await jobService.getJob(id);
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        switch (action) {
            case 'pause':
                await jobService.pauseJob(id);
                break;
            case 'resume':
                await jobService.resumeJob(id);
                break;
            case 'stop':
                await jobService.stopJob(id);
                break;
            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error updating job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to update job' },
            { status: 500 }
        );
    }
}
