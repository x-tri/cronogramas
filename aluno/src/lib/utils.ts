import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Formata numeros grandes de forma compacta pt-BR (ex.: 15000 → "15 mil"). */
export function formatCompactNumber(value: number): string {
  return compactFormatter.format(value);
}
