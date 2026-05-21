import type { EmotionAnalysis } from './emotion';

// =========================================================
// MEMORY — Core Types
// =========================================================

export type MemoryScope = 'private' | 'public' | 'restricted';

export type MediaType = 'image' | 'video' | 'audio' | 'document';

export interface MediaItem {
  id: string;
  memory_id: string;
  type: MediaType;
  filename: string;
  filepath: string;      // Path to encrypted file on filesystem
  mime_type: string;
  size_bytes: number;
  hash: string;          // SHA-256 of original file
  created_at: string;
}

export interface Person {
  id: string;
  name: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
}

export interface Memory {
  id: string;
  title: string;
  content: string;
  scope: MemoryScope;
  emotion_analysis: EmotionAnalysis | null;
  media: MediaItem[];
  people: Person[];
  tags: Tag[];
  is_synced: boolean;
  created_at: string;
  updated_at: string;
}

// For creating/updating — content is decrypted at this point
export type CreateMemoryInput = Omit<Memory, 'id' | 'is_synced' | 'created_at' | 'updated_at' | 'media'> & {
  created_at?: string;
};
export type UpdateMemoryInput = Partial<CreateMemoryInput>;

// What's stored in DB (everything is encrypted as text)
export interface MemoryRow {
  id: string;
  title: string;           // encrypted
  content: string;         // encrypted
  scope: MemoryScope;
  emotion_id: string | null;
  emotion_data: string | null; // encrypted JSON
  emotion_manual: number;  // 0 | 1
  is_synced: number;       // 0 | 1
  created_at: string;
  updated_at: string;
}

// Graph node for brain visualization
export interface MemoryNode {
  id: string;
  title: string;
  color: string;          // Plutchik color
  size: number;           // Based on media count
  created_at: string;
  x?: number;
  y?: number;
  z?: number;
}

// Graph link between memory nodes
export interface MemoryLink {
  source: string;
  target: string;
  strength: number;       // 0.0 - 1.0
  reason: 'person' | 'emotion' | 'temporal' | 'tag';
}

export interface BrainGraph {
  nodes: MemoryNode[];
  links: MemoryLink[];
}

// Chunk-based navigation
export interface ChunkData {
  key: string;           // e.g. "2026-05-14_2026-05-21"
  startDate: string;     // ISO string — inclusive
  endDate: string;       // ISO string — inclusive
  memories: Memory[];
  loadedAt: number;      // Date.now() for LRU eviction
}

export interface MemoryIndexEntry {
  id: string;
  title: string;
  emotion_id: string | null;
  color: string;         // Plutchik color derived from emotion
  created_at: string;
}
