"use client";

import * as Iconsax from "iconsax-react";
import { ComponentType } from "react";

type IconProps = {
  size?: number | string;
  color?: string;
  variant?: "Linear" | "Outline" | "Bold" | "Bulk" | "Broken" | "TwoTone";
  className?: string;
};

/** Wrapper para usar ícones Iconsax por nome (string) de forma segura. */
export function Icon({
  name,
  ...props
}: { name: string } & IconProps) {
  const lib = Iconsax as unknown as Record<string, ComponentType<IconProps>>;
  const Cmp = lib[name] ?? lib["Box"];
  return <Cmp {...props} />;
}
