import React, { useState } from 'react'

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
  const [surveyState, setSurveyState] = useState<SurveyState>({
    currentQuestionIndex: 0,
    answers: [],
    currentAnswer: ''
  })

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
          <button 
            onClick={() => setSurveyState({ currentQuestionIndex: 0, answers: [], currentAnswer: '' })}
            className={`px-8 py-4 ${styles.buttonStyle} ${styles.fontFamily}`}
          >
            Start Over
          </button>
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
