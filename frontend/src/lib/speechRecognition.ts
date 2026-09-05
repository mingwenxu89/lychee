type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null
}

export function createSingleUtteranceRecognizer(onResult: (text: string) => void, onEnd?: () => void) {
  const Constructor = getSpeechRecognitionConstructor()
  if (!Constructor) {
    return { start: () => {}, stop: () => {} }
  }
  const recognition = new Constructor()
  recognition.continuous = false
  recognition.interimResults = false
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript
    onResult(transcript)
  }
  if (onEnd) {
    recognition.onend = onEnd
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  }
}

export function createContinuousRecognizer(onTranscriptUpdate: (text: string) => void, onEnd?: () => void) {
  const Constructor = getSpeechRecognitionConstructor()
  if (!Constructor) {
    return { start: () => {}, stop: () => {}, resetSegment: () => {} }
  }
  const recognition = new Constructor()
  recognition.continuous = true
  recognition.interimResults = false
  // The underlying API's event.results never shrinks or resets on its own — it keeps every
  // result recognized since .start() was called. segmentStartIndex lets a caller mark "the
  // sentence boundary is here" without stopping the recognizer, so listening stays uninterrupted
  // (mic never audibly drops) while each onresult only reports text recognized since that mark.
  let segmentStartIndex = 0
  let latestResultsLength = 0
  recognition.onresult = (event) => {
    latestResultsLength = event.results.length
    let segmentTranscript = ''
    for (let i = segmentStartIndex; i < event.results.length; i++) {
      segmentTranscript += (segmentTranscript ? ' ' : '') + event.results[i][0].transcript
    }
    onTranscriptUpdate(segmentTranscript)
  }
  if (onEnd) {
    recognition.onend = onEnd
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop(),
    resetSegment: () => {
      segmentStartIndex = latestResultsLength
    }
  }
}
