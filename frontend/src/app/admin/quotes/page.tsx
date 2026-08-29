'use client'

import { useEffect, useState } from 'react'

type Quote = { id: string; text: string; isActive: boolean }

export default function QuotesAdminPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [text, setText] = useState('')

  async function loadQuotes() {
    const response = await fetch('/api/admin/encouragement-quotes')
    if (response.ok) {
      setQuotes(await response.json())
    }
  }

  useEffect(() => {
    loadQuotes()
  }, [])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    await fetch('/api/admin/encouragement-quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    })
    setText('')
    await loadQuotes()
  }

  async function toggleActive(quote: Quote) {
    await fetch(`/api/admin/encouragement-quotes/${quote.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: quote.text, isActive: !quote.isActive })
    })
    await loadQuotes()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/admin/encouragement-quotes/${id}`, { method: 'DELETE' })
    await loadQuotes()
  }

  return (
    <main>
      <h1>Encouragement Quotes</h1>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input required placeholder="Quote text" value={text} onChange={(e) => setText(e.target.value)} style={{ flex: 1 }} />
        <button type="submit">Add Quote</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {quotes.map((quote) => (
          <li key={quote.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1 }}>{quote.text}</span>
            <button onClick={() => toggleActive(quote)}>{quote.isActive ? 'Deactivate' : 'Activate'}</button>
            <button onClick={() => handleDelete(quote.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </main>
  )
}
