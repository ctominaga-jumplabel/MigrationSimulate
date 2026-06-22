"use client";

import { Icon } from "@/components/layout/Icon";
import { fmtInt } from "@/lib/format";

/**
 * Paginação simples e reutilizável (EGPs, SAS sem EGP). Mostra a faixa de itens
 * exibidos sobre o total e botões anterior/próxima. `page` é 0-based; o pai
 * controla o estado e fatia a lista. Não renderiza nada se couber tudo em 1 página.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  itemLabel = "itens",
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  itemLabel?: string;
}) {
  const nPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, nPages - 1);
  const from = total === 0 ? 0 : safePage * pageSize + 1;
  const to = Math.min(total, (safePage + 1) * pageSize);

  if (total <= pageSize) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-xs text-ink-muted">
        Exibindo{" "}
        <span className="num font-semibold text-ink">
          {fmtInt(from)}–{fmtInt(to)}
        </span>{" "}
        de <span className="num font-semibold text-ink">{fmtInt(total)}</span> {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <PageButton
          disabled={safePage <= 0}
          onClick={() => onPage(safePage - 1)}
          label="Anterior"
          icon="ArrowLeft2"
        />
        <span className="num px-1 text-xs text-ink-muted">
          {safePage + 1} / {nPages}
        </span>
        <PageButton
          disabled={safePage >= nPages - 1}
          onClick={() => onPage(safePage + 1)}
          label="Próxima"
          icon="ArrowRight2"
          iconRight
        />
      </div>
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  label,
  icon,
  iconRight,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  icon: string;
  iconRight?: boolean;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-1 rounded-xl border border-line bg-black/[0.03] px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      {!iconRight && <Icon name={icon} size={14} />}
      {label}
      {iconRight && <Icon name={icon} size={14} />}
    </button>
  );
}
