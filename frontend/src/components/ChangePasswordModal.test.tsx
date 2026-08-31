import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordModal } from './ChangePasswordModal'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

function fillForm(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByPlaceholderText('Current password'), { target: { value: current } })
  fireEvent.change(screen.getByPlaceholderText('New password (min 8 characters)'), { target: { value: next } })
  fireEvent.change(screen.getByPlaceholderText('Confirm new password'), { target: { value: confirm } })
}

describe('ChangePasswordModal', () => {
  it('shows an error and does not submit when the new passwords do not match', () => {
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('OldPassword1!', 'NewPassword1!', 'NewPassword2!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('New passwords do not match')).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('submits and shows a success message on a successful change', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('OldPassword1!', 'NewPassword1!', 'NewPassword1!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Your password has been changed.')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith('/api/auth/change-password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'OldPassword1!', newPassword: 'NewPassword1!' })
    }))
  })

  it('shows the backend error message when the request fails', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ message: 'Incorrect password' }), { status: 400 }))
    render(<ChangePasswordModal onClose={vi.fn()} />)

    fillForm('WrongPassword1!', 'NewPassword1!', 'NewPassword1!')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.getByText('Incorrect password')).toBeInTheDocument())
  })

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn()
    render(<ChangePasswordModal onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalled()
  })
})
