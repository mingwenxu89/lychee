import { describe, expect, it } from 'vitest'
import { compare, countWords } from './textComparer'

describe('textComparer', () => {
  it('marks every word correct on an exact match', () => {
    const result = compare('I saw the first snowfall.', 'I saw the first snowfall')

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBe(1.0)
    expect(result.words.every((w) => w.status === 'Correct')).toBe(true)
    expect(result.words).toHaveLength(5)
  })

  it('is case- and punctuation-insensitive', () => {
    const result = compare('It was magical.', 'it WAS magical')

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBe(1.0)
  })

  it('marks a single substitution incorrect', () => {
    const result = compare('I saw the first snowfall', 'I saw the last snowfall')

    expect(result.isExactMatch).toBe(false)
    expect(result.accuracyScore).toBeCloseTo(0.8, 5)
    expect(result.words[0].status).toBe('Correct')
    expect(result.words[1].status).toBe('Correct')
    expect(result.words[2].status).toBe('Correct')
    expect(result.words[3].status).toBe('Incorrect')
    expect(result.words[3].word).toBe('first')
    expect(result.words[4].status).toBe('Correct')
  })

  it('marks a missing word as Missing', () => {
    const result = compare('I saw the first snowfall', 'I saw first snowfall')

    expect(result.isExactMatch).toBe(false)
    expect(result.words.some((w) => w.status === 'Missing' && w.word === 'the')).toBe(true)
    expect(result.accuracyScore).toBeCloseTo(0.8, 5)
  })

  it('marks an extra word as Extra', () => {
    const result = compare('I saw the snowfall', 'I saw the first snowfall')

    expect(result.isExactMatch).toBe(false)
    expect(result.words.some((w) => w.status === 'Extra' && w.word === 'first')).toBe(true)
    expect(result.accuracyScore).toBeCloseTo(1.0, 5)
  })

  it('marks every word Missing for an empty submission', () => {
    const result = compare('I saw the snowfall', '')

    expect(result.isExactMatch).toBe(false)
    expect(result.accuracyScore).toBe(0.0)
    expect(result.words.every((w) => w.status === 'Missing')).toBe(true)
  })

  it('is an exact match when the reference appears contiguously with extra prefix and suffix', () => {
    const result = compare('I saw the first snowfall', 'well I saw the first snowfall today')

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBeCloseTo(1.0, 5)
  })

  it('is an exact match when the reference appears only as a prefix', () => {
    const result = compare('I saw the first snowfall', 'I saw the first snowfall today')

    expect(result.isExactMatch).toBe(true)
  })

  it('is an exact match when the reference appears only as a suffix', () => {
    const result = compare('I saw the first snowfall', 'well I saw the first snowfall')

    expect(result.isExactMatch).toBe(true)
  })

  it('is still not an exact match when an extra word is inserted inside the reference', () => {
    // The extra word breaks continuity, unlike a prefix/suffix — must remain false.
    const result = compare('I saw the snowfall', 'I saw the first snowfall')

    expect(result.isExactMatch).toBe(false)
  })

  it.each([
    ['I will go home', "I'll go home"],
    ['I have seen it', "I've seen it"],
    ['I am ready', "I'm ready"],
    ['do not go', "don't go"],
    ['she is happy', "she's happy"],
    ['they are late', "they're late"]
  ])('treats contraction %j / %j as an exact match', (reference, submitted) => {
    const result = compare(reference, submitted)

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBeCloseTo(1.0, 5)
  })

  it('matches an expanded submission against a contraction in the reference', () => {
    const result = compare("I'll go home", 'I will go home')

    expect(result.isExactMatch).toBe(true)
  })

  it('preserves punctuation attached to displayed reference words', () => {
    const result = compare('I saw the first snowfall, right?', 'I saw the last snowfall')

    expect(result.words[3]).toEqual({ word: 'first', status: 'Incorrect' })
    expect(result.words[4]).toEqual({ word: 'snowfall,', status: 'Correct' })
    expect(result.words[5]).toEqual({ word: 'right?', status: 'Missing' })
  })

  it('counts alphanumeric tokens', () => {
    expect(countWords('I saw the first snowfall.')).toBe(5)
    expect(countWords('')).toBe(0)
  })

  it('treats a hyphenated compound as an exact match against the same words with a space', () => {
    const result = compare('a four-day trip', 'a four day trip')

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBe(1.0)
  })

  it.each([
    ['She is ten years old', 'She is 10 years old'],
    ['I have 10 dollars', 'I have ten dollars'],
    ['We waited twenty one minutes', 'We waited 21 minutes'],
    ['We waited 21 minutes', 'We waited twenty-one minutes'],
    ['It cost one hundred dollars', 'It cost 100 dollars'],
    ['There were two hundred and five people', 'There were 205 people']
  ])('treats number word %j / %j as an exact match', (reference, submitted) => {
    const result = compare(reference, submitted)

    expect(result.isExactMatch).toBe(true)
    expect(result.accuracyScore).toBe(1.0)
  })

  it('still marks a genuinely different number as incorrect', () => {
    const result = compare('I have ten dollars', 'I have 11 dollars')

    expect(result.isExactMatch).toBe(false)
    expect(result.words.some((w) => w.status === 'Incorrect' && w.word === 'ten')).toBe(true)
  })

  it('merging a number-word run does not change the reference word\'s displayed text', () => {
    const result = compare('We waited twenty one minutes', 'We waited 21 minutes')

    expect(result.words.some((w) => w.word === 'twenty one')).toBe(true)
  })
})
