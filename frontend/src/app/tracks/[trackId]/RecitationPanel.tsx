'use client'

import { useState } from 'react'
import { isSpeechRecognitionSupported, createContinuousRecognizer } from '@/lib/speechRecognition'
import { DiffText, type WordDiff } from '@/components/DiffText'

type RecitationResult = { id: string; score: number; words: WordDiff[]; qualifiedSentenceIds: string[]; createdAt: string }

const btnPrimary: React.CSSProperties = {
  background: 'var(--primary)',
  color: 'white',
  fontWeight: 800,
  fontSize: 16,
  border: 'none',
  borderRadius: 999,
  padding: '14px 30px',
  boxShadow: '0 5px 0 var(--primary-dark)',
  cursor: 'pointer'
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

const statBox: React.CSSProperties = {
  background: 'oklch(96% 0.01 80)',
  borderRadius: 16,
  padding: '12px 20px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  alignItems: 'center'
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(22% 0.03 270 / 0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10
}

const modalStyle: React.CSSProperties = {
  width: 560,
  maxWidth: '92vw',
  background: 'var(--surface)',
  borderRadius: 28,
  boxShadow: '0 14px 0 var(--line), 0 22px 44px oklch(22% 0.03 270 / 0.22)',
  padding: '36px 40px',
  display: 'flex',
  flexDirection: 'column',
  gap: 20
}

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
    const errorCount = result.words.filter((w) => w.status !== 'Correct').length
    return (
      <div style={overlayStyle}>
        <div style={modalStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--leaf-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--leaf-dark)" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Recitation Complete</h2>
                <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>One continuous reading, compared</span>
              </div>
            </div>
            <span style={{ background: 'var(--leaf-dark)', color: 'white', fontWeight: 800, fontSize: 14, borderRadius: 999, padding: '8px 18px' }}>
              {Math.round(result.score * 100)}% correct
            </span>
          </div>

          <div style={{ display: 'flex', gap: 14 }}>
            <div style={statBox}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{result.qualifiedSentenceIds.length}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)' }}>Sentences Nailed</span>
            </div>
            <div style={statBox}>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--error)' }}>{errorCount}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-faint)' }}>Errors</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink-faint)' }}>Full-text comparison</span>
            <div style={{ background: 'oklch(96% 0.01 80)', borderRadius: 16, padding: '20px 22px', fontSize: 16, lineHeight: 2, fontWeight: 600, maxHeight: 220, overflowY: 'auto' }}>
              <DiffText words={result.words} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, justifyContent: 'flex-end' }}>
            <button onClick={handleReciteAgain} style={btnGhost}>Recite Again</button>
            <button onClick={handleFinish} style={btnPrimary}>Done</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Recite the Full Text</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--ink-faint)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {isSpeechRecognitionSupported() && (
          <div>
            {!isRecording ? (
              <button
                aria-label="start recording"
                onClick={handleStartRecording}
                style={{ ...btnPrimary, display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /></svg>
                Start Recording
              </button>
            ) : (
              <button onClick={handleStopRecording} style={{ ...btnGhost, borderColor: 'var(--error)', color: 'var(--error)' }}>
                Stop Recording
              </button>
            )}
          </div>
        )}

        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Recite the full text, or type it here"
          style={{
            border: '2px solid var(--line)',
            borderRadius: 16,
            padding: '16px 18px',
            minHeight: 120,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--ink)',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
        {submitError && <p role="alert" style={{ color: 'var(--error)', fontWeight: 700, margin: 0 }}>{submitError}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={handleSubmit} style={btnPrimary}>Submit</button>
        </div>
      </div>
    </div>
  )
}
