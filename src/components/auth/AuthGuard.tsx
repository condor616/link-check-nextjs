import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { headers } from 'next/headers';
import { checkIsSetup } from '@/lib/setup';

export default async function AuthGuard({ children }: { children: React.ReactNode }) {
    // Determine the current path to avoid redirect loops (provided by middleware.ts)
    const headersList = await headers();
    const pathname = headersList.get('x-pathname') || '';
    console.log('[AUTH] Guard checking path:', pathname);
    
    // Allow public routes
    if (pathname.startsWith('/login') || pathname.startsWith('/register') || pathname.startsWith('/api') || pathname.startsWith('/pending') || pathname.startsWith('/setup') || pathname.startsWith('/auth')) {
        console.log('[AUTH] Public route, accessibility granted');
        return <>{children}</>;
    }

    console.log('[AUTH] Checking user session...');
    const user = await getCurrentUser();
    console.log('[AUTH] User found:', user ? user.email : 'null');

    if (!user) {
        console.log('[AUTH] No user, checking setup status...');
        const isSetup = await checkIsSetup();
        console.log('[AUTH] isSetup:', isSetup);
        if (!isSetup) {
            console.log('[AUTH] App not setup, allowing root access');
            return <>{children}</>;
        }
        
        console.log('[AUTH] App setup but no user, redirecting to /login');
        redirect('/login');
    }

    if (!user.hasAccess && !pathname.startsWith('/pending')) {
        // Authenticated but no access, redirect to pending
        redirect('/pending');
    }

    return <>{children}</>;
}
