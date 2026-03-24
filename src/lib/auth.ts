import { auth } from "@/auth";

export type AppUser = {
    id: string;
    email: string;
    role: string;
    hasAccess: boolean;
    name?: string | null;
};

export async function getCurrentUser(): Promise<AppUser | null> {
    const session = await auth();
    
    if (!session || !session.user) return null;

    return {
        id: (session.user as any).id,
        email: session.user.email || '',
        role: (session.user as any).role || 'user',
        hasAccess: (session.user as any).hasAccess || false,
        name: session.user.name
    };
}
