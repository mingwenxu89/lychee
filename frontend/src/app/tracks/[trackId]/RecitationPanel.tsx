'use client'

import { useState } from 'react'
import { isSpeechRecognitionSupported, createContinuousRecognizer } from '@/lib/speechRecognition'
import { scoreRecitation, type RecitationScoreResult } from '@/lib/recitationScoring'
import { DiffText } from '@/components/DiffText'

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 24,
  boxShadow: 'none'
}

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  borderRadius: 999,
  padding: '14px 30px',
  boxShadow: 'none',
  cursor: 'pointer'
}

const btnPrimarySmall: React.CSSProperties = {
  ...btnPrimary,
  fontSize: 14,
  padding: '11px 24px'
}

const btnGhost: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--ink-soft)',
  fontWeight: 800,
  fontSize: 16,
  border: '2px solid var(--line)',
  borderRadius: 999,
  padding: '12px 26px',
  cursor: 'pointer'
}

const btnGhostSmall: React.CSSProperties = {
  ...btnGhost,
  fontSize: 14,
  padding: '9px 20px'
}

// Neutral light gray behind the per-sentence review list on the result screen — deliberately
// hueless (unlike the app's warm --bg/--surface tones) so it reads as a distinct review area.
const resultPanelBg = 'oklch(96% 0 0)'

// Matches FullDictationView's result screens exactly — deeper green than the shared
// --leaf-dark (scoped locally there too, since --leaf-dark is used more widely elsewhere) —
// so a sentence-by-sentence recitation review reads the same way a dictation review does.
const resultCorrectColor = 'oklch(38% 0.13 145)'

export function RecitationPanel({
  trackId,
  sentences,
  onCompleted,
  onBack
}: {
  trackId: string
  sentences: { id: string; text: string }[]
  onCompleted: (accuracyScore: number) => void
  onBack: () => void
}) {
  const [transcript, setTranscript] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [result, setResult] = useState<RecitationScoreResult | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [recognizer] = useState(() => createContinuousRecognizer((text) => setTranscript(text)))

  function handleMicClick() {
    if (isRecording) {
      setIsRecording(false)
      recognizer.stop()
    } else {
      setIsRecording(true)
      recognizer.start()
    }
  }

  // Every recitation attempt is a permanent one-shot history entry regardless of score (unlike
  // dictation's retry-until-correct flow), so the result is shown immediately from the local
  // computation while the record is saved to the backend in the background.
  function handleSubmit() {
    setSubmitError(null)
    const scored = scoreRecitation(sentences, transcript)
    setResult(scored)
    fetch(`/api/learner/tracks/${trackId}/recitation-attempts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submittedText: transcript,
        score: scored.score,
        words: scored.sentenceResults.flatMap((s) => s.words),
        qualifiedSentenceIds: scored.sentenceResults.filter((s) => s.isQualified).map((s) => s.sentenceId)
      })
    }).then((response) => {
      if (!response.ok) setSubmitError('Failed to save your recitation. Please try again.')
    })
  }

  function handleReciteAgain() {
    setTranscript('')
    setResult(null)
  }

  function handleFinish() {
    if (result) onCompleted(result.score)
  }

  const backButton = (
    <button
      onClick={onBack}
      style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink-soft)', fontWeight: 800, fontSize: 15, flexShrink: 0 }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--ink-soft)" strokeWidth="2.5"><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      Back
    </button>
  )

  if (result) {
    const qualifiedCount = result.sentenceResults.filter((s) => s.isQualified).length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
        <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            {backButton}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--leaf-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Recitation Complete</h2>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>Graded sentence by sentence</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>
                {qualifiedCount} / {result.sentenceResults.length} sentences
              </span>
              <span style={{ background: 'var(--leaf-dark)', color: 'white', fontWeight: 800, fontSize: 14, borderRadius: 999, padding: '8px 18px' }}>
                {Math.round(result.score * 100)}% correct
              </span>
            </div>
          </div>

          {/* Per-sentence, like Full Dictation's result screens — each sentence's own words
              colored correct/incorrect (pure color, no checkmarks), not one continuous paragraph,
              so a wrong word still shows exactly where it is without conflating sentences. */}
          <div style={{ background: resultPanelBg, borderRadius: 16, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '50vh', overflowY: 'auto' }}>
            {result.sentenceResults.map((s, i) => (
              <div key={s.sentenceId} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ fontWeight: 800, fontSize: 13, lineHeight: '30.6px', width: 22, flexShrink: 0, color: 'var(--ink-faint)' }}>{i + 1}</span>
                <span style={{ fontSize: 17, lineHeight: 1.8, fontWeight: 400 }}>
                  <DiffText words={s.words} variant="dictation" correctColor={resultCorrectColor} incorrectColor="var(--primary)" />
                </span>
              </div>
            ))}
          </div>

          {submitError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{submitError}</p>}

          <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
            <button onClick={handleReciteAgain} style={btnGhostSmall}>Recite Again</button>
            <button onClick={handleFinish} style={btnPrimarySmall}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  const micButton = isSpeechRecognitionSupported() ? (
    <button
      onClick={handleMicClick}
      aria-label={isRecording ? 'Stop microphone' : 'Use microphone'}
      title={isRecording ? 'Stop microphone' : 'Use microphone'}
      style={{
        position: 'relative',
        width: 44,
        height: 44,
        borderRadius: 999,
        background: 'var(--primary-soft)',
        border: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        cursor: 'pointer'
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0" strokeLinecap="round" /></svg>
      {isRecording && (
        <span
          aria-label="Recording"
          className="recording-dot"
          style={{ position: 'absolute', top: 2, right: 2, width: 10, height: 10, borderRadius: 999, background: 'var(--error)' }}
        />
      )}
    </button>
  ) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, width: 760, maxWidth: '100%' }}>
      <div style={{ ...cardStyle, padding: 26, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {backButton}
          <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--ink)' }}>Recite the Full Text</span>
        </div>

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Recite the full text, or tap the mic to speak it instead"
          style={{
            width: '100%',
            border: '2px solid var(--line)',
            borderRadius: 16,
            padding: '16px 18px',
            minHeight: 260,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box'
          }}
        />

        {submitError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{submitError}</p>}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <button onClick={handleSubmit} style={btnPrimarySmall}>Submit</button>
          {micButton}
        </div>
      </div>
    </div>
  )
}
