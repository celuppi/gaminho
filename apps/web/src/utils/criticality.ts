export type Criticality = "Urgente" | "Importante" | "Média" | "Baixa";

export const CRITICALITIES: Criticality[] = [
  "Urgente",
  "Importante",
  "Média",
  "Baixa",
];

/**
 * Coherent severity ramp for the criticality enum, shared across every place
 * that renders it (board card, card detail, selectors, public board).
 *
 * - `dot`  — small colour dot (used as a leading marker)
 * - `pill` — tinted badge classes (text + ring + soft background) for both themes
 */
export const criticalityStyles: Record<
  Criticality,
  { dot: string; pill: string }
> = {
  Urgente: {
    dot: "bg-red-500",
    pill: "bg-red-50 text-red-700 ring-red-300 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/40",
  },
  Importante: {
    dot: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700 ring-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/40",
  },
  Média: {
    dot: "bg-sky-500",
    pill: "bg-sky-50 text-sky-700 ring-sky-300 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/40",
  },
  Baixa: {
    dot: "bg-slate-400",
    pill: "bg-slate-50 text-slate-600 ring-slate-300 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/40",
  },
};
