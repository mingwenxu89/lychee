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

// Looked up with the apostrophe already stripped from both sides (see tokenizeAndExpand), so a
// missing/wrong apostrophe — "dont" for "don't", or a smart quote autocorrect turned into
// something else — still resolves to the same expansion instead of comparing as an unrelated
// single word against the reference's two expanded words.
const CONTRACTION_EXPANSIONS_BY_STRIPPED_KEY: Record<string, string> = Object.fromEntries(
  Object.entries(CONTRACTION_EXPANSIONS).map(([key, expansion]) => [key.replace(/'/g, ''), expansion])
)

// Number words are folded to their digit value before comparison (see mergeNumberWordRuns),
// so "10" and "ten" — or "twenty-one" and "21" — compare as the same word. Only cardinals; ordinals
// ("first", "1st") aren't handled since they weren't asked for. "and" is a scale-only connector
// ("two hundred and five") and never a run on its own.
type NumberWordKind = 'ones' | 'teens' | 'tens' | 'scale'
const NUMBER_WORDS: Record<string, { value: number; kind: NumberWordKind }> = {
  zero: { value: 0, kind: 'ones' }, one: { value: 1, kind: 'ones' }, two: { value: 2, kind: 'ones' },
  three: { value: 3, kind: 'ones' }, four: { value: 4, kind: 'ones' }, five: { value: 5, kind: 'ones' },
  six: { value: 6, kind: 'ones' }, seven: { value: 7, kind: 'ones' }, eight: { value: 8, kind: 'ones' },
  nine: { value: 9, kind: 'ones' },
  ten: { value: 10, kind: 'teens' }, eleven: { value: 11, kind: 'teens' }, twelve: { value: 12, kind: 'teens' },
  thirteen: { value: 13, kind: 'teens' }, fourteen: { value: 14, kind: 'teens' }, fifteen: { value: 15, kind: 'teens' },
  sixteen: { value: 16, kind: 'teens' }, seventeen: { value: 17, kind: 'teens' }, eighteen: { value: 18, kind: 'teens' },
  nineteen: { value: 19, kind: 'teens' },
  twenty: { value: 20, kind: 'tens' }, thirty: { value: 30, kind: 'tens' }, forty: { value: 40, kind: 'tens' },
  fifty: { value: 50, kind: 'tens' }, sixty: { value: 60, kind: 'tens' }, seventy: { value: 70, kind: 'tens' },
  eighty: { value: 80, kind: 'tens' }, ninety: { value: 90, kind: 'tens' },
  hundred: { value: 100, kind: 'scale' }, thousand: { value: 1000, kind: 'scale' }, million: { value: 1_000_000, kind: 'scale' }
}

// groupId ties together the comparison units produced from one original surface word (see
// tokenizeAndExpand's contraction/hyphen splitting) so compare() can tell, after scoring, whether
// every part of that original word matched — see upgradeSplitTokenGroups.
type Token = { core: string; display: string; groupId: number }

// Scans a token stream for maximal runs of number words (e.g. "twenty", "one" or "twenty-one" —
// tokenizeAndExpand() splits the hyphenated form into the same two core tokens, just with the
// hyphen preserved on the first one's display) and merges each run into a single token whose
// core is the resulting digit string — so it lines up with a plain numeral written on the other
// side. Non-number tokens, and the display text, pass through unchanged; only the
// comparison-only `core` field is affected.
function mergeNumberWordRuns(tokens: Token[]): Token[] {
  const result: Token[] = []
  let i = 0
  while (i < tokens.length) {
    const start = i
    let total = 0
    let current = 0
    let matchedAny = false
    while (i < tokens.length) {
      const word = tokens[i].core.toLowerCase()
      const entry = NUMBER_WORDS[word]
      if (entry) {
        matchedAny = true
        if (entry.kind === 'scale') {
          current = (current === 0 ? 1 : current) * entry.value
          if (entry.value >= 1000) {
            total += current
            current = 0
          }
        } else {
          current += entry.value
        }
        i++
        continue
      }
      if (word === 'and' && matchedAny && i + 1 < tokens.length && NUMBER_WORDS[tokens[i + 1].core.toLowerCase()]) {
        i++
        continue
      }
      break
    }
    if (matchedAny) {
      // Every token's own display already carries the exact original separator that followed it
      // (see tokenizeAndExpand) — including the empty-string displays of a hyphenated number's
      // trailing parts — so concatenating with no separator of our own reproduces the original
      // text exactly, same as DiffText does with the final word list.
      const display = tokens.slice(start, i).map((t) => t.display).join('')
      result.push({ core: String(total + current), display, groupId: tokens[start].groupId })
    } else {
      result.push(tokens[start])
      i = start + 1
    }
  }
  return result
}

// Captures a word together with any punctuation directly attached to it (e.g. "there.",
// "snowfall,") so the diff can be compared on the punctuation-free core while still
// displaying the reference's real punctuation.
function tokenize(text: string): Token[] {
  const matches = text.match(/[A-Za-z0-9']+[.,!?;:]*/g) ?? []
  return matches.map((display, i) => ({ core: display.match(/^[A-Za-z0-9']+/)?.[0] ?? display, display, groupId: i }))
}

// Same as tokenize(), but every token's display also carries the *exact* original text that
// followed it up to the next token (see `trailingSeparator` below) — not a synthesized single
// space. Whatever character actually sat between two words in the reference — a plain space, a
// double space, an em dash, a stray quote, anything — is preserved byte-for-byte, because the
// display is never rebuilt from a restricted set of "known" characters. DiffText concatenates
// tokens' displays directly with no separator of its own; see its own comment for why.
//
// On top of that, two kinds of tokens are additionally split into more than one comparison unit
// — this must happen per-token, not by rewriting the whole string first, because that would also
// corrupt what gets displayed (see below for each case). Only the first resulting part keeps the
// real surface text (plus the trailing separator) as its display; later parts get an empty
// display so they render as nothing (see DiffText, which skips empty-display words) — each part
// still gets its own Correct/Incorrect/Missing status, so scoring is unaffected.
//
// 1. A hyphenated compound ("four-day") is split into its component words ("four", "day") so it
//    lines up with someone typing it as two separate words.
// 2. A known contraction ("I'm") is additionally split into its expanded parts ("i", "am") so it
//    lines up with someone spelling it out.
function tokenizeAndExpand(text: string): Token[] {
  const matches = [...text.matchAll(/[A-Za-z0-9'’]+(?:-[A-Za-z0-9'’]+)*[.,!?;:]*/g)]
  const result: Token[] = []
  matches.forEach((match, i) => {
    const raw = match[0]
    const matchEnd = match.index + raw.length
    const nextStart = i + 1 < matches.length ? matches[i + 1].index : text.length
    const trailingSeparator = text.slice(matchEnd, nextStart)

    const core = raw.match(/^[A-Za-z0-9'’]+(?:-[A-Za-z0-9'’]+)*/)?.[0] ?? raw
    const expansion = CONTRACTION_EXPANSIONS_BY_STRIPPED_KEY[core.replace(/['’]/g, '').toLowerCase()]
    const parts = expansion ? expansion.split(' ') : core.split('-')
    parts.forEach((part, partIndex) => {
      result.push({ core: part, display: partIndex === 0 ? raw + trailingSeparator : '', groupId: i })
    })
  })
  return result
}

// Apostrophes are stripped here (not just in the contraction lookup above) so any other
// apostrophe mismatch — a possessive typed without one ("Sarahs" for "Sarah's"), a smart vs.
// straight quote, one missing from a contraction that isn't in the expansion table — still
// compares as the same word. Punctuation other than the apostrophe never reaches this function
// at all: tokenize()/tokenizeAndExpand() only capture it into `display`, never into `core`.
function normalize(word: string): string {
  return word.toLowerCase().replace(/['’]/g, '')
}

export function countWords(text: string): number {
  return tokenize(text).length
}

export function compare(referenceText: string, submittedText: string): ComparisonResult {
  const refWords = mergeNumberWordRuns(tokenizeAndExpand(referenceText))
  const subWords = mergeNumberWordRuns(tokenizeAndExpand(submittedText))
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

  // groupIds runs parallel to words: the groupId of the ref token an entry came from (Correct/
  // Incorrect/Missing always pull from refWords), or null for an Extra entry (pulled from
  // subWords, which never needs the upgrade pass below).
  const words: WordDiff[] = []
  const groupIds: (number | null)[] = []
  let correctCount = 0
  let refIndex = 0
  let subIndex = 0

  while (refIndex < n && subIndex < m) {
    if (refNorm[refIndex] === subNorm[subIndex]) {
      words.push({ word: refWords[refIndex].display, status: 'Correct' })
      groupIds.push(refWords[refIndex].groupId)
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
      groupIds.push(refWords[refIndex].groupId)
      refIndex++
      subIndex++
    } else if (deleteScore >= insertScore) {
      words.push({ word: refWords[refIndex].display, status: 'Missing' })
      groupIds.push(refWords[refIndex].groupId)
      refIndex++
    } else {
      words.push({ word: subWords[subIndex].display, status: 'Extra' })
      groupIds.push(null)
      subIndex++
    }
  }

  while (refIndex < n) {
    words.push({ word: refWords[refIndex].display, status: 'Missing' })
    groupIds.push(refWords[refIndex].groupId)
    refIndex++
  }

  while (subIndex < m) {
    words.push({ word: subWords[subIndex].display, status: 'Extra' })
    groupIds.push(null)
    subIndex++
  }

  upgradeSplitTokenGroups(words, groupIds)

  const accuracyScore = n === 0 ? (m === 0 ? 1.0 : 0.0) : correctCount / n
  const isExactMatch = computeIsExactMatch(words)

  return { words, accuracyScore, isExactMatch }
}

// A reference word split into multiple comparison units (a contraction like "we're" -> "we" +
// "are", or a hyphenated compound) only shows its FIRST part's text — the rest render as nothing
// (see tokenizeAndExpand). If that first part happens to match but a later, invisible sibling
// doesn't, the mismatch would otherwise vanish entirely: the learner sees a plain, unflagged
// "we're" even though they never typed "are". This upgrades the visible part's status to the
// worst status found among its siblings — but only when the visible part was itself Correct: a
// part that's already Incorrect/Missing already shows the problem, and is left alone rather than
// downgraded further. A sibling's own independent Correct status is also left alone (e.g. "day"
// in "four-day" separately matching the submission's own "day") — hyphenated halves are still
// scored as independent words, not folded into one all-or-nothing unit.
function upgradeSplitTokenGroups(words: WordDiff[], groupIds: (number | null)[]): void {
  const rank: Record<WordDiffStatus, number> = { Correct: 0, Extra: 0, Incorrect: 1, Missing: 2 }
  const worstByGroup = new Map<number, WordDiffStatus>()
  words.forEach((w, i) => {
    const groupId = groupIds[i]
    if (groupId === null) return
    const current = worstByGroup.get(groupId)
    if (current === undefined || rank[w.status] > rank[current]) worstByGroup.set(groupId, w.status)
  })
  words.forEach((w, i) => {
    const groupId = groupIds[i]
    if (groupId === null || w.word === '' || w.status !== 'Correct') return
    const worst = worstByGroup.get(groupId)
    if (worst && worst !== 'Correct') w.status = worst
  })
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
