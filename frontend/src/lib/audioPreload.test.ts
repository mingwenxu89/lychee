import { describe, expect, it, vi, beforeEach } from 'vitest'
import { preloadAudio } from './audioPreload'

describe('preloadAudio', () => {
  beforeEach(() => {
    const fakeBlob = new Blob(['fake-audio-bytes'])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => fakeBlob
    }))
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:fake-object-url') })
  })

  it('fetches the URL and returns an object URL for the resulting blob', async () => {
    const objectUrl = await preloadAudio('https://example.test/audio/track.mp3')

    expect(fetch).toHaveBeenCalledWith('https://example.test/audio/track.mp3', { cache: 'no-store' })
    expect(objectUrl).toBe('blob:fake-object-url')
  })

  it('throws when the fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    await expect(preloadAudio('https://example.test/audio/track.mp3')).rejects.toThrow()
  })
})
