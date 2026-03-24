import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseClient, getSupabaseAdminClient } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcryptjs';

export async function POST(request: Request) {
    try {
        const { email, password, storageType } = await request.json();

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        if (storageType === 'sqlite') {
            // Hash password just in case we ever decouple auto-login
            const hashedPassword = await bcrypt.hash(password, 10);
            const id = 'local-admin'; // predictable ID for auto-login bypass logic
            
            // Upsert rather than create in case setup is run multiple times
            await (prisma as any).user.upsert({
                where: { email },
                create: {
                    id,
                    email,
                    password: hashedPassword,
                    role: 'admin',
                    hasAccess: true,
                },
                update: {
                    password: hashedPassword,
                    role: 'admin',
                    hasAccess: true,
                }
            });
            return NextResponse.json({ success: true, message: 'Local admin account created' });
        } 
        else if (storageType === 'supabase') {
            const supabase = await getSupabaseClient();
            const supabaseAdmin = await getSupabaseAdminClient();
            
            if (!supabase && !supabaseAdmin) {
                return NextResponse.json({ error: 'Supabase client not available. Please check your URL and Key.' }, { status: 400 });
            }

            let userId: string | undefined;

            if (supabaseAdmin) {
                // 1. Create user via Admin API (bypasses email confirmation)
                const { data: adminAuthData, error: adminAuthError } = await supabaseAdmin.auth.admin.createUser({
                    email,
                    password,
                    email_confirm: true
                });

                if (adminAuthError) {
                    console.error('Admin createUser error:', adminAuthError.message, adminAuthError.status);
                    // If user already exists, we need to get their ID to link them to the public.users table
                    if (adminAuthError.message.toLowerCase().includes('already registered') || adminAuthError.message.toLowerCase().includes('already exists')) {
                        // Use listUsers to find the user by email
                        const { data: { users: allUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                        if (!listError) {
                            const existingUser = allUsers.find(u => u.email === email);
                            userId = existingUser?.id;
                        }
                    }

                    if (!userId) {
                        // "Invalid authentication credentials" at this point means the Service Role Key is wrong
                        const isAuthErr = adminAuthError.message.toLowerCase().includes('invalid') || adminAuthError.status === 401 || adminAuthError.status === 403;
                        const hint = isAuthErr
                            ? 'Your Service Role Key appears to be invalid. Make sure you copied the key from Supabase → Project Settings → API → service_role (secret), not the anon key.'
                            : '';
                        return NextResponse.json({
                            error: `Supabase Admin Auth Error: ${adminAuthError.message}${hint ? ` — ${hint}` : ''}`
                        }, { status: 400 });
                    }
                } else {
                    userId = adminAuthData?.user?.id;
                }
            } 
            
            if (!userId) {
                // Fallback to regular signUp if admin client failed or wasn't provided
                const clientToUse = supabase || supabaseAdmin; 
                if (!clientToUse) return NextResponse.json({ error: 'No supabase client' }, { status: 400 });

                const { data: authData, error: authError } = await clientToUse.auth.signUp({
                    email,
                    password,
                });

                if (authError) {
                    return NextResponse.json({ error: `Supabase Auth Error: ${authError.message}. TIP: Providing a Service Role Key in settings can bypass email confirmation errors in self-hosted environments.` }, { status: 400 });
                }
                userId = authData?.user?.id;
            }

            if (!userId) {
                return NextResponse.json({ error: 'Failed to retrieve user ID from Supabase' }, { status: 500 });
            }

            // 2. Insert into public.users table as admin
            const clientToQuery = supabaseAdmin || supabase;
            if (!clientToQuery) return NextResponse.json({ error: 'No client available' }, { status: 400 });

            const { error: dbError } = await (clientToQuery.from('users') as any).upsert({
                id: userId,
                email,
                role: 'admin',
                has_access: true,
                created_at: new Date().toISOString()
            }, { onConflict: 'email' });

            if (dbError) {
                return NextResponse.json({ error: `Supabase DB Error: ${dbError.message}` }, { status: 400 });
            }

            // 3. ALSO sync to our Prisma-managed database (local fallback or real Postgres)
            // This is required for session/JWT metadata and consistency
            const hashedPassword = await bcrypt.hash(password, 10);
            try {
                await (prisma as any).user.upsert({
                    where: { email },
                    update: {
                        id: userId,
                        password: hashedPassword,
                        role: 'admin',
                        hasAccess: true,
                    },
                    create: {
                        id: userId,
                        email,
                        password: hashedPassword,
                        role: 'admin',
                        hasAccess: true,
                    }
                });
            } catch (pError: any) {
                console.error('Prisma sync error in Supabase admin setup:', pError);
                // We keep going if it's just a Prisma sync error, but log it
            }

            return NextResponse.json({ success: true, message: 'Supabase admin account created and synced' });
        }

        return NextResponse.json({ error: 'Invalid storage engine type' }, { status: 400 });

    } catch (e: any) {
        console.error('Admin Setup Error:', e);
        return NextResponse.json({ error: e.message || 'An unknown error occurred' }, { status: 500 });
    }
}
