"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Contador animado. Recebe o VALOR FINAL (já calculado pela API) e só anima a
 * transição visual entre o valor anterior e o novo. `format` cuida do pt-BR.
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.7,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
}) {
  const mv = useMotionValue(value);
  const [display, setDisplay] = useState(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    const controls = animate(mv, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [value, duration, mv, reduce]);

  return <span className="num">{format(display)}</span>;
}
