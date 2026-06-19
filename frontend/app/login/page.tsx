"use client";

import { Icon } from "@/components/layout/Icon";
import { Button } from "@/components/ui/Button";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const from = search.get("from") || "/";

  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "Não foi possível entrar.");
        setLoading(false);
        return;
      }
      // Cookie setado pelo servidor — navega para a rota de origem.
      router.replace(from);
      router.refresh();
    } catch {
      setError("Falha de rede. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-base grad-bg px-5">
      <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 left-1/4 h-72 w-72 rounded-full bg-electric/15 blur-3xl" />

      <form
        onSubmit={submit}
        className="relative w-full max-w-md rounded-3xl border border-line bg-base-800 p-8 shadow-card animate-fade-up"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-grad-accent shadow-glow">
            <Icon name="Routing" size={22} color="#fff" variant="Bold" />
          </div>
          <div>
            <p className="text-sm font-bold text-ink">Cogna Mission Control</p>
            <p className="text-xs text-ink-muted">Migração SAS → Databricks</p>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-ink">Entrar</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Acesso restrito. Informe suas credenciais para continuar.
        </p>

        <div className="mt-6 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Usuário</span>
            <input
              type="text"
              autoComplete="username"
              autoFocus
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="w-full rounded-xl border border-line bg-black/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/40"
              placeholder="admin"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-line bg-black/[0.03] px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-accent/40"
              placeholder="••••••••"
            />
          </label>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            <Icon name="InfoCircle" size={16} variant="Bold" />
            {error}
          </div>
        )}

        <Button type="submit" disabled={loading} className="mt-6 w-full">
          {loading ? "Entrando…" : "Entrar"}
          {!loading && <Icon name="ArrowRight" size={16} />}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  // useSearchParams exige um Suspense boundary no App Router.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
