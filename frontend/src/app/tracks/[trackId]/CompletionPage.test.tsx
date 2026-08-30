import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CompletionPage } from './CompletionPage'

describe('CompletionPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ text: 'Great work!' }), { status: 200 })
    ))
  })

  it('shows the accuracy score and a random encouragement quote', async () => {
    render(<CompletionPage accuracyScore={0.85} hasNextTrack={true} onPracticeAgain={vi.fn()} onNextTrack={vi.fn()} />)

    expect(screen.getByText(/85/)).toBeInTheDocument()
    expect(await screen.findByText('Great work!')).toBeInTheDocument()
  })

  it('Practice Again calls its handler', async () => {
    const onPracticeAgain = vi.fn()
    render(<CompletionPage accuracyScore={0.85} hasNextTrack={true} onPracticeAgain={onPracticeAgain} onNextTrack={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: /practice again/i }))

    expect(onPracticeAgain).toHaveBeenCalled()
  })

  it('shows Next Track when a next track exists', async () => {
    render(<CompletionPage accuracyScore={0.85} hasNextTrack={true} onPracticeAgain={vi.fn()} onNextTrack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /next track/i })).toBeInTheDocument()
  })

  it('shows a return button instead when there is no next track', async () => {
    render(<CompletionPage accuracyScore={0.85} hasNextTrack={false} onPracticeAgain={vi.fn()} onNextTrack={vi.fn()} />)
    expect(screen.getByRole('button', { name: /back to exercise/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^next track$/i })).not.toBeInTheDocument()
  })
})
