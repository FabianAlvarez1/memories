import type { Emotion } from '@/types/emotion';

// =========================================================
// Plutchik Wheel — 28 Emotions with colors from mm.md spec
// =========================================================

export const PLUTCHIK_EMOTIONS: Emotion[] = [
  // JOY axis (intensity 3 → 2 → 1)
  { id: 'ecstasy',      name: 'Éxtasis',      name_en: 'Ecstasy',      color: '#FFCC01', category: 'joy',          intensity: 3 },
  { id: 'joy',          name: 'Alegría',       name_en: 'Joy',          color: '#FFE848', category: 'joy',          intensity: 2 },
  { id: 'serenity',     name: 'Serenidad',     name_en: 'Serenity',     color: '#FFEF85', category: 'joy',          intensity: 1 },

  // JOY + TRUST composite
  { id: 'love',         name: 'Amor',          name_en: 'Love',         color: '#DCE359', category: 'joy',          intensity: 2 },

  // TRUST axis
  { id: 'admiration',   name: 'Admiración',    name_en: 'Admiration',   color: '#80C630', category: 'trust',        intensity: 3 },
  { id: 'trust',        name: 'Confianza',     name_en: 'Trust',        color: '#B7DC68', category: 'trust',        intensity: 2 },
  { id: 'acceptance',   name: 'Aceptación',    name_en: 'Acceptance',   color: '#D1E89A', category: 'trust',        intensity: 1 },

  // TRUST + FEAR composite
  { id: 'submission',   name: 'Sumisión',      name_en: 'Submission',   color: '#8BD073', category: 'trust',        intensity: 2 },

  // FEAR axis
  { id: 'terror',       name: 'Terror',        name_en: 'Terror',       color: '#008738', category: 'fear',         intensity: 3 },
  { id: 'fear',         name: 'Temor',         name_en: 'Fear',         color: '#5DC27E', category: 'fear',         intensity: 2 },
  { id: 'apprehension', name: 'Preocupación',  name_en: 'Apprehension', color: '#93D6AA', category: 'fear',         intensity: 1 },

  // FEAR + SURPRISE composite
  { id: 'awe',          name: 'Miedo',         name_en: 'Awe',          color: '#53C6B5', category: 'fear',         intensity: 2 },

  // SURPRISE axis
  { id: 'amazement',    name: 'Asombro',       name_en: 'Amazement',    color: '#0386AC', category: 'surprise',     intensity: 3 },
  { id: 'surprise',     name: 'Sorpresa',      name_en: 'Surprise',     color: '#49CBED', category: 'surprise',     intensity: 2 },
  { id: 'distraction',  name: 'Distracción',   name_en: 'Distraction',  color: '#87DEF2', category: 'surprise',     intensity: 1 },

  // SURPRISE + SADNESS composite
  { id: 'disapproval',  name: 'Desaprobación', name_en: 'Disapproval',  color: '#4AB3EC', category: 'surprise',     intensity: 2 },

  // SADNESS axis
  { id: 'grief',        name: 'Dolor',         name_en: 'Grief',        color: '#3C6DB0', category: 'sadness',      intensity: 3 },
  { id: 'sadness',      name: 'Tristeza',      name_en: 'Sadness',      color: '#4B9AE9', category: 'sadness',      intensity: 2 },
  { id: 'pensiveness',  name: 'Pensativo',     name_en: 'Pensiveness',  color: '#87BCF2', category: 'sadness',      intensity: 1 },

  // SADNESS + DISGUST composite
  { id: 'remorse',      name: 'Remordimiento', name_en: 'Remorse',      color: '#6D85DB', category: 'sadness',      intensity: 2 },

  // DISGUST axis
  { id: 'loathing',     name: 'Repulsión',     name_en: 'Loathing',     color: '#8154A6', category: 'disgust',      intensity: 3 },
  { id: 'disgust',      name: 'Desagrado',     name_en: 'Disgust',      color: '#9071CE', category: 'disgust',      intensity: 2 },
  { id: 'boredom',      name: 'Aburrimiento',  name_en: 'Boredom',      color: '#B4A2DE', category: 'disgust',      intensity: 1 },

  // DISGUST + ANGER composite
  { id: 'contempt',     name: 'Desprecio',     name_en: 'Contempt',     color: '#BD719F', category: 'disgust',      intensity: 2 },

  // ANGER axis
  { id: 'rage',         name: 'Rabia',         name_en: 'Rage',         color: '#E2403D', category: 'anger',        intensity: 3 },
  { id: 'anger',        name: 'Ira',           name_en: 'Anger',        color: '#E8706F', category: 'anger',        intensity: 2 },
  { id: 'annoyance',    name: 'Molestia',      name_en: 'Annoyance',    color: '#F0A19D', category: 'anger',        intensity: 1 },

  // ANGER + ANTICIPATION composite
  { id: 'aggressiveness', name: 'Agresividad', name_en: 'Aggressiveness', color: '#F38763', category: 'anger',      intensity: 2 },

  // ANTICIPATION axis
  { id: 'vigilance',    name: 'Vigilancia',    name_en: 'Vigilance',    color: '#FF7D1D', category: 'anticipation', intensity: 3 },
  { id: 'anticipation', name: 'Anticipación',  name_en: 'Anticipation', color: '#FC9E58', category: 'anticipation', intensity: 2 },
  { id: 'interest',     name: 'Interés',       name_en: 'Interest',     color: '#FEBF93', category: 'anticipation', intensity: 1 },

  // ANTICIPATION + JOY composite
  { id: 'optimism',     name: 'Optimismo',     name_en: 'Optimism',     color: '#FFC351', category: 'anticipation', intensity: 2 },
];

// Quick lookup map by id
export const EMOTION_MAP = new Map<string, Emotion>(
  PLUTCHIK_EMOTIONS.map(e => [e.id, e])
);

// Get emotion color by id (fallback: brand turquoise)
export function getEmotionColor(emotionId: string | null): string {
  if (!emotionId) return '#00d4bf';
  return EMOTION_MAP.get(emotionId)?.color ?? '#00d4bf';
}

// Get emotion by id
export function getEmotion(emotionId: string | null): Emotion | null {
  if (!emotionId) return null;
  return EMOTION_MAP.get(emotionId) ?? null;
}

// Default emotion when none is detected
export const DEFAULT_EMOTION_COLOR = '#00d4bf';
