export type WordDiffStatus = 'Correct' | 'Incorrect' | 'Missing' | 'Extra'
export type WordDiff = { word: string; status: WordDiffStatus }
export type ComparisonResult = { words: WordDiff[]; accuracyScore: number; isExactMatch: boolean }

// Only the single most common expansion is used for ambiguous contractions
// (e.g. "he's" -> "he is", not "he has"; "I'd" -> "I would", not "I had") —
// good enough for comparing spoken/typed answers against a reference
// sentence, not a general-purpose English parser.
const CONTRACTION_EXPANSIONS: Record<string, string> = {
  "i'm": 'i am',
  "i've": 'i have',
  "i'll": 'i will',
  "i'd": 'i would',
  "you're": 'you are',
  "you've": 'you have',
  "you'll": 'you will',
  "you'd": 'you would',
  "he's": 'he is',
  "she's": 'she is',
  "it's": 'it is',
  "we're": 'we are',
  "we've": 'we have',
  "we'll": 'we will',
  "we'd": 'we would',
  "they're": 'they are',
  "they've": 'they have',
  "they'll": 'they will',
  "they'd": 'they would',
  "that's": 'that is',
  "that'll": 'that will',
  "who's": 'who is',
  "what's": 'what is',
  "where's": 'where is',
  "there's": 'there is',
  "here's": 'here is',
  "let's": 'let us',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "can't": 'cannot',
  "won't": 'will not',
  "wouldn't": 'would not',
  "shouldn't": 'should not',
  "couldn't": 'could not',
  "mustn't": 'must not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not'
}

function expandContractions(text: string): string {
  return text.replace(/[A-Za-z]+['’][A-Za-z]+/g, (match) => {
    const key = match.replace('’', "'").toLowerCase()
    return CONTRACTION_EXPANSIONS[key] ?? match
  })
}

type Token = { core: string; display: string }

// Captures a word together with any punctuation directly attached to it (e.g. "there.",
// "snowfall,") so the diff can be compared on the punctuation-free core while still
// displaying the reference's real punctuation.
function tokenize(text: string): Token[] {
  const matches = text.match(/[A-Za-z0-9']+[.,!?;:]*/g) ?? []
  return matches.map((display) => ({ core: display.match(/^[A-Za-z0-9']+/)?.[0] ?? display, display }))
}

function normalize(word: string): string {
  return word.toLowerCase()
}

export function countWords(text: string): number {
  return tokenize(text).length
}

export function compare(referenceText: string, submittedText: string): ComparisonResult {
  const expandedReference = expandContractions(referenceText)
  const expandedSubmitted = expandContractions(submittedText)

  const refWords = tokenize(expandedReference)
  const subWords = tokenize(expandedSubmitted)
  const refNorm = refWords.map((t) => normalize(t.core))
  const subNorm = subWords.map((t) => normalize(t.core))

  const n = refNorm.length
  const m = subNorm.length

  // lcs[i][j] = length of the longest common subsequence of refNorm[i..] and subNorm[j..]
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = refNorm[i] === subNorm[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const words: WordDiff[] = []
  let correctCount = 0
  let refIndex = 0
  let subIndex = 0

  while (refIndex < n && subIndex < m) {
    if (refNorm[refIndex] === subNorm[subIndex]) {
      words.push({ word: refWords[refIndex].display, status: 'Correct' })
      correctCount++
      refIndex++
      subIndex++
      continue
    }

    const substitutionScore = lcs[refIndex + 1][subIndex + 1]
    const deleteScore = lcs[refIndex + 1][subIndex]
    const insertScore = lcs[refIndex][subIndex + 1]

    if (substitutionScore >= deleteScore && substitutionScore >= insertScore) {
      words.push({ word: refWords[refIndex].display, status: 'Incorrect' })
      refIndex++
      subIndex++
    } else if (deleteScore >= insertScore) {
      words.push({ word: refWords[refIndex].display, status: 'Missing' })
      refIndex++
    } else {
      words.push({ word: subWords[subIndex].display, status: 'Extra' })
      subIndex++
    }
  }

  while (refIndex < n) {
    words.push({ word: refWords[refIndex].display, status: 'Missing' })
    refIndex++
  }

  while (subIndex < m) {
    words.push({ word: subWords[subIndex].display, status: 'Extra' })
    subIndex++
  }

  const accuracyScore = n === 0 ? (m === 0 ? 1.0 : 0.0) : correctCount / n
  const isExactMatch = computeIsExactMatch(words)

  return { words, accuracyScore, isExactMatch }
}

// The reference sentence counts as fully matched if it appears anywhere in the
// submission as one unbroken run — extra words before and/or after are allowed
// (the learner said/typed more than the sentence), but a word inserted *inside*
// the reference breaks continuity and must not count as a match.
function computeIsExactMatch(words: WordDiff[]): boolean {
  if (words.some((w) => w.status === 'Incorrect' || w.status === 'Missing')) {
    return false
  }

  const firstCorrect = words.findIndex((w) => w.status === 'Correct')
  if (firstCorrect === -1) {
    return words.length === 0
  }

  let lastCorrect = -1
  for (let k = words.length - 1; k >= 0; k--) {
    if (words[k].status === 'Correct') {
      lastCorrect = k
      break
    }
  }

  for (let k = firstCorrect; k <= lastCorrect; k++) {
    if (words[k].status !== 'Correct') return false
  }

  return true
}
