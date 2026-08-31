'use client'

import { useState } from 'react'
import { changePassword } from '@/lib/apiClient'

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'oklch(22% 0.03 270 / 0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100
}

const modalStyle: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: 16,
  padding: 24,
  width: 340,
  display: 'flex',
  flexDirection: 'column',
  gap: 12
}

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }

    try {
      await changePassword(currentPassword, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change password')
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(event) => event.stopPropagation()}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Change Password</h2>

        {success ? (
          <>
            <p>Your password has been changed.</p>
            <button type="button" onClick={onClose}>Close</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input
              type="password"
              required
              placeholder="Current password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="New password (min 8 characters)"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
            />
            <input
              type="password"
              required
              minLength={8}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
            {error && <p role="alert" style={{ color: 'var(--error)', margin: 0 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit">Save</button>
              <button type="button" onClick={onClose}>Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
