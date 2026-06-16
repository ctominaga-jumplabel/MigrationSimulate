// Formatação pt-BR. APRESENTAÇÃO apenas — nenhum cálculo de negócio aqui.

const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return nf0.format(v);
}

export function fmtHoras(v: number | null | undefined, dec = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (dec === 0 ? nf0 : nf1).format(v) + " h";
}

export function fmtDec(v: number | null | undefined, dec = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
}

export function fmtPct(v: number | null | undefined, dec = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v) + "%";
}

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// Anos-equivalentes de duração (apresentação): dias úteis / 252 dias úteis/ano.
export function diasParaAnos(diasUteis: number): string {
  if (!diasUteis || !Number.isFinite(diasUteis)) return "—";
  return fmtDec(diasUteis / 252, 1) + " anos";
}
