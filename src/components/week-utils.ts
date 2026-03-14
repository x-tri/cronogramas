export function getWeekBounds(date: Date): { start: Date; end: Date } {
  const start = new Date(date)
  const day = start.getDay()

  // Move to Monday (day 1). If Sunday (0), go back 6 days.
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}
