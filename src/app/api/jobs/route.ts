import { NextRequest, NextResponse } from 'next/server';
import { jobService } from '@/lib/jobs';
import { ScanConfig } from '@/lib/scanner';
import { getCurrentUser } from '@/lib/auth';
import { ensureUserInSupabase, isUsingSupabase } from '@/lib/supabase';

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
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        // Ensure user row exists in Supabase public.users before FK-referencing insert
        const useSupabase = await isUsingSupabase();
        if (useSupabase) {
            await ensureUserInSupabase(user);
        }

        const job = await jobService.createJob(url, finalConfig, user.id);

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
        const user = await getCurrentUser();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const jobs = await jobService.getJobsMinimal(user.id);
        return NextResponse.json(jobs);
    } catch (error: any) {
        console.error('Error fetching scan jobs:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch scan jobs' },
            { status: 500 }
        );
    }
}
