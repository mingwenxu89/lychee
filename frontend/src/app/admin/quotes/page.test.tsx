// frontend/src/app/admin/quotes/page.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import QuotesAdminPage from './page'

const quote = { id: 'quote-1', text: 'Nice work — every sentence counts!', isActive: true }

function mockFetchOnce(body: unknown, status = 200) {
  const content = status === 204 ? null : JSON.stringify(body)
  vi.mocked(fetch).mockResolvedValueOnce(new Response(content, { status }))
}

describe('QuotesAdminPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockFetchOnce([quote])
  })

  it('renders the quote list', async () => {
    render(<QuotesAdminPage />)

    expect(await screen.findByText('Nice work — every sentence counts!')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('creates a new quote via the modal and reloads the list', async () => {
    render(<QuotesAdminPage />)
    await screen.findByText('Nice work — every sentence counts!')

    fireEvent.click(screen.getByRole('button', { name: /new quote/i }))
    fireEvent.change(screen.getByLabelText('Quote'), { target: { value: 'Keep going, you are doing great!' } })

    mockFetchOnce({ id: 'quote-2', text: 'Keep going, you are doing great!', isActive: true }, 201)
    mockFetchOnce([quote, { id: 'quote-2', text: 'Keep going, you are doing great!', isActive: true }])

    fireEvent.click(screen.getByRole('button', { name: /add quote/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'Keep going, you are doing great!' })
      })
    })
    expect(await screen.findByText('Keep going, you are doing great!')).toBeInTheDocument()
  })

  it('toggles active status', async () => {
    render(<QuotesAdminPage />)
    await screen.findByText('Nice work — every sentence counts!')

    mockFetchOnce({ ...quote, isActive: false })
    mockFetchOnce([{ ...quote, isActive: false }])

    fireEvent.click(screen.getByRole('button', { name: /^deactivate$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/quotes/quote-1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: quote.text, isActive: false })
      })
    })
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  it('deletes a quote after confirming', async () => {
    render(<QuotesAdminPage />)
    await screen.findByText('Nice work — every sentence counts!')

    fireEvent.click(screen.getByRole('button', { name: /delete quote/i }))
    expect(screen.getByText('Delete this quote?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText('Delete this quote?')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete quote/i }))

    mockFetchOnce(undefined, 204)
    mockFetchOnce([])

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/admin/quotes/quote-1', { method: 'DELETE' })
    })
    await waitFor(() => {
      expect(screen.queryByText('Nice work — every sentence counts!')).not.toBeInTheDocument()
    })
  })
})
