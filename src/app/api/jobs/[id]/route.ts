import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';

// Helper function to serialize results for JSON (same as in scan/route.ts)
function serializeResults(results: any[]): any[] {
    if (!results) return [];
    return results.map(r => ({
        ...r,
        foundOn: r.foundOn instanceof Set ? Array.from(r.foundOn) : r.foundOn
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
        if (job.results && job.results.length > 0) {
            job.results = serializeResults(job.results);
        } else if (job.status === 'completed' || job.status === 'failed' || job.status === 'stopped') {
            // If job is completed/final but has no results in the jobs table,
            // try to fetch them from the history table to maintain UI compatibility
            try {
                console.log(`Fetching results from history for completed job ${id}`);
                const historyResponse = await fetch(`${request.nextUrl.origin}/api/history/${id}`);
                if (historyResponse.ok) {
                    const historyData = await historyResponse.json();
                    if (historyData && historyData.results) {
                        job.results = historyData.results;
                        // Also sync other metadata if missing
                        if (!job.scan_config || Object.keys(job.scan_config).length === 0) {
                            job.scan_config = historyData.config;
                        }
                    }
                }
            } catch (historyError) {
                console.error(`Failed to bridge results from history for job ${id}:`, historyError);
                // Non-critical, UI will just show empty results
            }
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const id = (await params).id;

        // Signal worker to stop first if it's running
        const job = await jobService.getJob(id);
        if (job && (job.status === 'running' || job.status === 'pausing' || job.status === 'paused')) {
            await jobService.stopJob(id);
            // Give it a tiny bit of time to signal? 
            // Actually, deleting it will make the worker stop as soon as it checks.
        }

        await jobService.deleteJob(id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to delete job' },
            { status: 500 }
        );
    }
}
