import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// Enhance Response to handle Blob bodies properly in jsdom
const OriginalResponse = globalThis.Response

globalThis.Response = new Proxy(OriginalResponse, {
  construct(target, args) {
    const [body, init] = args
    try {
      // Try to use the original Response first
      return Reflect.construct(target, args)
    } catch (e) {
      // If it fails (e.g., with Blob bodies), use a mock
      if (e instanceof TypeError && e.message.includes('stream')) {
        const mockResponse: any = {
          body,
          status: init?.status ?? 200,
          ok: (init?.status ?? 200) >= 200 && (init?.status ?? 200) < 300,
          headers: new Map(),
          async blob() {
            if (body instanceof Blob) return body
            if (typeof body === 'string') return new Blob([body])
            return new Blob([])
          },
          async text() {
            if (typeof body === 'string') return body
            if (body instanceof Blob) return await body.text()
            return ''
          },
          async json() {
            const text = await mockResponse.text()
            return JSON.parse(text)
          }
        }
        return mockResponse
      }
      throw e
    }
  }
}) as any
