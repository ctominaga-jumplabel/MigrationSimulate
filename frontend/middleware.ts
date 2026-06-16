import { NextRequest, NextResponse } from "next/server";

/**
 * Gate de senha (HTTP Basic Auth) OPT-IN para a apresentação.
 * - Desligado por padrão: sem BASIC_AUTH_USER/BASIC_AUTH_PASS, tudo passa.
 * - Para ligar na Vercel: defina as duas envs (server-only, NÃO use prefixo
 *   NEXT_PUBLIC_) e refaça o deploy.
 *
 * Observação: isto protege a UI. A API (Render) continua acessível por URL —
 * para sigilo mais forte, proteja também a API (ex.: token compartilhado).
 */
export function middleware(req: NextRequest) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASS;
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    try {
      const [u, p] = atob(auth.slice(6)).split(":");
      if (u === user && p === pass) return NextResponse.next();
    } catch {
      /* credencial malformada → cai no 401 */
    }
  }
  return new NextResponse("Autenticação necessária.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Cogna Mission Control"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
