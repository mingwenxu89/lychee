import { describe, expect, it, vi, beforeEach } from 'vitest'
import { preloadAudio } from './audioPreload'

describe('preloadAudio', () => {
  beforeEach(() => {
    const fakeBlob = new Blob(['fake-audio-bytes'])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(fakeBlob, { status: 200 })))
    vi.stubGlobal('URL', { createObjectURL: vi.fn().mockReturnValue('blob:fake-object-url') })
  })

  it('fetches the URL and returns an object URL for the resulting blob', async () => {
    const objectUrl = await preloadAudio('https://example.test/audio/track.mp3')

    expect(fetch).toHaveBeenCalledWith('https://example.test/audio/track.mp3')
    expect(objectUrl).toBe('blob:fake-object-url')
  })

  it('throws when the fetch fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }))

    await expect(preloadAudio('https://example.test/audio/track.mp3')).rejects.toThrow()
  })
})
