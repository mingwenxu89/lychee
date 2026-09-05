export async function preloadAudio(url: string): Promise<string> {
  // R2's presigned-URL responses only carry CORS headers on a plain 200 — a conditional
  // revalidation request (e.g. the browser deciding a cached copy needs checking) gets back a
  // 304 with no Access-Control-Allow-Origin at all, which the browser then reports as a CORS
  // failure. `no-store` keeps this fetch() from ever attempting that revalidation.
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to download audio (status ${response.status})`)
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
