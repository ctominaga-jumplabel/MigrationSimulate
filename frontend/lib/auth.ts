// Gate de login (server/edge — sem segredo no cliente). As credenciais ficam em
// variáveis de ambiente (frontend/.env): APP_LOGIN_USER / APP_LOGIN_PASSWORD.
// Defaults embutidos garantem que o login funciona mesmo sem .env configurado.
//
// O cookie de sessão guarda apenas um HASH (SHA-256) das credenciais — nunca a
// senha em si. O middleware recalcula o hash esperado a partir do .env e compara,
// então o cookie não pode ser forjado sem conhecer a credencial. Web Crypto
// (`crypto.subtle`) está disponível tanto no Edge (middleware) quanto no Node
// (route handler), então o MESMO código serve aos dois.

export const SESSION_COOKIE = "cogna_session";
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 h

// Login padrão (sobrescrevível por frontend/.env). Server-only: NÃO usar prefixo
// NEXT_PUBLIC_ — a credencial não deve vazar para o bundle do cliente.
export function defaultCreds(): { user: string; pass: string } {
  return {
    user: process.env.APP_LOGIN_USER || "admin",
    pass: process.env.APP_LOGIN_PASSWORD || "cogna2026",
  };
}

/** Hash hex (SHA-256) de `user:pass` + sal fixo — valor guardado no cookie. */
export async function sessionToken(user: string, pass: string): Promise<string> {
  const data = new TextEncoder().encode(`${user}:${pass}:cogna-mission-control`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Token esperado a partir das credenciais do .env (o que um cookie válido tem). */
export function expectedToken(): Promise<string> {
  const { user, pass } = defaultCreds();
  return sessionToken(user, pass);
}

/** Verifica usuário+senha contra as credenciais do .env. */
export function verifyCredentials(user: string, pass: string): boolean {
  const c = defaultCreds();
  return user === c.user && pass === c.pass;
}
