import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, expectedToken } from "@/lib/auth";

/**
 * Gate de login por TELA (cookie de sessão). Toda rota de UI exige um cookie de
 * sessão válido; sem ele, o usuário é redirecionado para `/login`. As credenciais
 * ficam em frontend/.env (APP_LOGIN_USER / APP_LOGIN_PASSWORD) — ver lib/auth.ts.
 *
 * Rotas liberadas (sem login): a própria `/login`, o endpoint de sessão
 * `/session` e os assets do Next. O `/api/*` (função Python no Vercel, via
 * rewrite) é deixado passar para não quebrar o XHR — o gate protege a UI; para
 * sigilo mais forte, proteja também a API (token compartilhado).
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas públicas / que não devem ser gated.
  if (
    pathname === "/login" ||
    pathname === "/session" ||
    pathname.startsWith("/api")
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && token === (await expectedToken())) {
    return NextResponse.next();
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
