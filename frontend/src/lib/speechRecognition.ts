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
    return { start: () => {}, stop: () => {} }
  }
  const recognition = new Constructor()
  recognition.continuous = true
  recognition.interimResults = false
  recognition.onresult = (event) => {
    let fullTranscript = ''
    for (let i = 0; i < event.results.length; i++) {
      fullTranscript += (fullTranscript ? ' ' : '') + event.results[i][0].transcript
    }
    onTranscriptUpdate(fullTranscript)
  }
  if (onEnd) {
    recognition.onend = onEnd
  }

  return {
    start: () => recognition.start(),
    stop: () => recognition.stop()
  }
}
