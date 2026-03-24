import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/prisma"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { authConfig } from "./auth.config"
import { isUsingSupabase, getSupabaseClient } from "@/lib/supabase"
import { getDatabaseUrl } from "@/lib/database"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) || (token.sub as string);
        session.user.role = token.role as string;
        session.user.hasAccess = token.hasAccess as boolean;
        session.user.name = token.name as string;

        try {
          // Fetch fresh data from DB to ensure immediate role changes
          // Use a raw check if possible or just catch the "table not found" error
          const dbUser = await (prisma as any).user.findUnique({
            where: { id: session.user.id },
            select: { role: true, hasAccess: true, name: true }
          }).catch((e: any) => {
            console.warn("[AUTH] Session refresh failed (likely DB not initialized or user missing):", e.message);
            return null;
          });

          if (dbUser) {
            session.user.role = dbUser.role;
            session.user.hasAccess = dbUser.hasAccess;
            session.user.name = dbUser.name;
          }
        } catch (error) {
          console.error("Error refreshing session from database:", error);
        }
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string;
        const password = credentials.password as string;

        // --- SUPABASE AUTH FALLBACK ---
        // If in supabase mode, first try to authenticate against Supabase Auth API
        // This allows login even if Prisma is not connected to a Postgres DB
        const useSupabase = await isUsingSupabase();
        console.log(`[AUTH] Checking login for ${email}. isUsingSupabase: ${useSupabase}`);

        if (useSupabase) {
            try {
                const supabase = await getSupabaseClient();
                if (supabase) {
                    console.log(`[AUTH] Attempting Supabase signInWithPassword for ${email}...`);
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email,
                        password,
                    });

                    if (!error && data.user) {
                        console.log(`[AUTH] Supabase Auth SUCCESS for ${email}. Syncing to Prisma...`);
                        
                        try {
                            // Success! Now ensure the user exists in our prisma-managed DB
                            const user = await (prisma as any).user.upsert({
                                where: { id: data.user.id },
                                update: { email: data.user.email },
                                create: {
                                    id: data.user.id,
                                    email: data.user.email || email,
                                    role: 'user', 
                                    hasAccess: false, 
                                }
                            });
                            console.log(`[AUTH] Prisma sync SUCCESS for ${email}. Returning session.`);

                            return {
                                id: user.id,
                                email: user.email,
                                name: user.name,
                                role: user.role,
                                hasAccess: user.hasAccess,
                            };
                        } catch (prismaError: any) {
                            console.error(`[AUTH] Prisma sync CRITICAL ERROR for ${email}:`, prismaError.message);
                            if (prismaError.message.includes('does not exist')) {
                                console.error(`[AUTH] Table 'users' likely missing in ${getDatabaseUrl()}. Did you run the setup wizard?`);
                            }
                            return null;
                        }
                    }
                    
                    // IF IN SUPABASE MODE, FAIL HERE. DO NOT FALL THROUGH TO LOCAL.
                    if (error) {
                        console.error(`[AUTH] Supabase Auth FAILURE for ${email}:`, error);
                        // Log specifically if it's a "grant" error which points to a DB trigger failure
                        if (error.message.includes('granting user')) {
                          console.error(`[AUTH] This error is usually caused by a broken Postgres trigger in Supabase. Please run the "Power Flush" SQL script provided in the Setup Wizard.`);
                        }
                    } else {
                        console.warn(`[AUTH] Supabase Auth returned no error but no user for ${email}`);
                    }
                    return null;
                } else {
                    console.error(`[AUTH] Supabase mode enabled but client could not be initialized for ${email}`);
                    return null;
                }
            } catch (err) {
                console.error(`[AUTH] Supabase Auth fallback EXCEPTION for ${email}:`, err);
                return null;
            }
        }

        // --- PRISMA (SQLite/Local) AUTH ---
        const user = await (prisma as any).user.findUnique({
          where: { email },
        })

        if (!user || !user.password) return null

        const isValid = await compare(password, user.password)

        if (!isValid) return null

        return {
          id: user.id || "",
          email: user.email,
          name: user.name,
          role: user.role,
          hasAccess: user.hasAccess,
        }
      },
    }),
  ],
})
