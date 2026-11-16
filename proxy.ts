import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/auth"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Fresh clone without .env: render the app shell in "setup mode"
  // instead of redirecting in a loop or crashing.
  if (!url || !anon) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname) && pathname !== "/") {
    // API routes: never redirect to /login: return JSON 401 so clients can handle it.
    if (pathname.startsWith("/api/cron/")) {
      return NextResponse.next(); // route enforces CRON_SECRET itself
    }
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { ok: false, error: { code: "unauthorized", message: "Sign in first." } },
        { status: 401 },
      );
    }
    const next = encodeURIComponent(pathname + request.nextUrl.search);
    return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
  }

  // Must-change-password gate: fresh admin accounts (temp password) land on /profile
  // until they set their own password. /auth/* (recovery) stays open.
  if (user && !isPublic(pathname) && pathname !== "/") {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active,must_change_password")
        .eq("id", user.id)
        .maybeSingle();

      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        const redirect = NextResponse.redirect(new URL("/login?reason=deactivated", request.url));
        request.cookies.getAll().forEach(({ name }) => redirect.cookies.delete(name));
        return redirect;
      }
      if (profile?.must_change_password && pathname !== "/profile") {
        return NextResponse.redirect(new URL("/profile?first-login=1", request.url));
      }
    } catch {
      // profiles table unreachable: let the request through; RLS still guards data.
    }
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match everything except static assets and files with extensions.
     * Keeps session refresh + route guarding off the asset path.
     */
    "/((?!_next/static|_next/image|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|txt)$).*)",
  ],
};
