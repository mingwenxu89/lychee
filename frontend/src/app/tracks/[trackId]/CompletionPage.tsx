'use client'

import { useEffect, useState } from 'react'

export function CompletionPage({
  accuracyScore,
  hasNextTrack,
  onPracticeAgain,
  onNextTrack
}: {
  accuracyScore: number
  hasNextTrack: boolean
  onPracticeAgain: () => void
  onNextTrack: () => void
}) {
  const [quote, setQuote] = useState<string | null>(null)

  useEffect(() => {
    async function loadQuote() {
      const response = await fetch('/api/learner/encouragement-quotes/random')
      if (response.ok) {
        const data = await response.json()
        setQuote(data.text)
      }
    }
    loadQuote()
  }, [])

  return (
    <div>
      <h2>Nice work!</h2>
      <p>{Math.round(accuracyScore * 100)}% accuracy</p>
      {quote && <p>{quote}</p>}
      <button onClick={onPracticeAgain}>Practice Again</button>
      {hasNextTrack ? (
        <button onClick={onNextTrack}>Next Track</button>
      ) : (
        <button onClick={onNextTrack}>Back to Exercise</button>
      )}
    </div>
  )
}
