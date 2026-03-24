import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { isUsingSupabase, getSupabaseClient, getSupabaseAdminClient } from '@/lib/supabase';

export async function POST(request: Request) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await (prisma as any).user.findUnique({
            where: { email }
        });

        if (existingUser) {
            return NextResponse.json({ error: 'User already exists' }, { status: 400 });
        }

        // Check if this is the first user (Admin)
        const userCount = await (prisma as any).user.count();
        const isAdmin = userCount === 0;

        // Hash password
        const hashedPassword = await hash(password, 10);

        let userId: string | undefined;

        // --- SUPABASE AUTH SYNC ---
        if (await isUsingSupabase()) {
            try {
                const supabaseAdmin = await getSupabaseAdminClient();
                const supabase = await getSupabaseClient();
                
                if (supabaseAdmin) {
                    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                        email,
                        password,
                        email_confirm: true,
                        user_metadata: { name }
                    });
                    
                    if (authError) {
                        return NextResponse.json(
                            { error: `Supabase Auth error: ${authError.message}` },
                            { status: 400 }
                        );
                    } else if (authData?.user) {
                        userId = authData.user.id;
                    }
                } else if (supabase) {
                    const { data: authData, error: signUpError } = await supabase.auth.signUp({ 
                        email, 
                        password,
                        options: { data: { name } }
                    });
                    if (signUpError) {
                        return NextResponse.json(
                            { error: `Supabase Auth error: ${signUpError.message}` },
                            { status: 400 }
                        );
                    } else if (authData?.user) {
                        userId = authData.user.id;
                    }
                } else {
                    return NextResponse.json(
                        { error: "Supabase client not available" },
                        { status: 500 }
                    );
                }
            } catch (err: any) {
                console.error("Supabase Auth sync error:", err.message);
                return NextResponse.json(
                    { error: `Supabase sync failed: ${err.message}` },
                    { status: 500 }
                );
            }
        }

        // Create user in Prisma
        const user = await (prisma as any).user.create({
            data: {
                id: userId, // Use Supabase ID if available, otherwise Prisma generates cuid()
                email,
                password: hashedPassword,
                role: isAdmin ? 'admin' : 'user',
                hasAccess: isAdmin // Admin gets immediate access, others are pending
            }
        });

        return NextResponse.json({ 
            success: true, 
            user: { 
                id: user.id, 
                email: user.email, 
                role: user.role, 
                hasAccess: user.hasAccess 
            } 
        });
    } catch (error: any) {
        console.error('Registration error:', error);
        return NextResponse.json({ error: error.message || 'Failed to register' }, { status: 500 });
    }
}
