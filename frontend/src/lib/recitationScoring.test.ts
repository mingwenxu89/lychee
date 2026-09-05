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
    expect(result.sentenceResults.map((s) => s.sentenceId)).toEqual(['s1', 's2'])
    expect(result.sentenceResults.every((s) => s.isQualified)).toBe(true)
  })

  it('only qualifies the sentence recited correctly', () => {
    const result = scoreRecitation(sentences, 'I saw the snowfall completely different words')

    expect(result.sentenceResults.find((s) => s.sentenceId === 's1')?.isQualified).toBe(true)
    expect(result.sentenceResults.find((s) => s.sentenceId === 's2')?.isQualified).toBe(false)
    expect(result.score).toBe(0.5)
  })

  it('groups each sentence\'s own words, including a word wrongly inserted inside it', () => {
    const result = scoreRecitation(sentences, 'I saw the huge snowfall It was magical')

    const s1 = result.sentenceResults.find((s) => s.sentenceId === 's1')!
    expect(s1.words.map((w) => w.word)).toEqual(['I', 'saw', 'the', 'huge', 'snowfall'])
    expect(s1.words.find((w) => w.word === 'huge')?.status).toBe('Extra')
    expect(s1.isQualified).toBe(true)
  })
})
