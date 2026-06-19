import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  expectedToken,
  verifyCredentials,
} from "@/lib/auth";

// Endpoint de sessão (fora de /api para não cair no rewrite da função Python).
//   POST   /session  { user, password }  -> valida e seta o cookie httpOnly.
//   DELETE /session                       -> encerra a sessão (logout).

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const user = String(body?.user ?? "");
  const password = String(body?.password ?? "");

  if (!verifyCredentials(user, password)) {
    return NextResponse.json(
      { ok: false, error: "Usuário ou senha inválidos." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
