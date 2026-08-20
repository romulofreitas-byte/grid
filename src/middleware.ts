import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { usesMockAuth } from "@/lib/auth/mock";

export async function middleware(request: NextRequest) {
  if (usesMockAuth()) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const protectedPath =
    path.startsWith("/box") ||
    path.startsWith("/largada") ||
    path.startsWith("/empresas") ||
    path.startsWith("/grid") ||
    path.startsWith("/lead") ||
    path.startsWith("/listas") ||
    path.startsWith("/crm") ||
    path.startsWith("/conta") ||
    path.startsWith("/setup") ||
    path.startsWith("/pagar") ||
    path.startsWith("/admin");

  if (protectedPath && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    const next = `${path}${request.nextUrl.search}`;
    redirect.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(redirect);
  }

  if (path.startsWith("/admin") && user && !isAdminEmail(user.email)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/box";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/box",
    "/box/:path*",
    "/largada",
    "/largada/:path*",
    "/empresas",
    "/empresas/:path*",
    "/grid/:path*",
    "/lead/:path*",
    "/listas",
    "/listas/:path*",
    "/crm",
    "/crm/:path*",
    "/conta",
    "/conta/:path*",
    "/setup",
    "/setup/:path*",
    "/pagar",
    "/pagar/:path*",
    "/admin/:path*",
  ],
};
