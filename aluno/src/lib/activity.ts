import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";

/**
 * Pure helpers that turn raw student data into the daily "engagement" series
 * powering the activity heatmap card. Engagement = completed study blocks
 * (placed on their scheduled day) + simulados taken (on their real date).
 *
 * Kept free of React/Supabase so the streak/peak math can be unit-tested.
 */

export interface BlocoLite {
  cronograma_id: string;
  dia_semana: string;
  concluido: boolean | null;
}

export interface CronogramaLite {
  id: string;
  semana_inicio: string;
}

export interface SimuladoLite {
  data: string;
}

/** Map of `yyyy-MM-dd` -> activity count for that day. */
export type DailyActivity = Map<string, number>;

export interface Streaks {
  current: number;
  longest: number;
}

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatCell {
  date: string;
  count: number;
  level: HeatLevel;
  isFuture: boolean;
}

// semana_inicio is the Monday of the week; offset each weekday from it.
const DIA_INDEX: Record<string, number> = {
  segunda: 0,
  terca: 1,
  quarta: 2,
  quinta: 3,
  sexta: 4,
  sabado: 5,
  domingo: 6,
};

const EPOCH = new Date(2000, 0, 1);

function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function buildDailyActivity(input: {
  blocos: readonly BlocoLite[];
  cronogramas: readonly CronogramaLite[];
  simulados: readonly SimuladoLite[];
}): DailyActivity {
  const daily: DailyActivity = new Map();
  const add = (key: string) => daily.set(key, (daily.get(key) ?? 0) + 1);

  const weekStartById = new Map(input.cronogramas.map((c) => [c.id, c.semana_inicio]));

  for (const bloco of input.blocos) {
    if (bloco.concluido !== true) continue;
    const semanaInicio = weekStartById.get(bloco.cronograma_id);
    if (!semanaInicio) continue;
    const offset = DIA_INDEX[bloco.dia_semana];
    if (offset === undefined) continue;
    add(dateKey(addDays(parseISO(semanaInicio.slice(0, 10)), offset)));
  }

  for (const simulado of input.simulados) {
    if (!simulado.data) continue;
    // Bucket by the calendar date portion — avoids timezone drift entirely.
    add(simulado.data.slice(0, 10));
  }

  return daily;
}

export function computeActiveDays(daily: DailyActivity): number {
  let total = 0;
  for (const count of daily.values()) {
    if (count > 0) total += 1;
  }
  return total;
}

export function computeStreaks(daily: DailyActivity, today: Date): Streaks {
  const isActive = (date: Date) => (daily.get(dateKey(date)) ?? 0) > 0;

  // Current streak: count consecutive active days backwards. The in-progress
  // day gets a grace period — if today has no activity yet, start at yesterday
  // so an ongoing streak isn't prematurely zeroed.
  let cursor = isActive(today) ? today : addDays(today, -1);
  let current = 0;
  while (isActive(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  // Longest streak: scan all active days for the longest consecutive run.
  const dayNumbers = [...daily.entries()]
    .filter(([, count]) => count > 0)
    .map(([key]) => differenceInCalendarDays(parseISO(key), EPOCH))
    .sort((a, b) => a - b);

  let longest = 0;
  let run = 0;
  let previous: number | null = null;
  for (const day of dayNumbers) {
    run = previous !== null && day === previous + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
    previous = day;
  }

  return { current, longest };
}

function levelFor(count: number): HeatLevel {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

/**
 * Build a GitHub-style grid: `weeks` columns × 7 rows (Mon..Sun), ending on the
 * week that contains `today`.
 */
export function buildHeatmapWeeks(
  daily: DailyActivity,
  opts: { weeks: number; today: Date },
): HeatCell[][] {
  const lastWeekStart = startOfWeek(opts.today, { weekStartsOn: 1 });
  const gridStart = addDays(lastWeekStart, -7 * (opts.weeks - 1));

  const columns: HeatCell[][] = [];
  for (let week = 0; week < opts.weeks; week += 1) {
    const column: HeatCell[] = [];
    for (let day = 0; day < 7; day += 1) {
      const date = addDays(gridStart, week * 7 + day);
      const key = dateKey(date);
      const count = daily.get(key) ?? 0;
      column.push({
        date: key,
        count,
        level: levelFor(count),
        isFuture: differenceInCalendarDays(date, opts.today) > 0,
      });
    }
    columns.push(column);
  }
  return columns;
}
