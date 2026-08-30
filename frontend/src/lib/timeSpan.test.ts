import { describe, expect, it } from 'vitest'
import { parseTimeSpanToSeconds } from './timeSpan'

describe('parseTimeSpanToSeconds', () => {
  it('parses whole seconds', () => {
    expect(parseTimeSpanToSeconds('00:00:05')).toBe(5)
  })

  it('parses minutes and hours', () => {
    expect(parseTimeSpanToSeconds('01:02:03')).toBe(3723)
  })

  it('parses fractional seconds', () => {
    expect(parseTimeSpanToSeconds('00:00:02.5000000')).toBe(2.5)
  })
})
