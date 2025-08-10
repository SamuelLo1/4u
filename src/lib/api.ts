export type GenerateRoomResponse = {
  imageUrl: string | null
  seed: number
}

function resolveApiBase(): string {
  // Prefer explicit env config
  const envBase = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined
  if (envBase) return envBase

  // Fallbacks for common dev scenarios
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  // Android emulator -> host loopback
  if (/android/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')) {
    return 'http://10.0.2.2:8787'
  }
  // iOS simulator and desktop preview usually can reach localhost
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8787'
  }
  // Otherwise assume same LAN host on default port
  return `http://${hostname}:8787`
}

const API_BASE = resolveApiBase()

export async function generateRoom(params: {
  prompt: string
  negativePrompt?: string
  seed?: number
  imageUrls?: string[]
  boxes?: Array<{x: number; y: number; w: number; h: number; label?: string}>
  model?: string
}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 70000)
  const resp = await fetch(`${API_BASE}/api/generate-room`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))
  if (!resp.ok) {
    let message = 'Generation failed'
    try {
      const text = await resp.text()
      try {
        const j = JSON.parse(text)
        message = j?.message || j?.error || message
      } catch {
        message = text || message
      }
    } catch {}
    throw new Error(message)
  }
  return (await resp.json()) as GenerateRoomResponse
}

export async function saveRoom(payload: {
  seed: number
  imageUrl: string
  boxes?: Array<{x: number; y: number; w: number; h: number; label?: string}>
  productIds?: string[]
  personalityType?: string
  theme?: any
}) {
  const resp = await fetch(`${API_BASE}/api/rooms`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  })
  if (!resp.ok) throw new Error('Save failed')
  return (await resp.json()) as {roomId: string}
}

export async function loadRoom(roomId: string) {
  const resp = await fetch(`${API_BASE}/api/rooms/${roomId}`)
  if (!resp.ok) throw new Error('Load failed')
  return await resp.json()
}

export async function shareRoom(roomId: string) {
  const resp = await fetch(`${API_BASE}/api/rooms/${roomId}/share`, {method: 'POST'})
  if (!resp.ok) throw new Error('Share failed')
  return (await resp.json()) as {shareToken: string}
}

export async function composeRoom(params: {
  prompt: string
  productUrls: string[]
  paletteHint?: string
  size?: '1024x1024' | '1536x1024' | '1024x1536'
}) {
  const resp = await fetch(`${API_BASE}/api/compose-room`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  })
  if (!resp.ok) throw new Error('Compose failed')
  return (await resp.json()) as {imageUrl: string}
}

export async function composePhasedBase(params: {prompt: string; paletteHint?: string; size?: string}) {
  const resp = await fetch(`${API_BASE}/api/base-room`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  })
  if (!resp.ok) throw new Error('Base failed')
  return (await resp.json()) as {baseB64: string}
}

export async function composePhasedStylize(url: string) {
  const resp = await fetch(`${API_BASE}/api/stylize-product`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({url}),
  })
  if (!resp.ok) throw new Error('Stylize failed')
  return (await resp.json()) as {spriteB64: string}
}

export async function composePhasedFinalize(baseB64: string, spriteB64s: string[]) {
  const resp = await fetch(`${API_BASE}/api/compose-final`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({baseB64, spriteB64s}),
  })
  if (!resp.ok) throw new Error('Compose finalize failed')
  return (await resp.json()) as {imageUrl: string}
}

export async function generateDailyQuestions(params: {
  userAnswers: Array<{
    questionId: string
    choiceId: string
    choiceText: string
    tags: string[]
  }>
  previousDailyQuestions?: Array<{
    date: string
    questions: Array<{
      id: string
      text: string
      choices: Array<{
        id: string
        text: string
        tags: string[]
      }>
    }>
  }>
}) {
  const resp = await fetch(`${API_BASE}/api/generate-daily-questions`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(params),
  })
  if (!resp.ok) {
    const error = await resp.json().catch(() => ({}))
    throw new Error(error.message || 'Failed to generate daily questions')
  }
  return (await resp.json()) as {
    questions: Array<{
      id: string
      text: string
      choices: Array<{
        id: string
        text: string
        tags: string[]
      }>
    }>
    generatedAt: string
    userTags: string[]
  }
}

