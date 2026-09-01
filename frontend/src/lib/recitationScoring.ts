import { compare, countWords, type WordDiff } from './textComparer'

export type RecitationScoreResult = { score: number; words: WordDiff[]; qualifiedSentenceIds: string[] }

// Walks the whole-track word diff using each sentence's known word count as a
// boundary, marking a sentence "qualified" when every one of its words landed
// as Correct within that boundary — mirrors the backend's previous per-sentence
// qualification logic, now computed client-side alongside the diff itself.
export function scoreRecitation(sentences: { id: string; text: string }[], submittedText: string): RecitationScoreResult {
  const referenceText = sentences.map((s) => s.text).join(' ')
  const comparison = compare(referenceText, submittedText)

  const sentenceWordCounts = sentences.map((s) => countWords(s.text))
  const qualifiedSentenceIds: string[] = []
  let wordCursor = 0
  let sentenceIndex = 0
  let sentenceCorrectCount = 0
  let currentSentenceWordTarget = sentenceIndex < sentenceWordCounts.length ? sentenceWordCounts[sentenceIndex] : 0

  for (const word of comparison.words) {
    if (word.status === 'Extra') continue
    if (word.status === 'Correct') sentenceCorrectCount++
    wordCursor++

    if (sentenceIndex < sentenceWordCounts.length && wordCursor === currentSentenceWordTarget) {
      if (sentenceWordCounts[sentenceIndex] > 0 && sentenceCorrectCount === sentenceWordCounts[sentenceIndex]) {
        qualifiedSentenceIds.push(sentences[sentenceIndex].id)
      }
      sentenceIndex++
      sentenceCorrectCount = 0
      if (sentenceIndex < sentenceWordCounts.length) currentSentenceWordTarget += sentenceWordCounts[sentenceIndex]
    }
  }

  return { score: comparison.accuracyScore, words: comparison.words, qualifiedSentenceIds }
}
