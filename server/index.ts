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

type GenerateDailyQuestionsRequest = {
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

// Personality + 6 products using OpenAI (gpt-4o) from Q/A pairs with tags
app.post('/api/personality-products', async (req: Request, res: Response) => {
  const {userAnswers} = req.body as {userAnswers: Array<{questionId: string; choiceId: string; choiceText: string; tags: string[]}>}
  if (!Array.isArray(userAnswers)) return res.status(400).json({error: 'invalid_payload'})
  try {
    const topTags = Array.from(
      userAnswers.flatMap(a => a.tags).reduce((m, t) => m.set(t, (m.get(t)||0)+1), new Map<string, number>())
    ).sort((a,b) => b[1]-a[1]).slice(0,8).map(([t]) => t)

    const model = process.env.OPENAI_PROFILE_MODEL || 'gpt-4o'
    const system = `You are an interior stylist and product curator for bedroom setups. Given user Q&A pairs and tags, infer a concise personality and propose exactly 6 purchasable bedroom product ideas.
Return STRICT JSON only matching this schema:
{
  "personality": {"label": "string","description": "string","palette": ["string","string","string"],"vibe": "string","materials": ["string","string"],"budget": "LOW|MID|HIGH"},
  "products": [{"name":"string","searchQuery":"string","category":"BED|DESK|LAMP|RUG|WALL_ART|PLANT|STORAGE|DECOR|CHAIR|BEDDING","styleHints":["string"],"colorHints":["string"],"rationale":"string"}]
}`
    const user = `Top tags: ${topTags.join(', ')}\nAnswers: ${userAnswers.map(a => `${a.choiceText} (tags: ${a.tags.join(', ')})`).join('; ')}`
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.5,
      messages: [
        {role: 'system', content: system},
        {role: 'user', content: user},
      ],
      response_format: {type: 'json_object'},
    })
    let text = completion.choices?.[0]?.message?.content || ''
    let data: any
    try { data = JSON.parse(text) } catch { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('no_json'); data = JSON.parse(m[0]) }
    if (!data?.personality || !Array.isArray(data?.products)) return res.status(502).json({error: 'bad_llm_output'})
    const products = (data.products as any[]).slice(0, 6).map(p => ({
      name: String(p?.name || ''),
      searchQuery: String(p?.searchQuery || p?.name || ''),
      category: String(p?.category || ''),
      styleHints: Array.isArray(p?.styleHints) ? p.styleHints : [],
      colorHints: Array.isArray(p?.colorHints) ? p.colorHints : [],
      rationale: String(p?.rationale || ''),
    }))
    while (products.length < 6) products.push({name: 'nightstand lamp', searchQuery: 'nightstand lamp', category: 'LAMP', styleHints: [], colorHints: [], rationale: ''})
    res.json({personality: data.personality, products})
  } catch (e: any) {
    console.error('personality-products failed', e)
    res.status(500).json({error: 'llm_failed', message: e?.message})
  }
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

app.post('/api/generate-daily-questions', async (req: Request, res: Response) => {
  console.log('🚀 POST /api/generate-daily-questions - Starting request...')
  console.log('📥 Request body:', JSON.stringify(req.body, null, 2))
  
  const { userAnswers, previousDailyQuestions = [] } = req.body as GenerateDailyQuestionsRequest
  
  if (!userAnswers || !Array.isArray(userAnswers) || userAnswers.length === 0) {
    console.log('❌ Invalid request: userAnswers is required')
    return res.status(400).json({ error: 'userAnswers is required' })
  }
  
  console.log('✅ Validation passed. User answers count:', userAnswers.length)
  console.log('📅 Previous daily questions count:', previousDailyQuestions.length)

  try {
    console.log('🎯 Analyzing user personality from tags...')
    // Extract user personality from tags
    const allTags = userAnswers.flatMap(a => a.tags)
    console.log('🏷️ All user tags:', allTags)
    
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    console.log('📊 Tag counts:', tagCounts)
    
    const topTags = Object.entries(tagCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([tag]) => tag)
    
    console.log('⭐ Top tags for personality:', topTags)

    // Build context about user's personality and previous answers
    const userPersonalityContext = `
User's personality profile based on survey responses:
- Top personality tags: ${topTags.join(', ')}
- Full answers: ${userAnswers.map(a => `"${a.choiceText}" (tags: ${a.tags.join(', ')})`).join('; ')}

Previous daily questions asked (to avoid repetition):
${previousDailyQuestions.map(day => 
  `- ${day.date}: ${day.questions.map(q => q.text).join('; ')}`
).join('\n')}
    `.trim()

    console.log('🤖 Preparing OpenAI prompt...')
    // Generate dynamic questions using OpenAI
    const prompt = `You are creating personalized daily check-in questions for a user based on their personality profile. 

${userPersonalityContext}

Create exactly 3 new daily check-in questions that:
1. Are personalized to the user's personality tags and previous choices
2. Are different from any previously asked questions
3. Help understand their current mood/priorities/interests
4. Each question should have 2-4 multiple choice options
5. Each choice should include relevant personality tags for design recommendations

Return ONLY a JSON object with this exact structure:
{
  "questions": [
    {
      "id": "unique_question_id",
      "text": "Question text?",
      "choices": [
        {
          "id": "unique_choice_id",
          "text": "Choice text",
          "tags": ["tag1", "tag2"]
        }
      ]
    }
  ]
}

Make the questions feel fresh, engaging, and relevant to their personality. Focus on current mood, daily priorities, or design preferences that would help create their ideal room.`

    console.log('📝 Full prompt sent to OpenAI:')
    console.log('=====================================') 
    console.log(prompt)
    console.log('=====================================') 
    
    console.log('🔄 Calling OpenAI API...')
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at creating personalized survey questions. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.8,
      max_tokens: 1500
    })
    
    console.log('✅ OpenAI API call completed')

    const content = response.choices[0]?.message?.content?.trim()
    console.log('📤 OpenAI response content:')
    console.log('=====================================') 
    console.log(content)
    console.log('=====================================') 
    
    if (!content) {
      console.log('❌ No content received from OpenAI')
      return res.status(500).json({ error: 'no_response_from_openai' })
    }

    try {
      console.log('🔄 Parsing OpenAI response as JSON...')
      
      // Clean the content - remove markdown code blocks if present
      let cleanContent = content
      if (content.startsWith('```json') && content.endsWith('```')) {
        cleanContent = content.slice(7, -3).trim()
        console.log('🧹 Removed markdown code blocks from response')
      } else if (content.startsWith('```') && content.endsWith('```')) {
        cleanContent = content.slice(3, -3).trim()
        console.log('🧹 Removed markdown code blocks from response')
      }
      
      console.log('✨ Clean content to parse:')
      console.log('=====================================') 
      console.log(cleanContent)
      console.log('=====================================') 
      
      const generatedQuestions = JSON.parse(cleanContent)
      
      // Validate the structure
      if (!generatedQuestions.questions || !Array.isArray(generatedQuestions.questions)) {
        console.log('❌ Invalid response structure from OpenAI')
        throw new Error('Invalid response structure')
      }
      
      console.log('✅ Successfully parsed', generatedQuestions.questions.length, 'questions')
      console.log('📝 Generated questions:', generatedQuestions.questions.map((q: any) => q.text))

      // Add timestamp for tracking
      const result = {
        ...generatedQuestions,
        generatedAt: new Date().toISOString(),
        userTags: topTags
      }
      
      console.log('🎉 Sending successful response to client')
      res.json(result)
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI response as JSON:', parseError)
      console.error('📄 Raw OpenAI response that failed to parse:', content)
      return res.status(500).json({ 
        error: 'invalid_ai_response', 
        message: 'Failed to parse AI response',
        rawResponse: content
      })
    }

  } catch (error: any) {
    console.error('💥 Error generating daily questions:', error)
    console.error('🔍 Error stack:', error.stack)
    res.status(500).json({ 
      error: 'generation_failed', 
      message: error?.message || 'Unknown error'
    })
  }
  
  console.log('🏁 /api/generate-daily-questions request completed')

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

