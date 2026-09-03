import { compare } from '@/lib/textComparer'

export type DictationSentence = { id: string; text: string; startTime: string; endTime: string }
export type RoundStep = { sentenceId: string; requiresInput: boolean }

export function buildBlindRoundSteps(sentences: DictationSentence[], correctIds: ReadonlySet<string>): RoundStep[] {
  return sentences.map((s) => ({ sentenceId: s.id, requiresInput: !correctIds.has(s.id) }))
}

export function buildFocusedRoundSteps(sentences: DictationSentence[], correctIds: ReadonlySet<string>): RoundStep[] {
  return sentences.filter((s) => !correctIds.has(s.id)).map((s) => ({ sentenceId: s.id, requiresInput: true }))
}

// Batch-grades a blind round's collected answers against the reference sentences, returning
// the sentence ids that are now correct — the caller unions this into its accumulated correct
// set. Reuses the exact same compare() logic as By Sentence mode's per-sentence check.
export function gradeBlindRound(
  sentences: DictationSentence[],
  submittedAnswers: ReadonlyMap<string, string>
): string[] {
  const newlyCorrect: string[] = []
  for (const [sentenceId, submitted] of submittedAnswers) {
    const sentence = sentences.find((s) => s.id === sentenceId)
    if (!sentence) continue
    if (compare(sentence.text, submitted).isExactMatch) newlyCorrect.push(sentenceId)
  }
  return newlyCorrect
}

export function computeScore(totalSentences: number, correctCount: number): number {
  return totalSentences === 0 ? 0 : correctCount / totalSentences
}
