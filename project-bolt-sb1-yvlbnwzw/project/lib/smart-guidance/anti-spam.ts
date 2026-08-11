import type { GuidanceType } from './types';

const MAX_GUIDANCE_PER_24H = 1;
const SAME_TYPE_COOLDOWN_DAYS = 7;

export interface AntiSpamResult {
  allowed: boolean;
  reason?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkAntiSpam(
  userId: string,
  guidanceType: GuidanceType,
  postId: string,
  supabase: any
): Promise<AntiSpamResult> {
  // Check 1: max 1 guidance per user in last 24h
  const { count: last24h } = await supabase
    .from('post_guidance_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('guidance_sent', true)
    .gte('analyzed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  if ((last24h ?? 0) >= MAX_GUIDANCE_PER_24H) {
    return { allowed: false, reason: 'max_per_24h' };
  }

  // Check 2: same guidance type cooldown (7 days)
  const { count: sameTypeLast7d } = await supabase
    .from('post_guidance_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('guidance_type', guidanceType)
    .eq('guidance_sent', true)
    .gte('analyzed_at', new Date(Date.now() - SAME_TYPE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString());

  if ((sameTypeLast7d ?? 0) > 0) {
    return { allowed: false, reason: 'same_type_cooldown' };
  }

  // Check 3: this specific post was already analyzed and guidance was sent
  const { count: postAlreadyHandled } = await supabase
    .from('post_guidance_log')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)
    .eq('guidance_sent', true);

  if ((postAlreadyHandled ?? 0) > 0) {
    return { allowed: false, reason: 'post_already_handled' };
  }

  return { allowed: true };
}
