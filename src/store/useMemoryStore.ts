// =========================================================
// MEMORY STORE — Zustand (Chunk-Based Navigation)
// Only render nearby temporal chunks
// =========================================================

import { create } from 'zustand';
import type { Memory, BrainGraph, MemoryNode, MemoryLink, ChunkData, MemoryIndexEntry } from '@/types/memory';
import { getEmotionColor } from '@/utils/plutchikColors';
import { MemoryRepository } from '@/services/database/repositories/MemoryRepository';

// =========================================================
// CONSTANTS
// =========================================================

const CHUNK_SIZE_DAYS = 7;   // days per chunk
const RENDER_DISTANCE = 1;   // chunks around the active one (1 = 3 chunks total)
const MAX_LOADED_CHUNKS = 5; // LRU eviction threshold

// =========================================================
// CHUNK HELPERS
// =========================================================

/** Compute the chunk key and date boundaries for a given date */
function getChunkForDate(date: Date): { key: string; startDate: Date; endDate: Date } {
  // Align to chunk boundaries: endDate = the date itself (floored to day end),
  // startDate = endDate - CHUNK_SIZE_DAYS + 1
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - CHUNK_SIZE_DAYS + 1);
  startDate.setHours(0, 0, 0, 0);

  const key = `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
  return { key, startDate, endDate };
}

/** Get chunk info offset by N chunks from a base date */
function getChunkOffset(baseDate: Date, offset: number): { key: string; startDate: Date; endDate: Date } {
  const offsetDate = new Date(baseDate);
  offsetDate.setDate(offsetDate.getDate() + offset * CHUNK_SIZE_DAYS);
  return getChunkForDate(offsetDate);
}

// =========================================================
// GRAPH BUILDER
// =========================================================

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

// =========================================================
// STORE INTERFACE
// =========================================================

interface MemoryStore {
  // Chunk system
  loadedChunks: Map<string, ChunkData>;
  loadingChunks: Set<string>;

  // Lightweight search index (all memories, titles only)
  memoryIndex: MemoryIndexEntry[];

  // Computed from loaded chunks
  visibleMemories: Memory[];
  brainGraph: BrainGraph;

  // Navigation
  viewDate: string;              // ISO string — focal date
  selectedMemoryId: string | null;
  isLoading: boolean;
  error: string | null;

  // Derived
  oldestMemoryDate: string | null;

  // Actions
  initialize: (cryptoKey: CryptoKey) => Promise<void>;
  loadChunk: (chunkKey: string, startDate: string, endDate: string, cryptoKey: CryptoKey) => Promise<void>;
  ensureChunksLoaded: (cryptoKey: CryptoKey) => Promise<void>;
  unloadDistantChunks: () => void;
  recomputeVisibles: () => void;

  addMemory: (memory: Memory) => void;
  updateMemory: (id: string, updated: Partial<Memory>) => void;
  removeMemory: (id: string) => void;
  selectMemory: (id: string | null) => void;
  setError: (error: string | null) => void;

  navigateChunk: (direction: number) => void;    // jump ±1 chunk (7 days)
  navigateDay: (days: number) => void;           // fine-grained ±1 day
  setViewDate: (date: string) => void;
  jumpToNextMemory: () => void;
  jumpToPrevMemory: () => void;
}

// =========================================================
// STORE IMPLEMENTATION
// =========================================================

export const useMemoryStore = create<MemoryStore>((set, get) => ({
  loadedChunks: new Map(),
  loadingChunks: new Set(),
  memoryIndex: [],
  visibleMemories: [],
  brainGraph: { nodes: [], links: [] },
  selectedMemoryId: null,
  isLoading: false,
  error: null,
  viewDate: new Date().toISOString(),
  oldestMemoryDate: null,

  // ---------------------------------------------------------
  // INITIALIZE — Load lightweight index + initial chunks
  // ---------------------------------------------------------
  initialize: async (cryptoKey) => {
    set({ isLoading: true, error: null });
    try {
      // 1. Load lightweight index (titles + dates only — fast)
      const memoryIndex = await MemoryRepository.getLightIndex(cryptoKey);

      // Compute oldest memory date from the index
      let oldest: string | null = null;
      for (const entry of memoryIndex) {
        if (!oldest || new Date(entry.created_at) < new Date(oldest)) {
          oldest = entry.created_at;
        }
      }

      set({ memoryIndex, oldestMemoryDate: oldest });

      // 2. Load the current chunk + adjacent chunks
      const viewDate = new Date(get().viewDate);
      const currentChunk = getChunkForDate(viewDate);

      // Load current chunk
      await get().loadChunk(
        currentChunk.key,
        currentChunk.startDate.toISOString(),
        currentChunk.endDate.toISOString(),
        cryptoKey
      );

      // Load adjacent chunks (preloading)
      for (let offset = -RENDER_DISTANCE; offset <= RENDER_DISTANCE; offset++) {
        if (offset === 0) continue; // already loaded
        const adj = getChunkOffset(viewDate, offset);
        // Don't load future chunks beyond today
        if (adj.startDate > new Date()) continue;
        get().loadChunk(adj.key, adj.startDate.toISOString(), adj.endDate.toISOString(), cryptoKey);
      }

      get().recomputeVisibles();
      set({ isLoading: false });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  // ---------------------------------------------------------
  // LOAD CHUNK — Fetch + decrypt memories for a date range
  // ---------------------------------------------------------
  loadChunk: async (chunkKey, startDate, endDate, cryptoKey) => {
    const { loadedChunks, loadingChunks } = get();

    // Skip if already loaded or loading
    if (loadedChunks.has(chunkKey) || loadingChunks.has(chunkKey)) return;

    // Mark as loading
    const newLoading = new Set(loadingChunks);
    newLoading.add(chunkKey);
    set({ loadingChunks: newLoading });

    try {
      const memories = await MemoryRepository.getByDateRange(startDate, endDate, cryptoKey);

      const chunk: ChunkData = {
        key: chunkKey,
        startDate,
        endDate,
        memories,
        loadedAt: Date.now(),
      };

      const updatedChunks = new Map(get().loadedChunks);
      updatedChunks.set(chunkKey, chunk);

      const updatedLoading = new Set(get().loadingChunks);
      updatedLoading.delete(chunkKey);

      set({ loadedChunks: updatedChunks, loadingChunks: updatedLoading });
      get().recomputeVisibles();
    } catch (err) {
      const updatedLoading = new Set(get().loadingChunks);
      updatedLoading.delete(chunkKey);
      set({ loadingChunks: updatedLoading, error: String(err) });
    }
  },

  // ---------------------------------------------------------
  // ENSURE CHUNKS — Load current + adjacent chunks if needed
  // ---------------------------------------------------------
  ensureChunksLoaded: async (cryptoKey) => {
    const viewDate = new Date(get().viewDate);

    for (let offset = -RENDER_DISTANCE; offset <= RENDER_DISTANCE; offset++) {
      const chunk = getChunkOffset(viewDate, offset);
      // Don't load future chunks beyond today
      if (chunk.startDate > new Date()) continue;
      await get().loadChunk(chunk.key, chunk.startDate.toISOString(), chunk.endDate.toISOString(), cryptoKey);
    }

    get().unloadDistantChunks();
  },

  // ---------------------------------------------------------
  // UNLOAD DISTANT CHUNKS — LRU eviction
  // ---------------------------------------------------------
  unloadDistantChunks: () => {
    const { loadedChunks, viewDate } = get();
    if (loadedChunks.size <= MAX_LOADED_CHUNKS) return;

    const vd = new Date(viewDate);
    const currentChunk = getChunkForDate(vd);

    // Compute which chunk keys are "near" (within render distance)
    const nearKeys = new Set<string>();
    for (let offset = -RENDER_DISTANCE; offset <= RENDER_DISTANCE; offset++) {
      const chunk = getChunkOffset(vd, offset);
      nearKeys.add(chunk.key);
    }

    // Find chunks to evict: not near, sorted by loadedAt (oldest first)
    const evictCandidates = Array.from(loadedChunks.entries())
      .filter(([key]) => !nearKeys.has(key))
      .sort((a, b) => a[1].loadedAt - b[1].loadedAt);

    const numToEvict = loadedChunks.size - MAX_LOADED_CHUNKS;
    if (numToEvict <= 0) return;

    const updatedChunks = new Map(loadedChunks);
    for (let i = 0; i < numToEvict && i < evictCandidates.length; i++) {
      updatedChunks.delete(evictCandidates[i][0]);
    }

    set({ loadedChunks: updatedChunks });
    get().recomputeVisibles();
  },

  // ---------------------------------------------------------
  // RECOMPUTE VISIBLES — Merge all loaded chunks into flat arrays
  // ---------------------------------------------------------
  recomputeVisibles: () => {
    const { loadedChunks } = get();

    // Merge all memories from loaded chunks, deduplicate by id
    const seen = new Set<string>();
    const allMemories: Memory[] = [];

    for (const chunk of loadedChunks.values()) {
      for (const m of chunk.memories) {
        if (!seen.has(m.id)) {
          seen.add(m.id);
          allMemories.push(m);
        }
      }
    }

    // Sort newest first
    allMemories.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const brainGraph = buildGraph(allMemories);
    set({ visibleMemories: allMemories, brainGraph });
  },

  // ---------------------------------------------------------
  // CRUD — Update chunk + index
  // ---------------------------------------------------------
  addMemory: (memory) => {
    // Update the search index
    const memoryIndex = [{
      id: memory.id,
      title: memory.title,
      emotion_id: memory.emotion_analysis?.primary_emotion_id ?? null,
      color: getEmotionColor(memory.emotion_analysis?.primary_emotion_id ?? null),
      created_at: memory.created_at,
    }, ...get().memoryIndex];

    // Find which chunk this memory belongs to and add it
    const memDate = new Date(memory.created_at);
    const chunkInfo = getChunkForDate(memDate);
    const loadedChunks = new Map(get().loadedChunks);

    if (loadedChunks.has(chunkInfo.key)) {
      const chunk = loadedChunks.get(chunkInfo.key)!;
      loadedChunks.set(chunkInfo.key, {
        ...chunk,
        memories: [memory, ...chunk.memories],
        loadedAt: Date.now(),
      });
    }

    set({ memoryIndex, loadedChunks });
    get().recomputeVisibles();
  },

  updateMemory: (id, updated) => {
    // Update index
    const memoryIndex = get().memoryIndex.map(entry =>
      entry.id === id ? {
        ...entry,
        ...(updated.title !== undefined ? { title: updated.title } : {}),
        ...(updated.created_at !== undefined ? { created_at: updated.created_at } : {}),
        ...(updated.emotion_analysis !== undefined ? {
          emotion_id: updated.emotion_analysis?.primary_emotion_id ?? null,
          color: getEmotionColor(updated.emotion_analysis?.primary_emotion_id ?? null),
        } : {}),
      } : entry
    );

    // Update in loaded chunks
    const loadedChunks = new Map(get().loadedChunks);
    for (const [key, chunk] of loadedChunks) {
      const idx = chunk.memories.findIndex(m => m.id === id);
      if (idx !== -1) {
        const updatedMemories = [...chunk.memories];
        updatedMemories[idx] = { ...updatedMemories[idx], ...updated };
        loadedChunks.set(key, { ...chunk, memories: updatedMemories });
        break;
      }
    }

    set({ memoryIndex, loadedChunks });
    get().recomputeVisibles();
  },

  removeMemory: (id) => {
    // Remove from index
    const memoryIndex = get().memoryIndex.filter(entry => entry.id !== id);

    // Remove from loaded chunks
    const loadedChunks = new Map(get().loadedChunks);
    for (const [key, chunk] of loadedChunks) {
      const filtered = chunk.memories.filter(m => m.id !== id);
      if (filtered.length !== chunk.memories.length) {
        loadedChunks.set(key, { ...chunk, memories: filtered });
        break;
      }
    }

    set({ memoryIndex, loadedChunks });
    get().recomputeVisibles();
  },

  selectMemory: (id) => set({ selectedMemoryId: id }),

  setError: (error) => set({ error }),

  setViewDate: (date) => set({ viewDate: date }),

  // ---------------------------------------------------------
  // NAVIGATION — Chunk-level (±7 days)
  // ---------------------------------------------------------
  navigateChunk: (direction) => {
    const current = new Date(get().viewDate);
    current.setDate(current.getDate() + direction * CHUNK_SIZE_DAYS);

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

  // ---------------------------------------------------------
  // NAVIGATION — Day-level (±1 day, fine-grained)
  // ---------------------------------------------------------
  navigateDay: (days) => {
    const current = new Date(get().viewDate);
    current.setDate(current.getDate() + days);

    const now = new Date();
    if (current > now) {
      set({ viewDate: now.toISOString() });
      return;
    }

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

  // ---------------------------------------------------------
  // JUMP TO NEXT/PREV MEMORY — Uses lightweight index
  // ---------------------------------------------------------
  jumpToNextMemory: () => {
    const { memoryIndex, viewDate } = get();
    const vd = new Date(viewDate).getTime();
    const now = Date.now();

    let closest: number | null = null;
    for (const entry of memoryIndex) {
      const t = new Date(entry.created_at).getTime();
      if (t > vd && t <= now) {
        if (closest === null || t < closest) closest = t;
      }
    }
    if (closest !== null) {
      set({ viewDate: new Date(closest).toISOString() });
    }
  },

  jumpToPrevMemory: () => {
    const { memoryIndex, viewDate } = get();
    const windowStart = new Date(viewDate);
    windowStart.setDate(windowStart.getDate() - CHUNK_SIZE_DAYS);
    const wsTime = windowStart.getTime();

    let closest: number | null = null;
    for (const entry of memoryIndex) {
      const t = new Date(entry.created_at).getTime();
      if (t < wsTime) {
        if (closest === null || t > closest) closest = t;
      }
    }
    if (closest !== null) {
      set({ viewDate: new Date(closest).toISOString() });
    }
  },
}));

// Export chunk size for use in UI
export const CHUNK_SIZE = CHUNK_SIZE_DAYS;
