// frontend/src/app/admin/exercises/[exerciseId]/units/[unitId]/tracks/[trackId]/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  useParams: () => ({ exerciseId: 'exercise-1', unitId: 'unit-1', trackId: 'track-1' })
}))

import TrackProofreadingPage from './page'
import { SUPPORTED_TRANSLATION_LANGUAGES } from '@/lib/supportedTranslationLanguages'

const exercise = { id: 'exercise-1', title: 'The Lighthouse Keeper\'s Daughter' }
const unit = { id: 'unit-1', title: 'Listening Practice' }
const track = { id: 'track-1', title: 'Chapter 1: Arrival' }
const sentence = {
  id: 'sentence-1',
  trackId: 'track-1',
  index: 1,
  text: 'Original text',
  startTime: '00:00:01',
  endTime: '00:00:02'
}

function mockFetchOnce(body: unknown, status = 200) {
  const content = status === 204 ? null : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(content, { status }))
}

function mockInitialLoad(sentences: unknown[] = [sentence], translations: unknown[] = []) {
  mockFetchOnce(exercise)
  mockFetchOnce(unit)
  mockFetchOnce(track)
  mockFetchOnce(sentences)
  mockFetchOnce(translations)
}

describe('TrackProofreadingPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  it('shows a breadcrumb through Exercises, the exercise, the unit, and the track', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)

    expect(await screen.findByText('Exercises')).toHaveAttribute('href', '/admin/exercises')
    expect(await screen.findByText('The Lighthouse Keeper\'s Daughter')).toHaveAttribute('href', '/admin/exercises/exercise-1')
    expect(await screen.findByText('Listening Practice')).toHaveAttribute('href', '/admin/exercises/exercise-1/units/unit-1')
    expect(await screen.findByText('Chapter 1: Arrival')).toBeInTheDocument()
  })

  it('shows an error and keeps the edited text when the save request fails', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)

    const textInput = await screen.findByDisplayValue('Original text')

    mockFetchOnce({ message: 'Bad Request' }, 400)

    fireEvent.change(textInput, { target: { value: 'Edited but unsaved' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save sentence 1')
    })
    expect(screen.getByDisplayValue('Edited but unsaved')).toBeInTheDocument()
  })

  it('clears any previous error and reflects the server response on a successful save', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)

    const textInput = await screen.findByDisplayValue('Original text')

    mockFetchOnce({ ...sentence, text: 'Server-confirmed text' })

    fireEvent.change(textInput, { target: { value: 'Edited text' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Server-confirmed text')).toBeInTheDocument()
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows start/end times without the always-zero hour segment, since no track ever runs an hour', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)
    await screen.findByDisplayValue('Original text')

    expect(screen.getByLabelText('Sentence 1 start time')).toHaveValue('00:01')
    expect(screen.getByLabelText('Sentence 1 end time')).toHaveValue('00:02')
  })

  it('saving an edited start time re-adds the hour segment the backend expects', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)
    await screen.findByDisplayValue('Original text')

    const startInput = screen.getByLabelText('Sentence 1 start time')
    fireEvent.change(startInput, { target: { value: '01:30' } })

    mockFetchOnce({ ...sentence, startTime: '00:01:30' })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/sentences/sentence-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Original text', startTime: '00:01:30', endTime: '00:00:02' })
      })
    })
    expect(startInput).toHaveValue('01:30')
  })

  it('highlights a row as unsaved once its text is edited, and clears after saving', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)

    const textInput = await screen.findByDisplayValue('Original text')
    const saveButton = screen.getByRole('button', { name: /^save$/i })

    fireEvent.change(textInput, { target: { value: 'Edited text' } })
    expect(saveButton).toHaveStyle({ background: 'var(--primary)' })

    mockFetchOnce({ ...sentence, text: 'Edited text' })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(saveButton).not.toHaveStyle({ background: 'var(--primary)' })
    })
  })

  it('defaults the translation language select to the first supported language', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)
    await screen.findByDisplayValue('Original text')

    expect(screen.getByLabelText('Translation language')).toHaveValue(SUPPORTED_TRANSLATION_LANGUAGES[0].code)
  })

  it('generates translations for the selected language and shows them as editable inputs', async () => {
    mockInitialLoad()
    render(<TrackProofreadingPage />)
    await screen.findByDisplayValue('Original text')

    mockFetchOnce([{ sentenceId: 'sentence-1', languageCode: 'zh', translatedText: '你好。', isManuallyEdited: false }])
    fireEvent.click(screen.getByRole('button', { name: /generate translations/i }))

    expect(await screen.findByDisplayValue('你好。')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/admin/tracks/track-1/translations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ languageCode: 'zh', overwriteManualEdits: false })
    })
  })

  it('saves an edited translation on blur', async () => {
    mockInitialLoad([sentence], [
      { sentenceId: 'sentence-1', languageCode: 'zh', translatedText: '你好。', isManuallyEdited: false }
    ])
    render(<TrackProofreadingPage />)
    const translationInput = await screen.findByDisplayValue('你好。')

    mockFetchOnce({ sentenceId: 'sentence-1', languageCode: 'zh', translatedText: '你好呀。', isManuallyEdited: true })
    fireEvent.change(translationInput, { target: { value: '你好呀。' } })
    fireEvent.blur(translationInput)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/sentences/sentence-1/translations/zh', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ translatedText: '你好呀。' })
      })
    })
  })

  it('shows a generate error and does not clear existing translations', async () => {
    mockInitialLoad([sentence], [
      { sentenceId: 'sentence-1', languageCode: 'zh', translatedText: '你好。', isManuallyEdited: false }
    ])
    render(<TrackProofreadingPage />)
    await screen.findByDisplayValue('你好。')

    mockFetchOnce({ message: 'DeepSeek API request failed' }, 400)
    fireEvent.click(screen.getByRole('button', { name: /generate translations/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('DeepSeek API request failed')
    expect(screen.getByDisplayValue('你好。')).toBeInTheDocument()
  })
})
