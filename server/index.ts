import 'dotenv/config'
import express, {Request, Response} from 'express'
import cors from 'cors'
import {fal} from '@fal-ai/client'
import OpenAI from 'openai'

// Configure fal.ai with API key
fal.config({
  credentials: process.env.FAL_API_KEY || '',
})

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const app = express()
// Broad CORS for dev across simulators/devices/tunnels
app.use(
  cors({
    origin: true,
    credentials: false,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
  }),
)
app.options('*', cors())
// Private Network Access header (helps Chrome when calling LAN IPs from secure contexts)
app.use((_, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
})
app.use(express.json({limit: '15mb'}))
app.use(express.urlencoded({extended: true, limit: '15mb'}))

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787

type GenerateRoomRequest = {
  prompt: string
  negativePrompt?: string
  seed?: number
  imageUrls?: string[]
  boxes?: Array<{x: number; y: number; w: number; h: number; label?: string}>
  model?: string
  steps?: number
  guidance?: number
}

type RoomState = {
  id: string
  seed: number
  imageUrl: string
  boxes?: Array<{x: number; y: number; w: number; h: number; label?: string}>
  productIds?: string[]
  personalityType?: string
  theme?: any
  createdAt: number
}

const rooms = new Map<string, RoomState>()

app.get('/health', (_req, res) => {
  res.json({ok: true})
})

app.post('/api/generate-room', async (req: Request, res: Response) => {
  const {
    prompt,
    negativePrompt,
    seed = Math.floor(Math.random() * 10_000_000),
    imageUrls = [],
    boxes,
    model = process.env.IMAGE_MODEL || 'openai:gpt-5-mini	',
    steps = 24,
    guidance = 5.5,
  } = req.body as GenerateRoomRequest

  if (!prompt) {
    return res.status(400).json({error: 'prompt is required'})
  }

  try {
    // If model starts with 'openai:', use OpenAI Images API instead of fal
    if (model.startsWith('openai:')) {
      const size = '1024x1024'
      // Build a compact prompt; OpenAI Images API ignores negative_prompt and boxes directly
      const openaiPrompt = prompt + (negativePrompt ? `\nAvoid: ${negativePrompt}` : '')
      const response = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: openaiPrompt,
        size,
        // You can pass references via prompt; editing/masking would use Images edit endpoint
      })
      const b64 = response.data?.[0]?.b64_json
      if (!b64) {
        return res.status(502).json({error: 'no_image_returned', message: 'OpenAI returned no image'})
      }
      // Return a data URL for simplicity; client <img> can render it directly
      return res.json({ imageUrl: `data:image/png;base64,${b64}`, seed })
    }

    const result = await fal.subscribe(model, {
      input: {
        prompt,
        negative_prompt: negativePrompt,
        seed,
        num_inference_steps: steps,
        guidance_scale: guidance,
        // Provide both single and multi image fields. Model may ignore one.
        image_url: imageUrls[0],
        image_urls: imageUrls,
        boxes,
      },
      logs: true,
      onQueueUpdate: update => {
        if (update.status === 'IN_PROGRESS') {
          update.logs?.map(log => log.message).forEach(m => console.log(m))
        }
      },
    })

    // Normalize output
    const imageUrl =
      // common shapes
      (result as any)?.images?.[0]?.url ||
      (result as any)?.output?.[0]?.url ||
      (result as any)?.image?.url ||
      null

    if (!imageUrl) {
      console.warn('fal result did not include an image URL. Keys:', Object.keys(result as any))
      return res.status(502).json({
        error: 'no_image_returned',
        message: 'Model returned no image URL. Try adjusting inputs or remove boxes/references.',
      })
    }

    return res.json({imageUrl, seed})
  } catch (err: any) {
    console.error('fal generation failed', err)
    return res.status(500).json({error: 'generation_failed', message: err?.message})
  }
})

app.post('/api/rooms', (req: Request, res: Response) => {
  const {seed, imageUrl, boxes, productIds, personalityType, theme} = req.body as Partial<RoomState>
  if (!imageUrl || typeof seed !== 'number') {
    return res.status(400).json({error: 'invalid_payload', message: 'seed and imageUrl are required'})
  }
  const id = Math.random().toString(36).slice(2, 10)
  const room: RoomState = {
    id,
    seed,
    imageUrl,
    boxes,
    productIds,
    personalityType,
    theme,
    createdAt: Date.now(),
  }
  rooms.set(id, room)
  res.json({roomId: id})
})

app.get('/api/rooms/:id', (req: Request, res: Response) => {
  const room = rooms.get(req.params.id)
  if (!room) return res.status(404).json({error: 'not_found'})
  res.json(room)
})

app.post('/api/rooms/:id/share', (req: Request, res: Response) => {
  const room = rooms.get(req.params.id)
  if (!room) return res.status(404).json({error: 'not_found'})
  const token = room.id // simple token for dev
  res.json({shareToken: token})
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})

