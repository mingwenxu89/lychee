import { describe, expect, it } from 'vitest'
import { buildBlindRoundSteps, buildFocusedRoundSteps, gradeBlindRound, computeScore } from './fullDictationEngine'

const sentences = [
  { id: 's1', text: 'Hello there.', startTime: '00:00:00', endTime: '00:00:02' },
  { id: 's2', text: 'Good morning.', startTime: '00:00:02', endTime: '00:00:04' },
  { id: 's3', text: 'How are you?', startTime: '00:00:04', endTime: '00:00:06' }
]

describe('buildBlindRoundSteps', () => {
  it('marks every sentence as requiring input when none are correct yet', () => {
    const steps = buildBlindRoundSteps(sentences, new Set())
    expect(steps).toEqual([
      { sentenceId: 's1', requiresInput: true },
      { sentenceId: 's2', requiresInput: true },
      { sentenceId: 's3', requiresInput: true }
    ])
  })

  it('marks already-correct sentences as not requiring input, in original order', () => {
    const steps = buildBlindRoundSteps(sentences, new Set(['s2']))
    expect(steps).toEqual([
      { sentenceId: 's1', requiresInput: true },
      { sentenceId: 's2', requiresInput: false },
      { sentenceId: 's3', requiresInput: true }
    ])
  })
})

describe('buildFocusedRoundSteps', () => {
  it('includes only not-yet-correct sentences, all requiring input', () => {
    const steps = buildFocusedRoundSteps(sentences, new Set(['s2']))
    expect(steps).toEqual([
      { sentenceId: 's1', requiresInput: true },
      { sentenceId: 's3', requiresInput: true }
    ])
  })

  it('returns an empty list when everything is already correct', () => {
    const steps = buildFocusedRoundSteps(sentences, new Set(['s1', 's2', 's3']))
    expect(steps).toEqual([])
  })
})

describe('gradeBlindRound', () => {
  it('returns only the sentence ids whose submitted text exactly matches', () => {
    const answers = new Map([
      ['s1', 'Hello there.'],
      ['s2', 'good afternoon'],
      ['s3', 'How are you?']
    ])
    expect(gradeBlindRound(sentences, answers)).toEqual(['s1', 's3'])
  })

  it('ignores sentence ids not present in the sentence list', () => {
    const answers = new Map([['nonexistent', 'anything']])
    expect(gradeBlindRound(sentences, answers)).toEqual([])
  })

  it('returns an empty array when nothing matches', () => {
    const answers = new Map([['s1', 'wrong answer entirely']])
    expect(gradeBlindRound(sentences, answers)).toEqual([])
  })
})

describe('computeScore', () => {
  it('computes correct/total as a fraction', () => {
    expect(computeScore(4, 3)).toBe(0.75)
  })

  it('returns 0 for zero total sentences instead of dividing by zero', () => {
    expect(computeScore(0, 0)).toBe(0)
  })
})
