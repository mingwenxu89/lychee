import { compare, countWords, type WordDiff } from './textComparer'

export type SentenceRecitationResult = { sentenceId: string; words: WordDiff[]; isQualified: boolean }
export type RecitationScoreResult = { score: number; sentenceResults: SentenceRecitationResult[] }

// Walks the whole-track word diff using each sentence's known word count as a boundary,
// grouping the diffed words back into their own sentence (any Extra words seen before that
// boundary closes are attached to the sentence still open) so the result can be shown and
// scored per sentence — mirrors Full Dictation's per-sentence grading, applied after the fact
// to one continuous recitation instead of gathering it one sentence at a time.
export function scoreRecitation(sentences: { id: string; text: string }[], submittedText: string): RecitationScoreResult {
  const referenceText = sentences.map((s) => s.text).join(' ')
  const comparison = compare(referenceText, submittedText)

  const sentenceWordCounts = sentences.map((s) => countWords(s.text))
  const sentenceResults: SentenceRecitationResult[] = []

  let sentenceIndex = 0
  let wordsSeenInSentence = 0
  let correctInSentence = 0
  let currentWords: WordDiff[] = []

  for (const word of comparison.words) {
    if (sentenceIndex >= sentenceWordCounts.length) break

    currentWords.push(word)
    if (word.status === 'Extra') continue

    wordsSeenInSentence++
    if (word.status === 'Correct') correctInSentence++

    if (wordsSeenInSentence === sentenceWordCounts[sentenceIndex]) {
      const expected = sentenceWordCounts[sentenceIndex]
      sentenceResults.push({
        sentenceId: sentences[sentenceIndex].id,
        words: currentWords,
        isQualified: expected > 0 && correctInSentence === expected
      })
      sentenceIndex++
      wordsSeenInSentence = 0
      correctInSentence = 0
      currentWords = []
    }
  }

  const qualifiedCount = sentenceResults.filter((s) => s.isQualified).length
  const score = sentences.length === 0 ? 0 : qualifiedCount / sentences.length

  return { score, sentenceResults }
}
