import { describe, expect, it } from 'vitest'
import { scoreRecitation } from './recitationScoring'

const sentences = [
  { id: 's1', text: 'I saw the snowfall' },
  { id: 's2', text: 'It was magical' }
]

describe('scoreRecitation', () => {
  it('qualifies every sentence on a perfect recitation', () => {
    const result = scoreRecitation(sentences, 'I saw the snowfall It was magical')

    expect(result.score).toBe(1.0)
    expect(result.qualifiedSentenceIds).toEqual(['s1', 's2'])
  })

  it('only qualifies the sentence recited correctly', () => {
    const result = scoreRecitation(sentences, 'I saw the snowfall completely different words')

    expect(result.qualifiedSentenceIds).toEqual(['s1'])
    expect(result.score).toBeLessThan(1.0)
  })
})
