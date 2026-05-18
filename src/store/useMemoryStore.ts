// =========================================================
// MEMORY STORE — Zustand
// =========================================================

import { create } from 'zustand';
import type { Memory, BrainGraph, MemoryNode, MemoryLink } from '@/types/memory';
import { getEmotionColor } from '@/utils/plutchikColors';
import { MemoryRepository } from '@/services/database/repositories/MemoryRepository';

interface MemoryStore {
  memories: Memory[];
  brainGraph: BrainGraph;
  selectedMemoryId: string | null;
  isLoading: boolean;
  error: string | null;

  // Temporal navigation
  viewDate: string;            // ISO string — the "front" of the 5-day window
  oldestMemoryDate: string | null;

  // Actions
  loadMemories: (cryptoKey: CryptoKey) => Promise<void>;
  addMemory: (memory: Memory) => void;
  updateMemory: (id: string, updated: Partial<Memory>) => void;
  removeMemory: (id: string) => void;
  selectMemory: (id: string | null) => void;
  rebuildGraph: () => void;
  setError: (error: string | null) => void;
  navigateTime: (days: number) => void;
  setViewDate: (date: string) => void;
  jumpToNextMemory: () => void;
  jumpToPrevMemory: () => void;
}

function buildGraph(memories: Memory[]): BrainGraph {
  const nodes: MemoryNode[] = memories.map((m) => ({
    id: m.id,
    title: m.title,
    color: getEmotionColor(m.emotion_analysis?.primary_emotion_id ?? null),
    size: 1 + (m.media?.length ?? 0) * 0.5,
    created_at: m.created_at,
  }));

  const links: MemoryLink[] = [];

  // Build links between memories sharing people, emotions, or time proximity
  for (let i = 0; i < memories.length; i++) {
    for (let j = i + 1; j < memories.length; j++) {
      const a = memories[i];
      const b = memories[j];

      // Person connection
      const sharedPeople = a.people.filter(p =>
        b.people.some(bp => bp.id === p.id)
      );
      if (sharedPeople.length > 0) {
        links.push({
          source: a.id,
          target: b.id,
          strength: Math.min(sharedPeople.length * 0.3, 1),
          reason: 'person',
        });
        continue;
      }

      // Emotion connection (same category)
      const aEmo = a.emotion_analysis?.primary_emotion_id;
      const bEmo = b.emotion_analysis?.primary_emotion_id;
      if (aEmo && bEmo && aEmo === bEmo) {
        links.push({ source: a.id, target: b.id, strength: 0.4, reason: 'emotion' });
        continue;
      }

      // Temporal proximity (within 5-day window)
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      const diffDays = Math.abs(aDate - bDate) / (1000 * 60 * 60 * 24);
      if (diffDays <= 5) {
        links.push({ source: a.id, target: b.id, strength: 0.15, reason: 'temporal' });
      }
    }
  }

  return { nodes, links };
}

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  memories: [],
  brainGraph: { nodes: [], links: [] },
  selectedMemoryId: null,
  isLoading: false,
  error: null,
  viewDate: new Date().toISOString(),
  oldestMemoryDate: null,

  loadMemories: async (cryptoKey) => {
    set({ isLoading: true, error: null });
    try {
      const memories = await MemoryRepository.getAll(cryptoKey);
      const brainGraph = buildGraph(memories);

      // Compute oldest memory date
      let oldest: string | null = null;
      for (const m of memories) {
        if (!oldest || new Date(m.created_at) < new Date(oldest)) {
          oldest = m.created_at;
        }
      }

      set({ memories, brainGraph, oldestMemoryDate: oldest, isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  addMemory: (memory) => {
    const memories = [memory, ...get().memories];
    set({ memories, brainGraph: buildGraph(memories) });
  },

  updateMemory: (id, updated) => {
    const memories = get().memories.map(m =>
      m.id === id ? { ...m, ...updated } : m
    );
    set({ memories, brainGraph: buildGraph(memories) });
  },

  removeMemory: (id) => {
    const memories = get().memories.filter(m => m.id !== id);
    set({ memories, brainGraph: buildGraph(memories) });
  },

  selectMemory: (id) => set({ selectedMemoryId: id }),

  rebuildGraph: () => {
    set({ brainGraph: buildGraph(get().memories) });
  },

  setError: (error) => set({ error }),

  setViewDate: (date) => set({ viewDate: date }),

  navigateTime: (days) => {
    const current = new Date(get().viewDate);
    current.setDate(current.getDate() + days);

    // Don't go beyond today
    const now = new Date();
    if (current > now) {
      set({ viewDate: now.toISOString() });
      return;
    }

    // Don't go before oldest memory
    const oldest = get().oldestMemoryDate;
    if (oldest) {
      const oldestDate = new Date(oldest);
      if (current < oldestDate) {
        set({ viewDate: oldestDate.toISOString() });
        return;
      }
    }

    set({ viewDate: current.toISOString() });
  },

  jumpToNextMemory: () => {
    const { memories, viewDate } = get();
    const vd = new Date(viewDate).getTime();
    const now = Date.now();

    // Find closest memory date AFTER the current viewDate
    let closest: number | null = null;
    for (const m of memories) {
      const t = new Date(m.created_at).getTime();
      if (t > vd && t <= now) {
        if (closest === null || t < closest) closest = t;
      }
    }
    if (closest !== null) {
      set({ viewDate: new Date(closest).toISOString() });
    }
  },

  jumpToPrevMemory: () => {
    const { memories, viewDate } = get();
    const windowStart = new Date(viewDate);
    windowStart.setDate(windowStart.getDate() - 5);
    const wsTime = windowStart.getTime();

    // Find closest memory date BEFORE the current window start
    let closest: number | null = null;
    for (const m of memories) {
      const t = new Date(m.created_at).getTime();
      if (t < wsTime) {
        if (closest === null || t > closest) closest = t;
      }
    }
    if (closest !== null) {
      set({ viewDate: new Date(closest).toISOString() });
    }
  },
}));
