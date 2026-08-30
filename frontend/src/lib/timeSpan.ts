export function parseTimeSpanToSeconds(value: string): number {
  const [time, fraction] = value.split('.')
  const [hours, minutes, seconds] = time.split(':').map(Number)
  const fractionSeconds = fraction ? Number(`0.${fraction}`) : 0
  return hours * 3600 + minutes * 60 + seconds + fractionSeconds
}
