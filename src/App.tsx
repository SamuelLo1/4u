import React, { useState, useEffect } from "react";
import { useAsyncStorage } from "@shopify/shop-minis-react";

// Hardcoded UUID for now - in production this would come from user authentication
const USER_UUID = "123e4567-e89b-12d3-a456-426614174000";

// Storage keys
const STORAGE_KEYS = {
  USER_ANSWERS: `user_answers_${USER_UUID}`,
  USER_STATUS: `user_status_${USER_UUID}`,
};

// Initial onboarding survey questions
const INITIAL_SURVEY_QUESTIONS = [
  "What's your biggest dream right now?",
  "Describe a moment that changed your perspective on life.",
  "If you could have dinner with anyone, living or dead, who would it be and why?",
  "What's something you've always wanted to learn but haven't yet?",
  "Describe your ideal day from start to finish.",
];

// Daily check-in questions for recurring users
const DAILY_QUESTIONS = [
  "What are you most grateful for today?",
  "What's one small win you had today?",
  "How are you feeling right now on a scale of 1-10?",
  "What's one thing you're looking forward to tomorrow?",
  "What challenged you today and how did you handle it?",
];

interface SurveyState {
  currentQuestionIndex: number;
  answers: Array<{ question: string; answer: string }>;
  currentAnswer: string;
  isNewUser: boolean | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

export function App() {
  const [surveyState, setSurveyState] = useState<SurveyState>({
    currentQuestionIndex: 0,
    answers: [],
    currentAnswer: "",
    isNewUser: null,
    isLoading: true,
    isSaving: false,
    error: null,
  });

  const { getItem, setItem } = useAsyncStorage();

  // Check if user is new or recurring on component mount
  useEffect(() => {
    checkUserStatus();
  }, []);

  const checkUserStatus = async () => {
    try {
      setSurveyState((prev) => ({ ...prev, isLoading: true, error: null }));

      // Check if user has any previous answers stored
      const existingAnswers = await getItem({ key: STORAGE_KEYS.USER_ANSWERS });
      const isNewUser = !existingAnswers;

      setSurveyState((prev) => ({
        ...prev,
        isNewUser,
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

  const getCurrentQuestions = () => {
    return surveyState.isNewUser ? INITIAL_SURVEY_QUESTIONS : DAILY_QUESTIONS;
  };

  const handleAnswerChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, 500);
    setSurveyState((prev) => ({ ...prev, currentAnswer: value }));
  };

  const handleSubmitAnswer = () => {
    if (surveyState.currentAnswer.trim()) {
      const questions = getCurrentQuestions();
      const currentQuestion = questions[surveyState.currentQuestionIndex];

      setSurveyState((prev) => ({
        ...prev,
        answers: [
          ...prev.answers,
          { question: currentQuestion, answer: prev.currentAnswer },
        ],
        currentAnswer: "",
        currentQuestionIndex: prev.currentQuestionIndex + 1,
      }));
    }
  };

  const handleSkip = () => {
    const questions = getCurrentQuestions();
    const currentQuestion = questions[surveyState.currentQuestionIndex];

    setSurveyState((prev) => ({
      ...prev,
      answers: [...prev.answers, { question: currentQuestion, answer: "" }],
      currentQuestionIndex: prev.currentQuestionIndex + 1,
    }));
  };

  const saveAnswersToLocalStorage = async () => {
    try {
      setSurveyState((prev) => ({ ...prev, isSaving: true, error: null }));

      // Filter out skipped questions and prepare data for storage
      const answersToSave = surveyState.answers.filter(
        (item) => item.answer.trim() !== ""
      );

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

      // Reset the survey state after successful save
      setSurveyState({
        currentQuestionIndex: 0,
        answers: [],
        currentAnswer: "",
        isNewUser: false, // User is no longer new after completing initial survey
        isLoading: false,
        isSaving: false,
        error: null,
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

  // Loading state
  if (surveyState.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your experience...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (surveyState.error && !surveyState.isSaving) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-red-800 mb-2">Oops!</h2>
          <p className="text-red-600 mb-6">{surveyState.error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const questions = getCurrentQuestions();
  const isComplete = surveyState.currentQuestionIndex >= questions.length;
  const answeredCount = surveyState.answers.filter(
    (a) => a.answer.trim() !== ""
  ).length;

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

              {surveyState.error && (
                <p className="text-red-600 text-sm">{surveyState.error}</p>
              )}
            </div>
          )}

          <button
            onClick={() =>
              setSurveyState({
                currentQuestionIndex: 0,
                answers: [],
                currentAnswer: "",
                isNewUser: surveyState.isNewUser,
                isLoading: false,
                isSaving: false,
                error: null,
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
            {questions[surveyState.currentQuestionIndex]}
          </h1>

          <div className="relative">
            <textarea
              value={surveyState.currentAnswer}
              onChange={handleAnswerChange}
              placeholder="Share your thoughts..."
              maxLength={500}
              rows={5}
              className="w-full p-4 border-2 border-gray-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-300"
            />
            <div className="text-right text-sm text-gray-400 mt-2">
              {surveyState.currentAnswer.length}/500
            </div>
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
            disabled={!surveyState.currentAnswer.trim()}
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
