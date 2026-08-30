'use client'

import { useState } from 'react'
import { isSpeechRecognitionSupported, createContinuousRecognizer } from '@/lib/speechRecognition'
import { DiffText, type WordDiff } from '@/components/DiffText'

type RecitationResult = { id: string; score: number; words: WordDiff[]; qualifiedSentenceIds: string[]; createdAt: string }

export function RecitationPanel({
  trackId,
  onCompleted,
  onClose
}: {
  trackId: string
  onCompleted: (accuracyScore: number) => void
  onClose: () => void
}) {
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [result, setResult] = useState<RecitationResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recognizer] = useState(() => createContinuousRecognizer((text) => setTranscript(text)))

  function handleStartRecording() {
    setIsRecording(true)
    recognizer.start()
  }

  function handleStopRecording() {
    setIsRecording(false)
    recognizer.stop()
  }

  async function handleSubmit() {
    setSubmitError(null)
    const response = await fetch(`/api/learner/tracks/${trackId}/recitation-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submittedText: transcript })
    })
    if (!response.ok) {
      setSubmitError('Failed to submit your recitation. Please try again.')
      return
    }
    setResult(await response.json())
  }

  function handleReciteAgain() {
    setTranscript('')
    setResult(null)
  }

  function handleFinish() {
    if (result) onCompleted(result.score)
  }

  if (result) {
    return (
      <div>
        <DiffText words={result.words} />
        <p>{Math.round(result.score * 100)}% accuracy</p>
        <button onClick={handleReciteAgain}>Recite Again</button>
        <button onClick={handleFinish}>Finish</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={onClose}>Close</button>

      {isSpeechRecognitionSupported() && (
        <div>
          {!isRecording ? (
            <button aria-label="start recording" onClick={handleStartRecording}>Start Recording</button>
          ) : (
            <button onClick={handleStopRecording}>Stop Recording</button>
          )}
        </div>
      )}

      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder="Recite the full text, or type it here"
      />
      {submitError && <p role="alert">{submitError}</p>}
      <button onClick={handleSubmit}>Submit</button>
    </div>
  )
}
