"use client";

import { Icon } from "@/components/layout/Icon";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-black/[0.03] px-3 py-2 focus-within:border-accent/40">
      <Icon name="SearchNormal1" size={16} className="text-ink-faint" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
      />
      {value && (
        <button onClick={() => onChange("")} className="text-ink-faint hover:text-ink">
          <Icon name="CloseCircle" size={16} />
        </button>
      )}
    </div>
  );
}
