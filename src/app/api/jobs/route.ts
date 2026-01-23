import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';
import { ScanConfig } from '@/lib/scanner';

interface CreateJobRequest {
    url: string;
    config?: ScanConfig;
    auth?: {
        username: string;
        password: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: CreateJobRequest = await request.json();
        const { url, config, auth } = body;

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        // Merge auth into config if provided separately
        const finalConfig: ScanConfig = {
            ...config,
            auth: auth ? { username: auth.username, password: auth.password } : config?.auth
        };

        const job = await jobService.createJob(url, finalConfig);

        return NextResponse.json(job, { status: 201 });
    } catch (error: any) {
        console.error('Error creating scan job:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create scan job' },
            { status: 500 }
        );
    }
}


export async function GET(request: NextRequest) {
    try {
        const jobs = await jobService.getJobsMinimal();
        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error('Error fetching scan jobs:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch scan jobs' },
            { status: 500 }
        );
    }
}
