import React, { useEffect, useMemo, useState } from "react";
import { useAsyncStorage, useProductSearch, ProductLink } from "@shopify/shop-minis-react";
import { saveRoom, shareRoom, composePhasedBase } from "./lib/api";
import { Hotspots } from "./components/Hotspots";
import { buildDefaultBoxes } from "./lib/slots";
import { INITIAL_SURVEY_QUESTIONS, DAILY_QUESTIONS, SelectedAnswer, Question } from "./questions";
import { generateDailyQuestions } from "./lib/api";

// Hardcoded UUID for now - in production this would come from user authentication
const USER_UUID = "123e4567-e89b-12d3-a456-426614174000";

// Storage keys
const STORAGE_KEYS = {
  USER_ANSWERS: `user_answers_${USER_UUID}`,
  USER_STATUS: `user_status_${USER_UUID}`,
  DAILY_CHECK_IN: `daily_checkin_${USER_UUID}`,
  DYNAMIC_QUESTIONS: `dynamic_questions_${USER_UUID}`,
  DAILY_QUESTION_HISTORY: `daily_question_history_${USER_UUID}`,
};

// Utility function to get today's date as a string
const getTodayDateString = () => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD format
};

interface SurveyState {
  currentQuestionIndex: number;
  answers: SelectedAnswer[];
  selectedChoiceId: string | null;
  isNewUser: boolean | null;
  hasCompletedDailyToday: boolean | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  showProductPage: boolean;
}

interface DynamicQuestionsState {
  questions: Question[];
  isLoading: boolean;
  error: string | null;
  generatedAt: string | null;
}

export function App() {
  const [surveyState, setSurveyState] = useState<SurveyState>({
    currentQuestionIndex: 0,
    answers: [],
    selectedChoiceId: null,
    isNewUser: null,
    hasCompletedDailyToday: null,
    isLoading: true,
    isSaving: false,
    error: null,
    showProductPage: false,
  });

  const [dynamicQuestionsState, setDynamicQuestionsState] = useState<DynamicQuestionsState>({
    questions: [],
    isLoading: false,
    error: null,
    generatedAt: null,
  });

  const { getItem, setItem, getAllKeys, clear } = useAsyncStorage();

  // Room generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [lastRoomId, setLastRoomId] = useState<string | null>(null);
  const [generationPhase, setGenerationPhase] = useState<string | null>(null);
  const [totalAnsweredCount, setTotalAnsweredCount] = useState(0);

  // Check if user is new or recurring on component mount
  useEffect(() => {
    checkUserStatus();
  }, []);

  // Generate dynamic questions for returning users
  useEffect(() => {
    if (surveyState.isNewUser === false && !surveyState.hasCompletedDailyToday) {
      loadDynamicQuestions();
    }
  }, [surveyState.isNewUser, surveyState.hasCompletedDailyToday]);

  const checkUserStatus = async () => {
    try {
      setSurveyState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check if user has any previous answers stored
      const existingAnswers = await getItem({ key: STORAGE_KEYS.USER_ANSWERS });
      const isNewUser = !existingAnswers;

      // Debug logging
      const allKeys = await getAllKeys();
      console.log('🔍 Debug Storage Data:');
      console.log('All storage keys:', allKeys);
      console.log('Existing answers:', existingAnswers);
      console.log('Is new user:', isNewUser);
      console.log('Today date:', getTodayDateString());

      // Check if user has completed daily check-in today
      let hasCompletedDailyToday = false;
      if (!isNewUser) {
        const dailyCheckInData = await getItem({
          key: STORAGE_KEYS.DAILY_CHECK_IN,
        });
        console.log('Daily check-in data:', dailyCheckInData);
        if (dailyCheckInData) {
          const { lastCompletedDate } = JSON.parse(dailyCheckInData);
          console.log('Last completed date:', lastCompletedDate);
          hasCompletedDailyToday = lastCompletedDate === getTodayDateString();
        }
      }

      console.log('Has completed daily today:', hasCompletedDailyToday);

      setSurveyState((prev) => ({
        ...prev,
        isNewUser,
        hasCompletedDailyToday,
        isLoading: false,
      }));
    } catch (error) {
      console.error("Error checking user status:", error);
      setSurveyState((prev) => ({
        ...prev,
        error: "Failed to load user status. Please try again.",
        isLoading: false,
      }));
    }
  };

  const loadDynamicQuestions = async () => {
    console.log('🚀 Starting dynamic questions workflow...');
    try {
      setDynamicQuestionsState(prev => ({ ...prev, isLoading: true, error: null }));

      console.log('📊 Checking for existing user answers...');
      // Get user's previous answers
      const existingAnswersJson = await getItem({ key: STORAGE_KEYS.USER_ANSWERS });
      if (!existingAnswersJson) {
        console.log('❌ No user answers found');
        throw new Error('No user answers found');
      }

      const existingAnswers = JSON.parse(existingAnswersJson);
      console.log('📝 Found existing answers:', existingAnswers);
      
      // Get the most recent initial survey answers for personality context
      const initialSurvey = existingAnswers.find((entry: any) => entry.type === 'initial');
      if (!initialSurvey || !initialSurvey.answers) {
        console.log('⚠️ No initial survey found, using static daily questions');
        return;
      }

      console.log('🎯 Found initial survey with', initialSurvey.answers.length, 'answers');
      console.log('🏷️ User personality tags:', initialSurvey.answers.flatMap((a: any) => a.tags));

      // Get previous daily questions to avoid repetition
      const dailyHistoryJson = await getItem({ key: STORAGE_KEYS.DAILY_QUESTION_HISTORY });
      const previousDailyQuestions = dailyHistoryJson ? JSON.parse(dailyHistoryJson) : [];
      console.log('📅 Previous daily questions history:', previousDailyQuestions);

      console.log('🤖 Calling OpenAI to generate dynamic questions...');
      
      const response = await generateDailyQuestions({
        userAnswers: initialSurvey.answers,
        previousDailyQuestions
      });

      console.log('✅ Dynamic questions generated successfully!');
      console.log('📋 Generated questions:', response.questions);
      console.log('🕒 Generated at:', response.generatedAt);
      console.log('🏷️ User tags used:', response.userTags);

      setDynamicQuestionsState({
        questions: response.questions,
        isLoading: false,
        error: null,
        generatedAt: response.generatedAt
      });

      // Store the generated questions in history
      const updatedHistory = [
        ...previousDailyQuestions,
        {
          date: getTodayDateString(),
          questions: response.questions
        }
      ];
      
      console.log('💾 Saving dynamic questions to storage...');
      await setItem({
        key: STORAGE_KEYS.DYNAMIC_QUESTIONS,
        value: JSON.stringify({
          questions: response.questions,
          generatedAt: response.generatedAt,
          date: getTodayDateString()
        })
      });

      await setItem({
        key: STORAGE_KEYS.DAILY_QUESTION_HISTORY,
        value: JSON.stringify(updatedHistory)
      });
      
      console.log('🎉 Dynamic questions workflow completed successfully!');

    } catch (error: any) {
      console.error('❌ Failed to load dynamic questions:', error);
      console.error('🔍 Error details:', {
        message: error.message,
        stack: error.stack
      });
      
      setDynamicQuestionsState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Failed to generate questions'
      }));
      
      console.log('⚡ Fallback: Will use static DAILY_QUESTIONS instead');
    }
  };

  const getCurrentQuestions = () => {
    if (surveyState.isNewUser) {
      console.log('📋 Using INITIAL_SURVEY_QUESTIONS for new user');
      return INITIAL_SURVEY_QUESTIONS;
    }
    
    // For returning users, try to use dynamic questions if available
    if (dynamicQuestionsState.questions.length > 0) {
      console.log('🎯 Using DYNAMIC questions:', dynamicQuestionsState.questions.length, 'questions');
      return dynamicQuestionsState.questions;
    }
    
    // Fallback to static daily questions
    console.log('📋 Using static DAILY_QUESTIONS as fallback');
    return DAILY_QUESTIONS;
  };

  const personalityHint = useMemo(() => {
    const allTags = surveyState.answers.flatMap(a => a.tags);
    const tagCounts = allTags.reduce((acc, tag) => {
      acc[tag] = (acc[tag] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Determine vibe based on most frequent tags
    if (tagCounts['tech-friendly'] || tagCounts['modern'] || tagCounts['sleek']) {
      return { vibe: "modern tech", palette: "cool grays with neon accents" };
    }
    if (tagCounts['outdoor'] || tagCounts['adventure'] || tagCounts['practical']) {
      return { vibe: "nature-inspired", palette: "greens, wood tones, warm whites" };
    }
    if (tagCounts['cozy'] || tagCounts['homebody'] || tagCounts['comfort-first']) {
      return { vibe: "cozy minimalist", palette: "warm neutrals with gentle contrast" };
    }
    if (tagCounts['minimal'] || tagCounts['organized'] || tagCounts['monochrome']) {
      return { vibe: "calm coastal", palette: "soft blues and sandy neutrals" };
    }
    if (tagCounts['vibrant'] || tagCounts['colorful'] || tagCounts['playful']) {
      return { vibe: "eclectic vibrant", palette: "bright colors with energetic contrasts" };
    }
    
    return { vibe: "cozy minimalist", palette: "warm neutrals with gentle contrast" };
  }, [surveyState.answers]);

  // Build text queries based on personality to fetch products (6 items)
  const productQueries = useMemo(() => {
    const vibe = personalityHint.vibe
    // Rough mapping from vibe to product categories
    if (vibe.includes('coastal')) return ['bed frame', 'rattan lamp', 'linen bedding', 'ocean wall art', 'indoor plant', 'jute rug']
    if (vibe.includes('modern')) return ['minimal desk', 'sleek chair', 'LED lamp', 'abstract wall art', 'laptop stand', 'geometric rug']
    if (vibe.includes('nature')) return ['wood nightstand', 'stoneware lamp', 'cotton bedding', 'botanical wall art', 'planter', 'wool rug']
    if (vibe.includes('sport')) return ['athletic shoes', 'duffle bag', 'sports rack', 'foam roller', 'water bottle', 'poster frame']
    return ['bed frame', 'nightstand lamp', 'cotton bedding', 'framed wall art', 'indoor plant', 'area rug']
  }, [personalityHint.vibe])

  // Use up to 6 queries; aggregate results
  const searches = productQueries.slice(0, 6).map(q => useProductSearch({ query: q, first: 10 }))
  const productTexts = useMemo(() => {
    const items: string[] = []
    for (const s of searches) {
      const ps = (s as any)?.products as any[] | null
      if (ps && ps.length > 0) {
        // Take top result name + snippet description
        const p = ps[0]
        const title = p?.title || ''
        const desc = p?.description || p?.descriptionHtml || ''
        if (title) items.push(`${title}: ${String(desc).slice(0,140)}`)
      }
    }
    return items
  }, [searches.map(s => (s as any)?.products)?.join('|')])

  const handleGenerateRoom = async () => {
    setIsGenerating(true);
    setGenerationError(null);
    setGeneratedImageUrl(null);

    const inventoryText = productTexts.length > 0 ? `\nUse items inspired by: ${productTexts.join('; ')}` : ''
    const prompt = `An isometric pixel art bedroom with 45-degree walls and a grid floor, cozy, minimalist, clean black outlines, bright saturated colors with subtle dithering. Keep layout realistic and uncluttered. Personality vibe: ${personalityHint.vibe}. Palette: ${personalityHint.palette}. Maintain isometric perspective and consistent camera angle.${inventoryText}`;

    try {
      // Phased feedback for UX
      setGenerationPhase('Generating room…')
      const { baseB64 } = await composePhasedBase({ prompt, paletteHint: personalityHint.palette })

      // Pure text-based approach: no sprites; the base image is the final image
      setGenerationPhase('Finalizing…')
      const imageUrl = `data:image/png;base64,${baseB64}`
      setGeneratedImageUrl(imageUrl ?? null)
      setGenerationPhase(null)
      if (imageUrl) {
        const { roomId } = await saveRoom({ seed: Math.floor(Math.random()*1e7), imageUrl })
        setLastRoomId(roomId)
      }
    } catch (err: any) {
      setGenerationError(err?.message ?? "Failed to generate room");
    } finally {
      setIsGenerating(false);
      setGenerationPhase(null)
    }
  };

  const handleShareRoom = async () => {
    if (!lastRoomId) return;
    try {
      const { shareToken } = await shareRoom(lastRoomId);
      const url = new URL(window.location.href);
      url.searchParams.set("t", shareToken);
      if (navigator.share) {
        await navigator.share({ title: "My Room", url: url.toString() });
      }
      await navigator.clipboard?.writeText(url.toString());
    } catch (e) {
      console.error(e);
    }
  };

  const handleChoiceSelect = (choiceId: string) => {
    setSurveyState((prev) => ({ ...prev, selectedChoiceId: choiceId }));
  };

  const handleSubmitAnswer = () => {
    if (surveyState.selectedChoiceId) {
      const questions = getCurrentQuestions();
      const currentQuestion = questions[surveyState.currentQuestionIndex];
      const selectedChoice = currentQuestion.choices.find(
        (choice) => choice.id === surveyState.selectedChoiceId
      );

      if (selectedChoice) {
        const answer: SelectedAnswer = {
          questionId: currentQuestion.id,
          choiceId: selectedChoice.id,
          choiceText: selectedChoice.text,
          tags: selectedChoice.tags,
        };

        setSurveyState((prev) => ({
          ...prev,
          answers: [...prev.answers, answer],
          selectedChoiceId: null,
          currentQuestionIndex: prev.currentQuestionIndex + 1,
        }));
      }
    }
  };

  const handleSkip = () => {
    setSurveyState((prev) => ({
      ...prev,
      selectedChoiceId: null,
      currentQuestionIndex: prev.currentQuestionIndex + 1,
    }));
  };

  useEffect(() => {
    loadTotalAnsweredCount();
  }, []);

  const loadTotalAnsweredCount = async () => {
    try {
      const existingAnswersJson = await getItem({ key: STORAGE_KEYS.USER_ANSWERS });
      if (existingAnswersJson) {
        const existingAnswers = JSON.parse(existingAnswersJson);
        // Count all previous answers
        const totalCount = existingAnswers.reduce((count: number, entry: any) => {
          return count + (entry.answers?.length || 0);
        }, 0);
        setTotalAnsweredCount(totalCount);
      }
    } catch (error) {
      console.error('Error loading total answered count:', error);
    }
  };

  const answeredCount = surveyState.answers.length; // Current session answers
  const displayAnsweredCount = totalAnsweredCount + answeredCount; // Total including previous sessions

  const saveAnswersToLocalStorage = async () => {
    try {
      setSurveyState((prev) => ({ ...prev, isSaving: true, error: null }));

      // All answers are valid (no need to filter for empty text answers)
      const answersToSave = surveyState.answers;

      if (answersToSave.length === 0) {
        setSurveyState((prev) => ({
          ...prev,
          isSaving: false,
          error: "No answers to save. Please answer at least one question.",
        }));
        return;
      }

      // Get existing answers and append new ones
      const existingAnswersJson = await getItem({
        key: STORAGE_KEYS.USER_ANSWERS,
      });
      const existingAnswers = existingAnswersJson
        ? JSON.parse(existingAnswersJson)
        : [];

      const updatedAnswers = [
        ...existingAnswers,
        {
          timestamp: new Date().toISOString(),
          type: surveyState.isNewUser ? "initial" : "daily",
          answers: answersToSave,
        },
      ];

      // Save to local storage
      await setItem({
        key: STORAGE_KEYS.USER_ANSWERS,
        value: JSON.stringify(updatedAnswers),
      });

      // Update user status to no longer be new
      await setItem({
        key: STORAGE_KEYS.USER_STATUS,
        value: "returning",
      });

      // If this was a daily check-in, update the daily completion status
      if (!surveyState.isNewUser) {
        await setItem({
          key: STORAGE_KEYS.DAILY_CHECK_IN,
          value: JSON.stringify({
            lastCompletedDate: getTodayDateString(),
            completedAt: new Date().toISOString(),
          }),
        });
      }

      // Reset the survey state after successful save
      setSurveyState({
        currentQuestionIndex: 0,
        answers: [],
        selectedChoiceId: null,
        isNewUser: false, // User is no longer new after completing initial survey
        hasCompletedDailyToday: !surveyState.isNewUser, // Mark daily as completed if this was a daily check-in
        isLoading: false,
        isSaving: false,
        error: null,
        showProductPage: true, // Show the product page after saving answers
      });
    } catch (error) {
      console.error("Error saving answers:", error);
      setSurveyState((prev) => ({
        ...prev,
        isSaving: false,
        error: "Failed to save your answers. Please try again.",
      }));
    }
  };

  if (surveyState.showProductPage) {
    const productCards = searches.slice(0, 5).map(search => {
      const products = (search as any)?.products as any[] | null;
      return products && products.length > 0 ? products[0] : null;
    }).filter(Boolean);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-6">
        <div className="text-center max-w-4xl">
          <h1 className="text-4xl font-bold text-purple-800 mb-6">
            Recommended Products 🛍️
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            Based on your personality, here are some products you might love:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {productCards.map((product, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-4">
                <ProductLink product={product} />
              </div>
            ))}
          </div>

          <button 
            onClick={() => setSurveyState(prev => ({ ...prev, showProductPage: false }))}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const clearUserSession = async () => {
    try {
      await clear();
      console.log('🗑️ All user data cleared');
      // Reset the app state
      setSurveyState({
        currentQuestionIndex: 0,
        answers: [],
        selectedChoiceId: null,
        isNewUser: null,
        hasCompletedDailyToday: null,
        isLoading: true,
        isSaving: false,
        error: null,
      });
      // Re-check user status
      checkUserStatus();
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  const logSessionStorage = async () => {
    try {
      console.log('📊 Current Session Storage Data:');
      console.log('=====================================');
      
      // Get all keys
      const allKeys = await getAllKeys();
      console.log('All storage keys:', allKeys);
      
      // Get user-specific data
      const userAnswers = await getItem({ key: STORAGE_KEYS.USER_ANSWERS });
      const userStatus = await getItem({ key: STORAGE_KEYS.USER_STATUS });
      const dailyCheckIn = await getItem({ key: STORAGE_KEYS.DAILY_CHECK_IN });
      
      console.log('📝 User Answers:', userAnswers ? JSON.parse(userAnswers) : null);
      console.log('👤 User Status:', userStatus);
      console.log('📅 Daily Check-in:', dailyCheckIn ? JSON.parse(dailyCheckIn) : null);
      
      // Current app state
      console.log('🔄 Current App State:');
      console.log('  - Is New User:', surveyState.isNewUser);
      console.log('  - Has Completed Daily Today:', surveyState.hasCompletedDailyToday);
      console.log('  - Current Question Index:', surveyState.currentQuestionIndex);
      console.log('  - Current Answers Count:', surveyState.answers.length);
      console.log('  - Selected Choice:', surveyState.selectedChoiceId);
      
      // Show current personality analysis if answers exist
      if (surveyState.answers.length > 0) {
        const allTags = surveyState.answers.flatMap(a => a.tags);
        console.log('🎯 Current Tags:', allTags);
        console.log('🎨 Personality Hint:', personalityHint);
      }
      
      console.log('=====================================');
      
    } catch (error) {
      console.error('Error logging session storage:', error);
    }
  };

  // Loading state
  if (surveyState.isLoading || dynamicQuestionsState.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {dynamicQuestionsState.isLoading 
              ? "Generating your personalized questions..."
              : "Loading your experience..."}
          </p>
        </div>
      </div>
    );
  }

  // Error state
  if ((surveyState.error && !surveyState.isSaving) || dynamicQuestionsState.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Oops!</h2>
          <p className="text-red-600 mb-6">
            {surveyState.error || dynamicQuestionsState.error}
          </p>
          {dynamicQuestionsState.error && (
            <p className="text-sm text-gray-600 mb-4">
              Don't worry - we'll use standard questions instead.
            </p>
          )}
          <button
            onClick={() => {
              if (dynamicQuestionsState.error) {
                // Clear dynamic questions error and continue with static questions
                setDynamicQuestionsState(prev => ({ ...prev, error: null }));
              } else {
                window.location.reload();
              }
            }}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            {dynamicQuestionsState.error ? 'Continue' : 'Try Again'}
          </button>
        </div>
      </div>
    );
  }


  
  // Show home page if returning user has already completed daily check-in today
  if (!surveyState.isNewUser && surveyState.hasCompletedDailyToday) {
  return (
    
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center p-6 ">
      <div className="text-center max-w-2xl">
        <div className="text-6xl mb-6">✨</div>
        <h1 className="text-4xl font-bold text-emerald-800 mb-6">
          Welcome back! 🌟
        </h1>
        <p className="text-lg text-gray-700 mb-8">
          You've already completed your daily check-in today. Come back
          tomorrow for new reflection questions!
        </p>
        <p className="text-lg text-gray-700 mb-8">
          {!surveyState.isNewUser && totalAnsweredCount > 0 && (
            <span className="block text-sm text-gray-600 mt-2">
              Total questions answered: {displayAnsweredCount}
            </span>
          )}
        </p>
        
        <div className="space-y-6">
          <button
            onClick={handleGenerateRoom}
            disabled={isGenerating}
            className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
          >
            {isGenerating ? (generationPhase ?? "Generating…") : "Generate Today's Room"}
          </button>
          
          <button
            onClick={() => setSurveyState(prev => ({ ...prev, showProductPage: true }))}
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            View Recommended Products 🛍️
          </button>
          
          {generatedImageUrl && (
            <div className="mx-auto max-w-md mt-8">
              <div className="relative">
                <img src={generatedImageUrl} alt="Generated room" className="w-full rounded-xl shadow-lg" />
                <div className="absolute inset-0">
                  <Hotspots boxes={buildDefaultBoxes()} />
                </div>
              </div>
              <div className="mt-4 flex justify-center">
                <button onClick={handleShareRoom} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                  Share Room
                </button>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500 mt-4">
            Check console for storage data • Next check-in available tomorrow
          </p>
        </div>
      </div>
    </div>
  );
}

  const questions = getCurrentQuestions();
  const isComplete = surveyState.currentQuestionIndex >= questions.length;

  // Show ProductLink page after completing survey and saving answers
  if (isComplete && surveyState.showProductPage) {
    const productCards = searches.slice(0, 5).map(search => {
      const products = (search as any)?.products as any[] | null;
      return products && products.length > 0 ? products[0] : null;
    }).filter(Boolean);

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-6">
        <div className="text-center max-w-4xl">
          <h1 className="text-4xl font-bold text-purple-800 mb-6">
            Recommended Products 🛍️
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            Based on your personality, here are some products you might love:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {productCards.map((product, index) => (
              <div key={index} className="bg-white rounded-xl shadow-lg p-4">
                <ProductLink product={product} />
              </div>
            ))}
          </div>

          <button 
            onClick={() =>
              setSurveyState({
                currentQuestionIndex: 0,
                answers: [],
                currentAnswer: "",
                isNewUser: surveyState.isNewUser,
                hasCompletedDailyToday: surveyState.hasCompletedDailyToday,
                isLoading: false,
                isSaving: false,
                error: null,
                showProductPage: false,
              })
            }
            className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // Survey complete state
  if (isComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-6">
        <div className="text-center max-w-2xl">
          <h1 className="text-4xl font-bold text-green-800 mb-6">
            {surveyState.isNewUser
              ? "Welcome aboard! 🎉"
              : "Thanks for checking in! 🌟"}
          </h1>
          <p className="text-lg text-gray-700 mb-8">
            You answered {answeredCount} out of {questions.length} questions.
            {!surveyState.isNewUser && totalAnsweredCount > 0 && (
              <span className="block text-sm text-gray-600 mt-2">
                Total questions answered: {displayAnsweredCount}
              </span>
            )}
          </p>

          {answeredCount > 0 && (
            <div className="space-y-4">
              <button
                onClick={saveAnswersToLocalStorage}
                disabled={surveyState.isSaving}
                className="px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {surveyState.isSaving ? (
                  <span className="flex items-center justify-center">
                    <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></span>
                    Saving...
                  </span>
                ) : (
                  "Save My Answers"
                )}
              </button>

              <button
                onClick={() => setSurveyState(prev => ({ ...prev, showProductPage: true }))}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl shadow-lg transition-all duration-300 transform hover:scale-105"
              >
                View Recommended Products 🛍️
              </button>

              <button
                onClick={handleGenerateRoom}
                disabled={isGenerating}
                className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl shadow-lg transition-all disabled:opacity-50"
              >
                {isGenerating ? (generationPhase ?? "Generating…") : "Generate My Room"}
              </button>
              {generationPhase && (
                <p className="text-sm text-green-700">{generationPhase}</p>
              )}

              {surveyState.error && (
                <p className="text-red-600 text-sm">{surveyState.error}</p>
              )}

              {generationError && (
                <p className="text-red-600 text-sm">{generationError}</p>
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
                    <button onClick={handleShareRoom} className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg">
                      Share Room
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <button 
            onClick={() =>
              setSurveyState({
                currentQuestionIndex: 0,
                answers: [],
                selectedChoiceId: null,
                isNewUser: surveyState.isNewUser,
                hasCompletedDailyToday: surveyState.hasCompletedDailyToday,
                isLoading: false,
                isSaving: false,
                error: null,
                showProductPage: false,
              })
            }
            className="mt-4 px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Start Over
          </button>
        </div>
      </div>
    );
  }

  // Survey in progress
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-sm font-semibold text-indigo-600 mb-2">
            {surveyState.isNewUser ? "Welcome Survey" : "Daily Check-in"}
          </h2>

          {/* Progress indicators */}
          <div className="flex justify-center mb-4">
            {questions.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full mx-1 transition-all duration-300 ${
                  i < surveyState.answers.length
                    ? "bg-green-500"
                    : i === surveyState.currentQuestionIndex
                    ? "bg-indigo-600 animate-pulse"
                    : "bg-gray-300"
                }`}
              />
            ))}
          </div>

          <p className="text-sm text-gray-500">
            Question {surveyState.currentQuestionIndex + 1} of{" "}
            {questions.length}
          </p>
        </div>

        {/* Question */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 mb-6">
            {questions[surveyState.currentQuestionIndex].text}
          </h1>
          
          <div className="space-y-3">
            {questions[surveyState.currentQuestionIndex].choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => handleChoiceSelect(choice.id)}
                className={`w-full p-4 text-left rounded-xl border-2 transition-all duration-300 ${
                  surveyState.selectedChoiceId === choice.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                    : "border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-25"
                }`}
              >
                <div className="flex items-start">
                  <div className={`w-4 h-4 rounded-full border-2 mr-3 mt-0.5 flex-shrink-0 ${
                    surveyState.selectedChoiceId === choice.id
                      ? "border-indigo-500 bg-indigo-500"
                      : "border-gray-300"
                  }`}>
                    {surveyState.selectedChoiceId === choice.id && (
                      <div className="w-full h-full rounded-full bg-white scale-50"></div>
                    )}
                  </div>
                  <span className="text-gray-800 leading-relaxed">{choice.text}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center">
          <button
            onClick={handleSkip}
            className="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Skip
          </button>

          <button
            onClick={handleSubmitAnswer}
            disabled={!surveyState.selectedChoiceId}
            className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl shadow-md transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Next
          </button>
        </div>

        {/* User indicator */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400 text-center">
            User ID: {USER_UUID.slice(0, 8)}...
            </p>
          </div>
      </div>
    </div>
  );
}
