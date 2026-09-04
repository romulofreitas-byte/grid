import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { usesMockAuth } from "@/lib/auth/mock";
import { signedInEntrarDestination } from "@/lib/auth/next-path";

function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export async function middleware(request: NextRequest) {
  const mock = usesMockAuth();
  const path = request.nextUrl.pathname;
  // Mock skips route protection, but still bounce a signed-in visitor off /entrar.
  if (mock && path !== "/entrar") return NextResponse.next();

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

  const protectedPath =
    path.startsWith("/painel") ||
    path.startsWith("/box") ||
    path.startsWith("/calculadora") ||
    path.startsWith("/largada") ||
    path.startsWith("/empresas") ||
    path.startsWith("/grid") ||
    path.startsWith("/lead") ||
    path.startsWith("/listas") ||
    path.startsWith("/crm") ||
    path.startsWith("/conta") ||
    path.startsWith("/setup") ||
    path.startsWith("/pagar") ||
    path.startsWith("/conexoes") ||
    path.startsWith("/admin");

  if (protectedPath && !user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/entrar";
    const next = `${path}${request.nextUrl.search}`;
    redirect.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(redirect);
  }

  if (path === "/entrar" && user) {
    const dest = signedInEntrarDestination(request.nextUrl.searchParams);
    if (dest) {
      return redirectWithCookies(new URL(dest, request.url), response);
    }
  }

  if (mock) return response;

  if (path.startsWith("/admin") && user && !isAdminEmail(user.email)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/painel";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/entrar",
    "/painel",
    "/painel/:path*",
    "/box",
    "/box/:path*",
    "/calculadora",
    "/calculadora/:path*",
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
    "/conexoes",
    "/conexoes/:path*",
    "/admin/:path*",
  ],
};
