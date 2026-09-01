import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { isSpeechRecognitionSupported, createSingleUtteranceRecognizer, createContinuousRecognizer } from './speechRecognition'

class FakeSpeechRecognition {
  continuous = false
  interimResults = false
  onresult: ((event: unknown) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  stop = vi.fn()
}

describe('isSpeechRecognitionSupported', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns false when neither constructor exists', () => {
    expect(isSpeechRecognitionSupported()).toBe(false)
  })

  it('returns true when window.SpeechRecognition exists', () => {
    vi.stubGlobal('SpeechRecognition', FakeSpeechRecognition)
    expect(isSpeechRecognitionSupported()).toBe(true)
  })

  it('returns true when window.webkitSpeechRecognition exists', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeSpeechRecognition)
    expect(isSpeechRecognitionSupported()).toBe(true)
  })
})

describe('createSingleUtteranceRecognizer', () => {
  let fakeInstance: FakeSpeechRecognition

  beforeEach(() => {
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function () {
      fakeInstance = new FakeSpeechRecognition()
      return fakeInstance
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('configures non-continuous recognition and forwards the final transcript', () => {
    const onResult = vi.fn()
    const recognizer = createSingleUtteranceRecognizer(onResult)

    recognizer.start()

    expect(fakeInstance!.continuous).toBe(false)
    expect(fakeInstance!.start).toHaveBeenCalled()

    fakeInstance!.onresult!({ results: [[{ transcript: 'hello world' }]] })
    expect(onResult).toHaveBeenCalledWith('hello world')
  })

  it('calls the optional onEnd callback when recognition ends', () => {
    const onEnd = vi.fn()
    const recognizer = createSingleUtteranceRecognizer(vi.fn(), onEnd)

    recognizer.start()
    fakeInstance!.onend!()

    expect(onEnd).toHaveBeenCalled()
  })
})

describe('createContinuousRecognizer', () => {
  let fakeInstance: FakeSpeechRecognition

  beforeEach(() => {
    vi.stubGlobal('SpeechRecognition', vi.fn().mockImplementation(function () {
      fakeInstance = new FakeSpeechRecognition()
      return fakeInstance
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('configures continuous recognition and forwards accumulated transcript updates', () => {
    const onTranscriptUpdate = vi.fn()
    const recognizer = createContinuousRecognizer(onTranscriptUpdate)

    recognizer.start()

    expect(fakeInstance!.continuous).toBe(true)

    fakeInstance!.onresult!({ results: [[{ transcript: 'I saw' }], [{ transcript: 'the snowfall' }]] })
    expect(onTranscriptUpdate).toHaveBeenCalledWith('I saw the snowfall')
  })

  it('calls the optional onEnd callback when recognition ends', () => {
    const onEnd = vi.fn()
    const recognizer = createContinuousRecognizer(vi.fn(), onEnd)

    recognizer.start()
    fakeInstance!.onend!()

    expect(onEnd).toHaveBeenCalled()
  })

  it('stop() calls the underlying recognizer stop', () => {
    const recognizer = createContinuousRecognizer(vi.fn())
    recognizer.start()
    recognizer.stop()

    expect(fakeInstance!.stop).toHaveBeenCalled()
  })
})
