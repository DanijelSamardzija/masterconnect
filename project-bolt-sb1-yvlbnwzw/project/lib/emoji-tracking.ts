import { supabase } from '@/lib/supabase/client';

const RECENT_EMOJIS_KEY = 'recent_emojis';
const MAX_RECENT_EMOJIS = 20;

export function getRecentEmojis(): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error reading recent emojis from localStorage:', error);
    return [];
  }
}

export function saveRecentEmojis(emojis: string[]): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(emojis));
  } catch (error) {
    console.error('Error saving recent emojis to localStorage:', error);
  }
}

export function addRecentEmoji(emoji: string): string[] {
  const recents = getRecentEmojis();

  const filtered = recents.filter(e => e !== emoji);

  const updated = [emoji, ...filtered].slice(0, MAX_RECENT_EMOJIS);

  saveRecentEmojis(updated);

  return updated;
}

export async function syncRecentEmojisToDatabase(userId: string, emojis: string[]): Promise<void> {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ recent_emojis: emojis })
      .eq('id', userId);

    if (error) {
      console.error('Error syncing recent emojis to database:', error);
    }
  } catch (error) {
    console.error('Error syncing recent emojis to database:', error);
  }
}

export async function loadRecentEmojisFromDatabase(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('recent_emojis')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return [];
    }

    const dbEmojis = (data.recent_emojis as string[]) || [];
    const localEmojis = getRecentEmojis();

    if (dbEmojis.length === 0 && localEmojis.length === 0) {
      return [];
    }

    if (dbEmojis.length === 0) {
      await syncRecentEmojisToDatabase(userId, localEmojis);
      return localEmojis;
    }

    if (localEmojis.length === 0) {
      saveRecentEmojis(dbEmojis);
      return dbEmojis;
    }

    const seen = new Set<string>();
    const merged: string[] = [];

    for (const emoji of [...localEmojis, ...dbEmojis]) {
      if (!seen.has(emoji) && merged.length < MAX_RECENT_EMOJIS) {
        seen.add(emoji);
        merged.push(emoji);
      }
    }

    saveRecentEmojis(merged);
    await syncRecentEmojisToDatabase(userId, merged);

    return merged;
  } catch (error) {
    console.error('Error loading recent emojis from database:', error);
    return getRecentEmojis();
  }
}
