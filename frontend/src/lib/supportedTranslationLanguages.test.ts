import { describe, expect, it } from 'vitest'
import { SUPPORTED_TRANSLATION_LANGUAGES } from './supportedTranslationLanguages'

describe('SUPPORTED_TRANSLATION_LANGUAGES', () => {
  it('includes Chinese as the first supported language', () => {
    expect(SUPPORTED_TRANSLATION_LANGUAGES[0]).toEqual({ code: 'zh', displayName: 'Chinese' })
  })

  it('has a unique code per entry', () => {
    const codes = SUPPORTED_TRANSLATION_LANGUAGES.map((l) => l.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})
