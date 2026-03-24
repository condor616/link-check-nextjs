import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getAppSettings } from '@/lib/settings';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        
        // 1. Authorization: Only admins can perform this action
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        const body = await request.json();
        
        // 2. We only allow updating the `hasAccess` flag and `role`
        if (typeof body.hasAccess !== 'undefined' && typeof body.hasAccess !== 'boolean') {
            return NextResponse.json({ error: 'Invalid payload: hasAccess must be a boolean' }, { status: 400 });
        }
        
        if (typeof body.role !== 'undefined' && !['admin', 'user'].includes(body.role)) {
            return NextResponse.json({ error: 'Invalid payload: role must be admin or user' }, { status: 400 });
        }
        
        if (typeof body.maxJobs !== 'undefined' && (typeof body.maxJobs !== 'number' || body.maxJobs < 1)) {
            return NextResponse.json({ error: 'Invalid payload: maxJobs must be a positive number' }, { status: 400 });
        }
        
        // Cannot revoke your own access securely here (prevent locking oneself out)
        if (id === currentUser.id && body.hasAccess === false) {
            return NextResponse.json({ error: 'You cannot revoke your own access' }, { status: 400 });
        }

        // Cannot change your own role securely here
        if (id === currentUser.id && body.role === 'user') {
            return NextResponse.json({ error: 'You cannot demote yourself' }, { status: 400 });
        }

        // 3. Update the user
        const updatedUser = await (prisma as any).user.update({
            where: { id },
            data: { 
                ...(typeof body.hasAccess !== 'undefined' && { hasAccess: body.hasAccess }),
                ...(typeof body.role !== 'undefined' && { role: body.role }),
                ...(typeof body.maxJobs !== 'undefined' && { maxJobs: body.maxJobs })
            }
        });

        // 4. If using Supabase, sync the role/access to public.users table as well
        const settings = await getAppSettings();
        if (settings.storageType === 'supabase') {
            const supabaseUrl = settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
            const supabaseKey = settings.supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

            if (supabaseUrl && supabaseKey) {
                const supabase = createClient(supabaseUrl, supabaseKey);
                await supabase
                    .from('users')
                    .update({ 
                        role: body.role || updatedUser.role, 
                        has_access: typeof body.hasAccess !== 'undefined' ? body.hasAccess : updatedUser.hasAccess,
                        max_jobs: typeof body.maxJobs !== 'undefined' ? body.maxJobs : updatedUser.maxJobs
                    })
                    .eq('id', id);
            }
        }

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (e: any) {
        console.error('API /users/[id] PATCH Error:', e);
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        
        // 1. Authorization: Only admins can perform this action
        const currentUser = await getCurrentUser();
        if (!currentUser || currentUser.role !== 'admin') {
            return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
        }

        if (id === currentUser.id) {
            return NextResponse.json({ error: 'You cannot delete yourself' }, { status: 400 });
        }

        // 2. Delete from Prisma
        await (prisma as any).user.delete({
            where: { id }
        });

        // 3. If using Supabase, delete from Supabase Auth as well (requires Service Role)
        const settings = await getAppSettings();
        if (settings.storageType === 'supabase') {
            const supabaseUrl = settings.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL;
            const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (supabaseUrl && serviceKey) {
                const supabase = createClient(supabaseUrl, serviceKey);
                
                // Delete from auth.users using admin API
                const { error: authError } = await supabase.auth.admin.deleteUser(id);
                if (authError) {
                    console.error("Supabase Auth deletion failed:", authError);
                    // We don't fail the whole request since DB record is gone
                }

                // Delete from public.users table
                await supabase.from('users').delete().eq('id', id);
            }
        }

        return NextResponse.json({ success: true });
    } catch (e: any) {
        console.error('API /users/[id] DELETE Error:', e);
        return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 });
    }
}
