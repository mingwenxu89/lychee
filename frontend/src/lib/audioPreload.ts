export async function preloadAudio(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download audio (status ${response.status})`)
  }
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}
