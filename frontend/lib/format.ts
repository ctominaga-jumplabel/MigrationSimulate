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

// Anos-equivalentes de duração (apresentação): dias úteis ÷ (dias úteis/mês × 12).
// `diasUteisMes` default 21 (= 252 dias úteis/ano), configurável pela alavanca.
export function diasParaAnos(diasUteis: number, diasUteisMes = 21): string {
  if (!diasUteis || !Number.isFinite(diasUteis)) return "—";
  const diasAno = (diasUteisMes || 21) * 12;
  return fmtDec(diasUteis / diasAno, 1) + " anos";
}

// Unidades de duração do comparativo (apresentação). `field` casa com
// DuracaoBreakdown; `dec` define a precisão e `sufixo` o rótulo da unidade.
export type DuracaoUnidade = "horas" | "dias" | "meses" | "anos";

export const DURACAO_UNIDADES: {
  value: DuracaoUnidade;
  label: string;
  field: "duracao_horas" | "duracao_dias" | "duracao_meses" | "duracao_anos";
  sufixo: string;
  dec: number;
}[] = [
  { value: "horas", label: "Horas", field: "duracao_horas", sufixo: "h", dec: 0 },
  { value: "dias", label: "Dias", field: "duracao_dias", sufixo: "dias úteis", dec: 1 },
  { value: "meses", label: "Meses", field: "duracao_meses", sufixo: "meses", dec: 1 },
  { value: "anos", label: "Anos", field: "duracao_anos", sufixo: "anos", dec: 1 },
];

/** Formata um valor de duração na unidade dada (com o sufixo). */
export function fmtDuracao(v: number | null | undefined, u: DuracaoUnidade): string {
  const cfg = DURACAO_UNIDADES.find((x) => x.value === u)!;
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const num = cfg.dec === 0 ? fmtInt(v) : fmtDec(v, cfg.dec);
  return `${num} ${cfg.sufixo}`;
}

/**
 * Converte ESFORÇO (horas trabalhadas) para a unidade escolhida.
 * dias = horas ÷ horasDia · meses = dias ÷ diasUteisMes · anos = meses ÷ 12.
 */
export function converteHoras(
  horas: number,
  u: DuracaoUnidade,
  horasDia: number,
  diasUteisMes: number
): number {
  const hd = Math.max(0.1, horasDia || 7.5);
  const dm = Math.max(1, diasUteisMes || 21);
  switch (u) {
    case "horas":
      return horas;
    case "dias":
      return horas / hd;
    case "meses":
      return horas / hd / dm;
    case "anos":
      return horas / hd / (dm * 12);
  }
}

/** Formata ESFORÇO (horas) na unidade escolhida, com o sufixo correspondente. */
export function fmtEsforco(
  horas: number | null | undefined,
  u: DuracaoUnidade,
  horasDia: number,
  diasUteisMes: number
): string {
  if (horas === null || horas === undefined || !Number.isFinite(horas)) return "—";
  const cfg = DURACAO_UNIDADES.find((x) => x.value === u)!;
  const conv = converteHoras(horas, u, horasDia, diasUteisMes);
  const num = cfg.dec === 0 ? fmtInt(conv) : fmtDec(conv, cfg.dec);
  return `${num} ${cfg.sufixo}`;
}
