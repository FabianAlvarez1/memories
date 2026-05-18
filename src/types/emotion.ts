// =========================================================
// EMOTIONS — Plutchik Wheel Types
// =========================================================

export type EmotionCategory =
  | 'joy' | 'trust' | 'fear' | 'surprise'
  | 'sadness' | 'disgust' | 'anger' | 'anticipation';

export type EmotionIntensity = 1 | 2 | 3; // 1=low, 2=mid, 3=high

export interface Emotion {
  id: string;
  name: string;       // Spanish name: "Éxtasis"
  name_en: string;    // English: "Ecstasy"
  color: string;      // Hex: "#FFCC01"
  category: EmotionCategory;
  intensity: EmotionIntensity;
}

export interface EmotionScore {
  emotion_id: string;
  score: number; // 0.0 - 1.0
}

export interface EmotionAnalysis {
  primary_emotion_id: string;
  scores: EmotionScore[];
  analyzed_at: string; // ISO date
  is_manual: boolean;
}
