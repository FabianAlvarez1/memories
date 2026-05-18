// =========================================================
// MEMORY REPOSITORY
// =========================================================

import { db } from '../connection';
import { encryptText, decryptText } from '../../crypto/keyDerivation';
import type { Memory, MemoryRow, CreateMemoryInput, UpdateMemoryInput, MediaItem } from '@/types/memory';
import { v4 as uuidv4 } from 'uuid';

export const MemoryRepository = {
  /**
   * Create a new memory (encrypts title + content before storing)
   */
  async create(input: CreateMemoryInput, cryptoKey: CryptoKey): Promise<Memory> {
    const now = new Date().toISOString();
    const created_at = input.created_at || now;
    const id = uuidv4();

    const encTitle = await encryptText(input.title || '', cryptoKey);
    const encContent = await encryptText(input.content || '', cryptoKey);
    const encEmotionData = input.emotion_analysis
      ? await encryptText(JSON.stringify(input.emotion_analysis), cryptoKey)
      : null;

    const row: MemoryRow = {
      id,
      title: encTitle,
      content: encContent,
      scope: input.scope ?? 'private',
      emotion_id: input.emotion_analysis?.primary_emotion_id ?? null,
      emotion_data: encEmotionData,
      emotion_manual: input.emotion_analysis?.is_manual ? 1 : 0,
      is_synced: 0,
      created_at: created_at,
      updated_at: now,
    };

    await db.put('memory', row);

    // Store people relations
    for (const person of input.people ?? []) {
      await db.put('person', person);
      await db.put('memory_person', { memory_id: id, person_id: person.id });
    }

    // Store tag relations
    for (const tag of input.tags ?? []) {
      await db.put('tag', tag);
      await db.put('memory_tag', { memory_id: id, tag_id: tag.id });
    }

    return {
      id,
      title: input.title,
      content: input.content,
      scope: input.scope ?? 'private',
      emotion_analysis: input.emotion_analysis ?? null,
      media: [],
      people: input.people ?? [],
      tags: input.tags ?? [],
      is_synced: false,
      created_at: created_at,
      updated_at: now,
    };
  },

  /**
   * Get all memories (decrypted)
   */
  async getAll(cryptoKey: CryptoKey): Promise<Memory[]> {
    const rows = await db.getAll<MemoryRow>('memory');
    const memories: Memory[] = [];

    for (const row of rows) {
      const memory = await this.hydrateRow(row, cryptoKey);
      memories.push(memory);
    }

    // Sort by created_at descending (newest first)
    return memories.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  },

  /**
   * Get a single memory by ID (decrypted)
   */
  async getById(id: string, cryptoKey: CryptoKey): Promise<Memory | null> {
    const row = await db.getById<MemoryRow>('memory', id);
    if (!row) return null;
    return this.hydrateRow(row, cryptoKey);
  },

  /**
   * Update a memory
   */
  async update(id: string, input: UpdateMemoryInput, cryptoKey: CryptoKey): Promise<void> {
    const existing = await db.getById<MemoryRow>('memory', id);
    if (!existing) throw new Error('Memory not found');

    const now = new Date().toISOString();
    const updated: MemoryRow = { ...existing, updated_at: now, is_synced: 0 };
    if (input.created_at !== undefined) {
      updated.created_at = input.created_at;
    }

    if (input.title !== undefined) {
      updated.title = await encryptText(input.title, cryptoKey);
    }
    if (input.content !== undefined) {
      updated.content = await encryptText(input.content, cryptoKey);
    }
    if (input.scope !== undefined) {
      updated.scope = input.scope;
    }
    if (input.emotion_analysis !== undefined) {
      updated.emotion_id = input.emotion_analysis?.primary_emotion_id ?? null;
      updated.emotion_data = input.emotion_analysis
        ? await encryptText(JSON.stringify(input.emotion_analysis), cryptoKey)
        : null;
      updated.emotion_manual = input.emotion_analysis?.is_manual ? 1 : 0;
    }

    await db.put('memory', updated);
  },

  /**
   * Delete a memory and all its relations
   */
  async delete(id: string): Promise<void> {
    await db.delete('memory', id);

    // Clean up relations
    const mediItems = await db.getByIndex<MediaItem>('media', 'memory_id', id);
    for (const m of mediItems) {
      await db.delete('media', m.id);
    }

    const relations = await db.getByIndex<{ memory_id: string; person_id: string }>(
      'memory_person', 'memory_id', id
    );
    for (const r of relations) {
      await db.delete('memory_person', [r.memory_id, r.person_id]);
    }

    const tagRelations = await db.getByIndex<{ memory_id: string; tag_id: string }>(
      'memory_tag', 'memory_id', id
    );
    for (const r of tagRelations) {
      await db.delete('memory_tag', [r.memory_id, r.tag_id]);
    }
  },

  /**
   * Internal: decrypt and hydrate a MemoryRow into a Memory
   */
  async hydrateRow(row: MemoryRow, cryptoKey: CryptoKey): Promise<Memory> {
    const title = await decryptText(row.title, cryptoKey).catch(() => '[cifrado]');
    const content = await decryptText(row.content, cryptoKey).catch(() => '[cifrado]');

    let emotion_analysis = null;
    if (row.emotion_data) {
      try {
        const raw = await decryptText(row.emotion_data, cryptoKey);
        emotion_analysis = JSON.parse(raw);
      } catch {
        emotion_analysis = null;
      }
    }

    const media = await db.getByIndex<MediaItem>('media', 'memory_id', row.id);

    const personRelations = await db.getByIndex<{ memory_id: string; person_id: string }>(
      'memory_person', 'memory_id', row.id
    );
    const people = await Promise.all(
      personRelations.map(r => db.getById('person', r.person_id))
    ).then(ps => ps.filter(Boolean)) as Array<{ id: string; name: string; created_at: string }>;

    const tagRelations = await db.getByIndex<{ memory_id: string; tag_id: string }>(
      'memory_tag', 'memory_id', row.id
    );
    const tags = await Promise.all(
      tagRelations.map(r => db.getById('tag', r.tag_id))
    ).then(ts => ts.filter(Boolean)) as Array<{ id: string; name: string }>;

    return {
      id: row.id,
      title,
      content,
      scope: row.scope,
      emotion_analysis,
      media,
      people,
      tags,
      is_synced: row.is_synced === 1,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  },
};
