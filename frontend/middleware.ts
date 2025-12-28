import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    '/session/:path*',
  ],
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Protect session routes
  if (pathname.startsWith('/session/')) {
    const sessionId = pathname.split('/')[2];
    
    // Validate session ID is a number
    if (!sessionId || isNaN(Number(sessionId)) || Number(sessionId) <= 0) {
      console.log(`[Middleware] ❌ Invalid session ID: ${sessionId} - Redirecting to home`);
      const url = new URL('/', request.url);
      return NextResponse.redirect(url, { status: 302 });
    }

    try {
      // Verify session exists by calling the backend
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const apiEndpoint = `${apiUrl}/sessions/${sessionId}`;
      
      console.log(`[Middleware] 🔍 Verifying session ${sessionId}...`);
      
      const response = await fetch(apiEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      console.log(`[Middleware] Response status: ${response.status}`);

      // If session doesn't exist, redirect to home
      if (!response.ok) {
        console.log(`[Middleware] ❌ Session ${sessionId} not found (${response.status}) - Redirecting to home`);
        const url = new URL('/', request.url);
        return NextResponse.redirect(url, { status: 302 });
      }
      
      console.log(`[Middleware] ✅ Session ${sessionId} verified - Access granted`);
      return NextResponse.next();
    } catch (error) {
      // If backend is unreachable or error occurs, redirect to home
      console.error(`[Middleware] ❌ Session verification failed:`, error instanceof Error ? error.message : error);
      const url = new URL('/', request.url);
      return NextResponse.redirect(url, { status: 302 });
    }
  }

  return NextResponse.next();
}
