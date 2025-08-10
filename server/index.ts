import 'dotenv/config'
import express, {Request, Response} from 'express'
import cors from 'cors'
import OpenAI, {toFile} from 'openai'

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

type ComposeRequest = {
  prompt: string
  productUrls: string[]
  paletteHint?: string
  size?: '1024x1024' | '1536x1024' | '1024x1536'
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
      const openaiModel = (model.replace('openai:', '') || 'gpt-image-1').trim()
      const openaiPrompt = prompt + (negativePrompt ? `\nAvoid: ${negativePrompt}` : '')

      // If we have reference images, try Images Edit with multiple inputs
      if (Array.isArray(imageUrls) && imageUrls.length > 0) {
        try {
          const files: File[] = []
          const maxRefs = Math.min(imageUrls.length, 6)
          for (let i = 0; i < maxRefs; i++) {
            const url = imageUrls[i]
            try {
              const resp = await fetch(url)
              if (!resp.ok) continue
              const contentType = resp.headers.get('content-type') || 'image/jpeg'
              const buf = Buffer.from(await resp.arrayBuffer())
              const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
              const file = await toFile(buf, `ref-${i}.${ext}`, {type: contentType})
              files.push(file as any)
            } catch (e) {
              console.warn('failed to fetch reference image', url, e)
            }
          }
          if (files.length > 0) {
            const response = await openai.images.edit({
              model: openaiModel,
              image: files,
              prompt: openaiPrompt,
              size,
            })
            const b64 = response.data?.[0]?.b64_json
            if (!b64) {
              return res.status(502).json({error: 'no_image_returned', message: 'OpenAI edit returned no image'})
            }
            return res.json({imageUrl: `data:image/png;base64,${b64}`, seed})
          }
        } catch (e) {
          console.warn('OpenAI edit failed, falling back to generate', e)
        }
      }

      // Fallback: text-to-image generate
      const response = await openai.images.generate({
        model: openaiModel,
        prompt: openaiPrompt,
        size,
      })
      const b64 = response.data?.[0]?.b64_json
      if (!b64) {
        return res.status(502).json({error: 'no_image_returned', message: 'OpenAI returned no image'})
      }
      return res.json({imageUrl: `data:image/png;base64,${b64}`, seed})
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

// Plan C: generate base room then compose stylized sprites server-side
import sharp from 'sharp'

async function generateBaseRoomImage(openaiModel: string, prompt: string, negativePrompt?: string, size: string = '1024x1024') {
  const openaiPrompt = prompt + (negativePrompt ? `\nAvoid: ${negativePrompt}` : '')
  const response = await openai.images.generate({
    model: openaiModel,
    prompt: openaiPrompt,
    size,
  })
  const b64 = response.data?.[0]?.b64_json
  if (!b64) throw new Error('no_base_image')
  return Buffer.from(b64, 'base64')
}

async function stylizeProductToPixel(openaiModel: string, url: string) {
  // Use images.edit with a simple prompt to convert to pixel-art sprite
  // For simplicity: run generate with a text prompt referencing the image content is not supported.
  // Here we download the image and ask edit to stylize it alone (mask not needed when full replacement).
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('product_fetch_failed')
  const contentType = resp.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await resp.arrayBuffer())
  const file = await toFile(buf, `product.${contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'}`, {type: contentType})
  const r = await openai.images.edit({
    model: openaiModel,
    image: [file],
    prompt: 'Convert this product into a clean isometric pixel-art sprite with transparent background, consistent with retro game style.',
    background: 'transparent',
    size: '1024x1024',
  })
  const b64 = r.data?.[0]?.b64_json
  if (!b64) throw new Error('no_sprite_image')
  return Buffer.from(b64, 'base64')
}

app.post('/api/compose-room', async (req: Request, res: Response) => {
  const {prompt, productUrls, paletteHint, size = '1024x1024'} = req.body as ComposeRequest
  if (!prompt || !Array.isArray(productUrls)) return res.status(400).json({error: 'invalid_payload'})
  try {
    const openaiModel = (process.env.IMAGE_MODEL?.startsWith('openai:') ? process.env.IMAGE_MODEL.replace('openai:', '') : 'gpt-image-1')!.trim()
    const base = await generateBaseRoomImage(openaiModel, `${prompt} ${paletteHint ? `(palette: ${paletteHint})` : ''}`)

    // Stylize first N products into sprites
    const limit = Math.min(productUrls.length, 4)
    const sprites: Buffer[] = []
    for (let i = 0; i < limit; i++) {
      try {
        const sprite = await stylizeProductToPixel(openaiModel, productUrls[i])
        sprites.push(sprite)
      } catch (e) {
        console.warn('sprite stylize failed for', productUrls[i])
      }
    }

    // Compose: place sprites roughly in quadrants with alpha over base
    let canvas = sharp(base).png()
    const meta = await sharp(base).metadata()
    const W = meta.width || 1024
    const H = meta.height || 1024
    const placements = [
      {x: Math.round(W*0.15), y: Math.round(H*0.55)},
      {x: Math.round(W*0.60), y: Math.round(H*0.55)},
      {x: Math.round(W*0.20), y: Math.round(H*0.80)},
      {x: Math.round(W*0.65), y: Math.round(H*0.80)},
    ]
    const COMPOSE_W = Math.round(W*0.28)
    const COMPOSE_H = Math.round(H*0.28)

    const composites: sharp.OverlayOptions[] = []
    for (let i = 0; i < sprites.length; i++) {
      const resized = await sharp(sprites[i]).resize(COMPOSE_W, COMPOSE_H, {fit: 'inside'}).png().toBuffer()
      composites.push({input: resized, left: placements[i].x, top: placements[i].y})
    }
    if (composites.length > 0) {
      canvas = canvas.composite(composites)
    }
    const finalBuf = await canvas.png().toBuffer()
    const dataUrl = `data:image/png;base64,${finalBuf.toString('base64')}`
    res.json({imageUrl: dataUrl})
  } catch (e: any) {
    console.error('compose-room failed', e)
    res.status(500).json({error: 'compose_failed', message: e?.message})
  }
})

// Plan C (phased) endpoints for client-visible progress
app.post('/api/base-room', async (req: Request, res: Response) => {
  const {prompt, paletteHint, size = '1024x1024'} = req.body as {prompt: string; paletteHint?: string; size?: string}
  if (!prompt) return res.status(400).json({error: 'invalid_payload'})
  try {
    const openaiModel = (process.env.IMAGE_MODEL?.startsWith('openai:') ? process.env.IMAGE_MODEL.replace('openai:', '') : 'gpt-image-1')!.trim()
    const base = await generateBaseRoomImage(openaiModel, `${prompt} ${paletteHint ? `(palette: ${paletteHint})` : ''}`, undefined, size)
    res.json({baseB64: base.toString('base64')})
  } catch (e: any) {
    console.error('base-room failed', e)
    res.status(500).json({error: 'base_failed', message: e?.message})
  }
})

app.post('/api/stylize-product', async (req: Request, res: Response) => {
  const {url} = req.body as {url: string}
  if (!url) return res.status(400).json({error: 'invalid_payload'})
  try {
    const openaiModel = (process.env.IMAGE_MODEL?.startsWith('openai:') ? process.env.IMAGE_MODEL.replace('openai:', '') : 'gpt-image-1')!.trim()
    const sprite = await stylizeProductToPixel(openaiModel, url)
    res.json({spriteB64: sprite.toString('base64')})
  } catch (e: any) {
    console.error('stylize-product failed', e)
    res.status(500).json({error: 'stylize_failed', message: e?.message})
  }
})

app.post('/api/compose-final', async (req: Request, res: Response) => {
  const {baseB64, spriteB64s} = req.body as {baseB64: string; spriteB64s: string[]}
  if (!baseB64 || !Array.isArray(spriteB64s)) return res.status(400).json({error: 'invalid_payload'})
  try {
    const base = Buffer.from(baseB64, 'base64')
    const sprites = spriteB64s.map(s => Buffer.from(s, 'base64'))
    let canvas = sharp(base).png()
    const meta = await sharp(base).metadata()
    const W = meta.width || 1024
    const H = meta.height || 1024
    const placements = [
      {x: Math.round(W*0.15), y: Math.round(H*0.55)},
      {x: Math.round(W*0.60), y: Math.round(H*0.55)},
      {x: Math.round(W*0.20), y: Math.round(H*0.80)},
      {x: Math.round(W*0.65), y: Math.round(H*0.80)},
    ]
    const COMPOSE_W = Math.round(W*0.28)
    const COMPOSE_H = Math.round(H*0.28)
    const composites: sharp.OverlayOptions[] = []
    for (let i = 0; i < sprites.length && i < placements.length; i++) {
      const resized = await sharp(sprites[i]).resize(COMPOSE_W, COMPOSE_H, {fit: 'inside'}).png().toBuffer()
      composites.push({input: resized, left: placements[i].x, top: placements[i].y})
    }
    if (composites.length > 0) canvas = canvas.composite(composites)
    const finalBuf = await canvas.png().toBuffer()
    res.json({imageUrl: `data:image/png;base64,${finalBuf.toString('base64')}`})
  } catch (e: any) {
    console.error('compose-final failed', e)
    res.status(500).json({error: 'compose_failed', message: e?.message})
  }
})

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`)
})

