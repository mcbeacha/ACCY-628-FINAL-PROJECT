import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/auth");
  const isPublicAsset =
    path.startsWith("/_next") ||
    path.startsWith("/favicon") ||
    path.includes(".");

  if (!user && !isAuthRoute && !isPublicAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Only send authenticated users away from login when there is no error param
  // (error=profile means we signed them out after a failed profile load)
  if (user && path === "/login") {
    const hasAuthError = request.nextUrl.searchParams.has("error");
    if (!hasAuthError) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
