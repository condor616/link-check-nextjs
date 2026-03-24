import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from 'next/server';

const { auth } = NextAuth(authConfig);

export default auth((req) => {
    const { nextUrl } = req;
    
    // Add custom headers if needed
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('x-pathname', nextUrl.pathname);

    // If it's an API route or static/image file, don't redirect
    if (
        nextUrl.pathname.startsWith('/api/auth') || 
        nextUrl.pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js)$/)
    ) {
        return NextResponse.next();
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
});

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
