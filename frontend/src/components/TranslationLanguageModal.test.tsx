import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { TranslationLanguageModal } from './TranslationLanguageModal'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString()
    if (url.includes('/api/learner/preferences/translation-language') && (!init || init.method === undefined)) {
      return new Response(JSON.stringify({ languageCode: 'zh' }), { status: 200 })
    }
    return new Response(null, { status: 204 })
  }))
})

describe('TranslationLanguageModal', () => {
  it('loads and shows the current preference', async () => {
    render(<TranslationLanguageModal onClose={vi.fn()} />)

    expect(await screen.findByRole('combobox')).toHaveValue('zh')
  })

  it('saves the selected language and closes', async () => {
    const onClose = vi.fn()
    render(<TranslationLanguageModal onClose={onClose} />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/preferences/translation-language', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ languageCode: 'zh' })
      }))
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('can clear the preference back to None', async () => {
    render(<TranslationLanguageModal onClose={vi.fn()} />)
    const select = await screen.findByRole('combobox')

    fireEvent.change(select, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/learner/preferences/translation-language', expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ languageCode: null })
      }))
    })
  })

  it('shows an error and does not close when the save fails', async () => {
    const onClose = vi.fn()
    vi.mocked(fetch).mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.includes('/api/learner/preferences/translation-language') && (!init || init.method === undefined)) {
        return new Response(JSON.stringify({ languageCode: 'zh' }), { status: 200 })
      }
      return new Response(null, { status: 500 })
    })

    render(<TranslationLanguageModal onClose={onClose} />)
    await screen.findByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
