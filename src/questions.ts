export interface AnswerChoice {
  id: string;
  text: string;
  tags: string[];
}

export interface Question {
  id: string;
  text: string;
  choices: AnswerChoice[];
}

export interface SelectedAnswer {
  questionId: string;
  choiceId: string;
  choiceText: string;
  tags: string[];
}

// Initial onboarding survey questions
export const INITIAL_SURVEY_QUESTIONS: Question[] = [
  {
    id: "weekend_energy",
    text: "How do you prefer to spend your weekend?",
    choices: [
      {
        id: "explore_coffee",
        text: "Explore a new coffee shop or boutique",
        tags: ["urban", "social", "trend-seeker"]
      },
      {
        id: "stay_home",
        text: "Stay home with a good book, game, or movie",
        tags: ["homebody", "cozy", "tech-friendly"]
      },
      {
        id: "outdoor_activity",
        text: "Go hiking or do something outdoorsy",
        tags: ["outdoor", "practical", "adventure"]
      },
      {
        id: "attend_event",
        text: "Attend a concert, party, or event",
        tags: ["social", "statement", "trend-seeker"]
      }
    ]
  },
  {
    id: "buying_approach",
    text: "What's your approach to buying new things?",
    choices: [
      {
        id: "style_match",
        text: "Style — it has to match my vibe",
        tags: ["style-conscious", "aesthetic-priority"]
      },
      {
        id: "best_deal",
        text: "Price — I look for the best deal",
        tags: ["budget-conscious", "deal-hunter"]
      },
      {
        id: "functionality",
        text: "Functionality — I want it to work well",
        tags: ["practical", "utility-first"]
      },
      {
        id: "uniqueness",
        text: "Uniqueness — I like things no one else has",
        tags: ["novelty-seeker", "statement"]
      }
    ]
  },
  {
    id: "comfort_statement",
    text: "When choosing what to wear, do you prioritize comfort or making a statement?",
    choices: [
      {
        id: "comfortable_pieces",
        text: "Comfortable, worn-in pieces",
        tags: ["comfort-first", "casual"]
      },
      {
        id: "gets_compliments",
        text: "Something that gets compliments",
        tags: ["statement", "style-conscious"]
      }
    ]
  },
  {
    id: "space_vibe",
    text: "What kind of space vibe appeals to you most?",
    choices: [
      {
        id: "minimalist",
        text: "Minimalist",
        tags: ["minimal", "neutral", "organized"]
      },
      {
        id: "cozy_warm",
        text: "Cozy & warm",
        tags: ["cozy", "layered", "homebody"]
      },
      {
        id: "eclectic",
        text: "Eclectic",
        tags: ["eclectic", "colorful", "novelty-seeker"]
      },
      {
        id: "modern_tech",
        text: "Modern tech-heavy",
        tags: ["tech-friendly", "sleek", "modern"]
      }
    ]
  },
  {
    id: "impulse_vs_planned",
    text: "When you see something you like, do you:",
    choices: [
      {
        id: "buy_right_away",
        text: "Buy right away",
        tags: ["impulsive", "novelty-seeker"]
      },
      {
        id: "save_and_think",
        text: "Save & think about it",
        tags: ["considered-buyer", "deliberate"]
      },
      {
        id: "wait_for_sale",
        text: "Wait for it to go on sale",
        tags: ["budget-conscious", "deal-hunter"]
      }
    ]
  },
  {
    id: "functional_vs_aspirational",
    text: "Are you more likely to buy:",
    choices: [
      {
        id: "something_need",
        text: "Something I need",
        tags: ["utility-first", "practical"]
      },
      {
        id: "fun_luxurious",
        text: "Something fun/luxurious",
        tags: ["aspirational", "luxury-inclined"]
      }
    ]
  },
  {
    id: "color_palette",
    text: "Which color palette makes you feel most comfortable?",
    choices: [
      {
        id: "neutral_earth",
        text: "Neutral earth tones",
        tags: ["neutral", "earthy"]
      },
      {
        id: "black_white_gray",
        text: "Black/white/gray",
        tags: ["monochrome", "minimal"]
      },
      {
        id: "bright_colors",
        text: "Bright colors",
        tags: ["vibrant", "playful"]
      },
      {
        id: "pastels",
        text: "Pastels",
        tags: ["soft", "pastel-lover"]
      }
    ]
  },
  {
    id: "change_appetite",
    text: "How often do you like to change up your style?",
    choices: [
      {
        id: "rarely_change",
        text: "Rarely change — I know what I like",
        tags: ["consistent-style", "loyalty-prone"]
      },
      {
        id: "refresh_seasonally",
        text: "Refresh seasonally",
        tags: ["seasonal-updater", "moderate-novelty"]
      },
      {
        id: "change_all_time",
        text: "Change all the time — I get bored easily",
        tags: ["frequent-updater", "novelty-seeker"]
      }
    ]
  }
];

// Simplified daily check-in questions
export const DAILY_QUESTIONS: Question[] = [
  {
    id: "daily_energy",
    text: "How are you feeling today?",
    choices: [
      {
        id: "energetic",
        text: "Energetic and ready to explore",
        tags: ["high-energy", "adventurous"]
      },
      {
        id: "calm",
        text: "Calm and content",
        tags: ["peaceful", "satisfied"]
      },
      {
        id: "need_comfort",
        text: "Need some comfort and coziness",
        tags: ["comfort-seeking", "homebody"]
      }
    ]
  },
  {
    id: "daily_priorities",
    text: "What's your priority today?",
    choices: [
      {
        id: "productivity",
        text: "Being productive and getting things done",
        tags: ["goal-oriented", "efficient"]
      },
      {
        id: "relaxation",
        text: "Relaxation and self-care",
        tags: ["wellness-focused", "mindful"]
      },
      {
        id: "social_connection",
        text: "Connecting with others",
        tags: ["social", "community-oriented"]
      }
    ]
  },
  {
    id: "daily_discovery",
    text: "What sounds most appealing right now?",
    choices: [
      {
        id: "try_something_new",
        text: "Trying something completely new",
        tags: ["novelty-seeker", "experimental"]
      },
      {
        id: "improve_existing",
        text: "Improving something I already have",
        tags: ["optimizer", "practical"]
      },
      {
        id: "enjoy_favorites",
        text: "Enjoying my current favorites",
        tags: ["consistent", "content"]
      }
    ]
  }
];