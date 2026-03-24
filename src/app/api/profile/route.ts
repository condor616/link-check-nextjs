import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { isUsingSupabase, getSupabaseAdminClient } from '@/lib/supabase';
import { hash } from 'bcryptjs';

export async function PATCH(request: Request) {
    try {
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { name, password } = body;

        const updateData: any = {};
        if (typeof name === 'string') {
            updateData.name = name;
        }

        if (password) {
            if (password.length < 6) {
                return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
            }
            updateData.password = await hash(password, 10);
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }

        // Update in Prisma
        const updatedUser = await (prisma as any).user.update({
            where: { id: currentUser.id },
            data: updateData
        });

        // Sync with Supabase if enabled
        if (await isUsingSupabase()) {
            try {
                const supabaseAdmin = await getSupabaseAdminClient();
                if (supabaseAdmin) {
                    const supabaseUpdate: any = {};
                    if (updateData.name) supabaseUpdate.name = updateData.name;
                    
                    if (Object.keys(supabaseUpdate).length > 0) {
                        const { error } = await (supabaseAdmin.from('users') as any)
                            .update(supabaseUpdate)
                            .eq('id', currentUser.id);
                        
                        if (error) {
                            console.warn('Supabase profile sync error (public.users):', error.message);
                        }
                    }

                    // If password changed, update in Supabase Auth as well
                    if (password) {
                        const { error } = await supabaseAdmin.auth.admin.updateUserById(
                            currentUser.id,
                            { password: password }
                        );
                        if (error) {
                            console.error('Supabase Auth password update error:', error.message);
                        }
                    }
                }
            } catch (err) {
                console.error('Supabase profile sync unexpected error:', err);
            }
        }

        return NextResponse.json({ 
            success: true, 
            user: { 
                id: updatedUser.id, 
                name: updatedUser.name, 
                email: updatedUser.email 
            } 
        });
    } catch (error: any) {
        console.error('Profile update error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
