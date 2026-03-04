/**
 * Memory / RAG module for persistent coaching context.
 *
 * Stores user goals, rules, recurring pitfalls, and session insights
 * as embeddings for retrieval-augmented coaching conversations.
 *
 * MVP uses simple keyword matching. Production would use a vector DB.
 */

import type { MemoryEntry } from '@/types';
import { nanoid } from 'nanoid';

// In-memory store for MVP (replace with pgvector / SQLite FTS in production)
const memoryStore = new Map<string, MemoryEntry[]>();

export function addMemory(
  userId: string,
  type: MemoryEntry['type'],
  content: string
): MemoryEntry {
  const entry: MemoryEntry = {
    id: nanoid(),
    userId,
    type,
    content,
    createdAt: Date.now(),
  };

  const existing = memoryStore.get(userId) ?? [];
  existing.push(entry);

  // Keep max 100 entries per user
  if (existing.length > 100) {
    existing.shift();
  }

  memoryStore.set(userId, existing);
  return entry;
}

export function getMemories(userId: string, type?: MemoryEntry['type']): MemoryEntry[] {
  const entries = memoryStore.get(userId) ?? [];
  return type ? entries.filter(e => e.type === type) : entries;
}

/**
 * Retrieve relevant memories for a given query using keyword matching.
 * In production, this would use cosine similarity on embeddings.
 */
export function retrieveRelevantMemories(
  userId: string,
  query: string,
  maxResults = 5
): MemoryEntry[] {
  const entries = memoryStore.get(userId) ?? [];
  if (entries.length === 0) return [];

  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);

  const scored = entries.map(entry => {
    const contentWords = entry.content.toLowerCase();
    let score = 0;

    for (const word of queryWords) {
      if (contentWords.includes(word)) score += 1;
    }

    // Boost recent entries
    const ageHours = (Date.now() - entry.createdAt) / 3_600_000;
    const recencyBoost = Math.max(0, 1 - ageHours / 720); // decay over 30 days
    score += recencyBoost * 0.5;

    // Boost certain types
    if (entry.type === 'pitfall' || entry.type === 'rule') score *= 1.3;

    return { entry, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map(s => s.entry);
}

/**
 * Build a context string from relevant memories for injection into the AI prompt.
 */
export function buildMemoryContext(userId: string, query: string): string {
  const relevant = retrieveRelevantMemories(userId, query);
  if (relevant.length === 0) return '';

  const sections: string[] = [];

  const goals = relevant.filter(m => m.type === 'goal');
  if (goals.length > 0) {
    sections.push(`User Goals:\n${goals.map(g => `- ${g.content}`).join('\n')}`);
  }

  const rules = relevant.filter(m => m.type === 'rule');
  if (rules.length > 0) {
    sections.push(`Personal Rules:\n${rules.map(r => `- ${r.content}`).join('\n')}`);
  }

  const pitfalls = relevant.filter(m => m.type === 'pitfall');
  if (pitfalls.length > 0) {
    sections.push(`Known Pitfalls:\n${pitfalls.map(p => `- ${p.content}`).join('\n')}`);
  }

  const insights = relevant.filter(m => m.type === 'insight' || m.type === 'session_summary');
  if (insights.length > 0) {
    sections.push(`Previous Insights:\n${insights.map(i => `- ${i.content}`).join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Clear all memories for a user (privacy control).
 */
export function clearMemories(userId: string): void {
  memoryStore.delete(userId);
}

/**
 * Export all memories for a user (data portability).
 */
export function exportMemories(userId: string): MemoryEntry[] {
  return memoryStore.get(userId) ?? [];
}
