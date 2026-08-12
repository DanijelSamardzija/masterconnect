import { NextRequest, NextResponse } from 'next/server';
import { waitUntil } from '@vercel/functions';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { fetchPostMetadata, isPostComplete } from '@/lib/smart-guidance/metadata-check';
import { classifyPost } from '@/lib/smart-guidance/classifier';
import { checkAntiSpam } from '@/lib/smart-guidance/anti-spam';
import { buildNotification } from '@/lib/smart-guidance/notification-builder';

export const runtime = 'nodejs';

// Delay to allow post_media rows to be inserted by the client after the post is created
const MEDIA_INSERT_DELAY_MS = 3000;

async function analyzePost(postId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let logEntry: Record<string, unknown> = { post_id: postId, triggered_by: 'post_create' };

  try {
    // Wait for client to finish uploading post_media
    await new Promise(resolve => setTimeout(resolve, MEDIA_INSERT_DELAY_MS));

    const meta = await fetchPostMetadata(postId, supabase);
    if (!meta) {
      // Post was deleted before we could analyze it
      return;
    }

    logEntry.user_id = meta.userId;
    logEntry.current_section = meta.postType;
    logEntry.post_text_hash = crypto
      .createHash('md5')
      .update(meta.text)
      .digest('hex');

    // Fast path: post is already complete, no guidance needed
    // Exception: service_listing always runs through AI to potentially send service_to_feed
    if (isPostComplete(meta) && meta.postType !== 'service_listing') {
      await supabase.from('post_guidance_log').insert({
        ...logEntry,
        guidance_type: 'no_action',
        should_send: false,
        guidance_sent: false,
        detected_language: meta.profilePreferredLanguage ?? 'sr',
        detected_intent: 'SOCIAL',
        confidence_score: 1.0,
      });
      return;
    }

    // AI classification
    const result = await classifyPost(meta);

    logEntry = {
      ...logEntry,
      detected_language: result.detectedLanguage,
      detected_intent: result.detectedIntent,
      recommended_section: result.recommendedSection ?? null,
      missing_fields: result.missingFields,
      has_image_only: result.hasImageOnly,
      image_extracted_text: result.imageExtractedText ?? null,
      guidance_type: result.guidanceType,
      confidence_score: result.confidence,
      should_send: result.shouldSend,
      raw_ai_response: result.rawAiResponse ?? null,
    };

    if (!result.shouldSend) {
      await supabase.from('post_guidance_log').insert({
        ...logEntry,
        guidance_sent: false,
      });
      return;
    }

    // Anti-spam check
    const spam = await checkAntiSpam(meta.userId, result.guidanceType, postId, supabase);
    if (!spam.allowed) {
      await supabase.from('post_guidance_log').insert({
        ...logEntry,
        guidance_sent: false,
        error: `anti_spam:${spam.reason}`,
      });
      return;
    }

    // Build notification content
    const notification = buildNotification(
      result.detectedLanguage,
      result.detectedIntent,
      result.guidanceType,
      postId
    );

    // Insert notification — existing push webhook will handle push + any email
    const { data: notifRow, error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: meta.userId,
        type: 'admin',
        action_type: 'smart_guidance',
        title: notification.title,
        body: notification.body,
        post_id: postId,
        meta: {
          guidance_type: result.guidanceType,
          recommended_section: result.recommendedSection,
          cta_url: notification.ctaUrl,
          detected_language: result.detectedLanguage,
          confidence: result.confidence,
        },
      })
      .select('id')
      .single();

    if (notifError) {
      console.error('[SmartGuidance] Failed to insert notification:', notifError.message);
      await supabase.from('post_guidance_log').insert({
        ...logEntry,
        guidance_sent: false,
        error: `notif_insert:${notifError.message}`,
      });
      return;
    }

    // Log success
    await supabase.from('post_guidance_log').insert({
      ...logEntry,
      guidance_sent: true,
      notification_id: notifRow.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[SmartGuidance] Unexpected error:', message);

    // Always log, even on error
    try {
      const supabaseForLog = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      await supabaseForLog.from('post_guidance_log').insert({
        ...logEntry,
        guidance_sent: false,
        error: message,
      });
    } catch { /* silent */ }
  }
}

export async function POST(request: NextRequest) {
  // Validate webhook secret
  const secret = request.headers.get('x-webhook-secret');
  if (
    !process.env.SMART_GUIDANCE_WEBHOOK_SECRET ||
    secret !== process.env.SMART_GUIDANCE_WEBHOOK_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { type?: string; record?: { id?: string; post_type?: string; status?: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only process INSERT events on the posts table
  if (body.type !== 'INSERT' || !body.record?.id) {
    return NextResponse.json({ ok: true });
  }

  const postId = body.record.id;
  const postType = body.record.post_type ?? '';
  const status = body.record.status ?? '';

  // Skip non-published and portfolio posts
  if (status !== 'published' && status !== '') {
    return NextResponse.json({ ok: true });
  }
  if (postType === 'portfolio_post') {
    return NextResponse.json({ ok: true });
  }

  // Return 200 immediately, analyze in background
  waitUntil(analyzePost(postId));

  return NextResponse.json({ ok: true });
}
