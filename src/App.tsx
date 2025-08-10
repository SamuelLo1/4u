import React, { useMemo, useState } from 'react'
import {usePopularProducts} from '@shopify/shop-minis-react'
import {generateRoom, saveRoom, shareRoom} from './lib/api'
import {Hotspots} from './components/Hotspots'
import {buildDefaultBoxes} from './lib/slots'

const SURVEY_QUESTIONS = [
  "What's your biggest dream right now?",
  "Describe a moment that changed your perspective on life.",
  "If you could have dinner with anyone, living or dead, who would it be and why?",
  "What's something you've always wanted to learn but haven't yet?",
  "Describe your ideal day from start to finish.",
  "What advice would you give to your younger self?",
  "What's a fear you've overcome or want to overcome?",
  "If you could solve one world problem, what would it be?",
  "What makes you feel most alive?",
  "Describe a place that feels like home to you."
]

interface SurveyState {
  currentQuestionIndex: number
  answers: string[]
  currentAnswer: string
}

export function App() {
  const {products} = usePopularProducts()
  const [surveyState, setSurveyState] = useState<SurveyState>({
    currentQuestionIndex: 0,
    answers: [],
    currentAnswer: ''
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [lastRoomId, setLastRoomId] = useState<string | null>(null)

  const answeredCount = surveyState.answers.length
  const evolutionStage = Math.min(Math.floor(answeredCount / 2), 4)

  const getEvolutionStyles = () => {
    const stages = [
      {
        backgroundColor: 'from-gray-50 to-white',
        textColor: 'text-gray-800',
        buttonStyle: 'bg-blue-500 hover:bg-blue-600 text-white rounded-lg',
        fontFamily: 'font-sans',
        animation: '',
        questionSize: 'text-xl',
        containerStyle: 'p-6'
      },
      {
        backgroundColor: 'from-blue-50 to-indigo-100',
        textColor: 'text-indigo-900',
        buttonStyle: 'bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md',
        fontFamily: 'font-serif',
        animation: 'animate-pulse',
        questionSize: 'text-2xl',
        containerStyle: 'p-8'
      },
      {
        backgroundColor: 'from-purple-100 to-pink-100',
        textColor: 'text-purple-900',
        buttonStyle: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-2xl shadow-lg transform hover:scale-105 transition-all duration-300',
        fontFamily: 'font-mono',
        animation: 'animate-bounce',
        questionSize: 'text-3xl',
        containerStyle: 'p-10 border-4 border-purple-300 rounded-3xl'
      },
      {
        backgroundColor: 'from-yellow-200 to-orange-300',
        textColor: 'text-orange-900',
        buttonStyle: 'bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white rounded-full shadow-xl transform hover:scale-110 transition-all duration-500 animate-pulse',
        fontFamily: 'font-bold tracking-wide',
        animation: 'animate-spin',
        questionSize: 'text-4xl font-extrabold',
        containerStyle: 'p-12 border-8 border-orange-400 rounded-full shadow-2xl'
      },
      {
        backgroundColor: 'from-red-300 via-pink-400 to-purple-500',
        textColor: 'text-white drop-shadow-lg',
        buttonStyle: 'bg-gradient-to-r from-red-600 via-pink-600 to-purple-700 hover:from-red-700 hover:via-pink-700 hover:to-purple-800 text-white rounded-full shadow-2xl transform hover:scale-125 transition-all duration-700 animate-bounce border-4 border-white',
        fontFamily: 'font-extrabold tracking-widest',
        animation: 'animate-pulse',
        questionSize: 'text-5xl font-black animate-pulse',
        containerStyle: 'p-16 border-8 border-white rounded-full shadow-2xl bg-gradient-to-br from-transparent to-white/20 backdrop-blur-sm'
      }
    ]
    return stages[evolutionStage]
  }

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, 200)
    setSurveyState(prev => ({ ...prev, currentAnswer: value }))
  }

  const handleSubmitAnswer = () => {
    if (surveyState.currentAnswer.trim()) {
      setSurveyState(prev => ({
        currentQuestionIndex: prev.currentQuestionIndex + 1,
        answers: [...prev.answers, prev.currentAnswer],
        currentAnswer: ''
      }))
    }
  }

  const handleSkip = () => {
    setSurveyState(prev => ({
      currentQuestionIndex: prev.currentQuestionIndex + 1,
      answers: [...prev.answers, ''],
      currentAnswer: ''
    }))
  }

  const styles = getEvolutionStyles()
  const isComplete = surveyState.currentQuestionIndex >= SURVEY_QUESTIONS.length

  const personalityHint = useMemo(() => {
    // Very naive placeholder mapping from answers to a vibe/palette. Replace with real scoring later.
    const joined = surveyState.answers.join(' ').toLowerCase()
    if (joined.includes('ocean') || joined.includes('calm')) return {vibe: 'calm coastal', palette: 'soft blues and sandy neutrals'}
    if (joined.includes('city') || joined.includes('tech')) return {vibe: 'modern tech', palette: 'cool grays with neon accents'}
    if (joined.includes('nature') || joined.includes('forest')) return {vibe: 'nature-inspired', palette: 'greens, wood tones, warm whites'}
    return {vibe: 'cozy minimalist', palette: 'warm neutrals with gentle contrast'}
  }, [surveyState.answers])

  const productImageUrls = useMemo(() => {
    const forceBaselines = (import.meta as any)?.env?.VITE_FORCE_BASELINES === 'true'
    const baselines = [
      'https://www.ikea.com/us/en/images/products/malm-bed-frame-dark-brown-veneer__1364772_pe956028_s5.jpg?f=xl',
      'https://www.ikea.com/us/en/images/products/lagkapten-alex-desk-gray-wood-effect__1432287_pe982743_s5.jpg?f=xl',
      'https://tennisexpress.com/cdn/shop/collections/Collection-Image-racquets_a8e2e423-79ad-44a3-a9ca-8a632e5969f5.jpg?v=1746049052',
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRugJ31V4d7YSlKrT1t7ZKvmGRria8c0HfP8A&s',
      'https://m.media-amazon.com/images/I/61xxhaeUKIL._UF894,1000_QL80_.jpg',
    ]
    if (forceBaselines) return baselines
    const urls = (products ?? [])
      .map((p: any) => p?.featuredImage?.url || p?.images?.[0]?.url)
      .filter((u: any) => typeof u === 'string')
      .slice(0, 6)

    if (urls.length > 0) return urls as string[]
    return baselines
  }, [products])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setGenerationError(null)
    setGeneratedImageUrl(null)

    const prompt = `An isometric pixel art bedroom with 45-degree walls and a grid floor, cozy, minimalist, clean black outlines, bright saturated colors with subtle dithering. Keep layout realistic and uncluttered. Personality vibe: ${personalityHint.vibe}. Palette: ${personalityHint.palette}. Include a bed, desk with laptop, wall art frame, rug, floor lamp, plant, nightstand. Maintain isometric perspective and consistent camera angle.`
    const negativePrompt = 'blurry, extra limbs, deformed, wrong perspective, cluttered, text, watermark, logo, non-isometric, incorrect camera angle, photorealistic'

    try {
      // Simple mobile-friendly 512x512 normalized boxes: x,y,w,h ∈ [0,1]
      const boxes = buildDefaultBoxes()
      const {imageUrl, seed = Math.floor(Math.random()*1e7)} = await generateRoom({
        prompt,
        negativePrompt,
        imageUrls: productImageUrls,
        boxes,
        // Use OpenAI by default on server via env; optionally pass here: model: 'openai:gpt-image-1'
      })
      setGeneratedImageUrl(imageUrl ?? null)
      if (imageUrl) {
        const {roomId} = await saveRoom({seed, imageUrl, boxes})
        setLastRoomId(roomId)
      }
    } catch (err: any) {
      setGenerationError(err?.message ?? 'Failed to generate room')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleShare = async () => {
    if (!lastRoomId) return
    try {
      const {shareToken} = await shareRoom(lastRoomId)
      const url = new URL(window.location.href)
      url.searchParams.set('t', shareToken)
      if (navigator.share) {
        await navigator.share({title: 'My Room', url: url.toString()})
      }
      // Fallback: copy to clipboard
      await navigator.clipboard?.writeText(url.toString())
    } catch (e) {
      console.error(e)
    }
  }

  if (isComplete) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${styles.backgroundColor} flex items-center justify-center ${styles.containerStyle}`}>
        <div className={`text-center ${styles.animation}`}>
          <h1 className={`${styles.questionSize} ${styles.textColor} ${styles.fontFamily} mb-8`}>
            Thank you for sharing your story! 🌟
          </h1>
          <p className={`text-lg ${styles.textColor} mb-6`}>
            You've answered {answeredCount} questions and watched this experience evolve with you.
          </p>
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className={`px-6 py-3 ${styles.buttonStyle} ${styles.fontFamily} disabled:opacity-50`}
            >
              {isGenerating ? 'Generating…' : 'Generate My Room'}
            </button>
            <button
              onClick={() => setSurveyState({ currentQuestionIndex: 0, answers: [], currentAnswer: '' })}
              className={`px-6 py-3 border-2 rounded-lg ${styles.textColor} border-current ${styles.fontFamily}`}
            >
              Start Over
            </button>
          </div>

          {generationError && (
            <p className={`text-sm ${styles.textColor} opacity-70 mb-4`}>{generationError}</p>
          )}

          {generatedImageUrl && (
            <div className="mx-auto max-w-md">
              <div className="relative">
                <img src={generatedImageUrl} alt="Generated room" className="w-full rounded-xl shadow-lg" />
                <div className="absolute inset-0">
                  <Hotspots boxes={buildDefaultBoxes()} />
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <button onClick={handleShare} className={`px-6 py-3 ${styles.buttonStyle} ${styles.fontFamily}`}>
                  Share Room
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${styles.backgroundColor} flex items-center justify-center transition-all duration-1000`}>
      <div className={`max-w-2xl w-full mx-4 ${styles.containerStyle} transition-all duration-1000`}>
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            {Array.from({ length: Math.min(SURVEY_QUESTIONS.length, 10) }, (_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full mx-1 transition-all duration-500 ${
                  i < answeredCount ? 'bg-green-500 animate-pulse' : 
                  i === surveyState.currentQuestionIndex ? `bg-current ${styles.animation}` : 
                  'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className={`text-sm ${styles.textColor} opacity-70`}>
            Question {surveyState.currentQuestionIndex + 1} of {SURVEY_QUESTIONS.length} • Evolution Stage {evolutionStage + 1}/5
          </p>
        </div>

        <div className="text-center mb-8">
          <h1 className={`${styles.questionSize} ${styles.textColor} ${styles.fontFamily} mb-6 transition-all duration-1000 ${styles.animation}`}>
            {SURVEY_QUESTIONS[surveyState.currentQuestionIndex]}
          </h1>
          
          <div className="relative">
            <textarea
              value={surveyState.currentAnswer}
              onChange={handleAnswerChange}
              placeholder="Share your thoughts..."
              maxLength={200}
              rows={4}
              className={`w-full p-4 border-2 rounded-lg resize-none focus:outline-none focus:ring-4 focus:ring-opacity-50 transition-all duration-500 ${
                evolutionStage >= 2 ? 'border-purple-300 focus:border-purple-500 focus:ring-purple-200' :
                evolutionStage >= 1 ? 'border-indigo-300 focus:border-indigo-500 focus:ring-indigo-200' :
                'border-gray-300 focus:border-blue-500 focus:ring-blue-200'
              } ${styles.fontFamily}`}
            />
            <div className={`text-right text-sm mt-2 ${styles.textColor} opacity-60`}>
              {surveyState.currentAnswer.length}/200
            </div>
          </div>
        </div>

        <div className="flex justify-center space-x-4">
          <button
            onClick={handleSkip}
            className={`px-6 py-3 border-2 rounded-lg transition-all duration-300 ${styles.textColor} border-current hover:bg-current hover:text-white ${styles.fontFamily}`}
          >
            Skip
          </button>
          <button
            onClick={handleSubmitAnswer}
            disabled={!surveyState.currentAnswer.trim()}
            className={`px-8 py-3 ${styles.buttonStyle} ${styles.fontFamily} disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none`}
          >
            Continue
          </button>
        </div>

        {answeredCount > 0 && (
          <div className={`mt-8 text-center ${styles.animation}`}>
            <p className={`text-sm ${styles.textColor} opacity-70`}>
              You've shared {answeredCount} answer{answeredCount !== 1 ? 's' : ''} so far. 
              Notice how the interface evolves with your journey! 🌱
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
