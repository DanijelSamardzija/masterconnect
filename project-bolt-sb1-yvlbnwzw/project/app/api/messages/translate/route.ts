import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@supabase/supabase-js'
import Anthropic                    from '@anthropic-ai/sdk'
import { z }                        from 'zod'

export const runtime     = 'nodejs'
export const maxDuration = 30

const HAIKU_MODEL                    = 'claude-haiku-4-5-20251001'
const HAIKU_INPUT_COST_PER_TOKEN     = 0.00000080
const HAIKU_OUTPUT_COST_PER_TOKEN    = 0.00000400
const MAX_FRESH_TRANSLATIONS_PER_DAY = 30

const LANG_LABELS: Record<string, string> = {
  sr: 'Serbian (Srpski)',
  en: 'English',
  de: 'German (Deutsch)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
}

const bodySchema = z.object({
  message_id:  z.string().uuid(),
  target_lang: z.enum(['sr', 'en', 'de', 'es', 'fr']),
})

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAuthClient(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const token      = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const userClient = await getAuthClient(token)
    const { data: { user }, error: authError } = await userClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // ── Validate body ─────────────────────────────────────────────────────
    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    const { message_id, target_lang } = parsed.data

    // ── Read message (RLS enforces access — user must be sender or receiver) ─
    const { data: msg, error: msgError } = await userClient
      .from('messages')
      .select('id, text, meta, is_system, is_deleted')
      .eq('id', message_id)
      .single()

    if (msgError || !msg) return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    if (msg.is_system || msg.is_deleted) return NextResponse.json({ error: 'Cannot translate this message' }, { status: 400 })
    if (!msg.text || msg.text.length < 2) return NextResponse.json({ error: 'Nothing to translate' }, { status: 400 })

    const svc = serviceClient()

    // ── Check cache ───────────────────────────────────────────────────────
    const existingMeta = (msg.meta as Record<string, unknown>) ?? {}
    const existingTranslations = (existingMeta.translations as Record<string, string>) ?? {}
    if (existingTranslations[target_lang]) {
      // Log cache hit (fire-and-forget, do not block response)
      svc.from('ai_translation_log').insert({
        user_id: user.id, message_id, target_lang, cache_hit: true,
      }).then(() => {}, () => {})
      return NextResponse.json({ text: existingTranslations[target_lang], cached: true })
    }

    // ── Rate limit: max 30 fresh translations per 24h ─────────────────────
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString()

    const { count: freshToday } = await svc
      .from('ai_translation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('cache_hit', false)
      .gte('created_at', dayAgo)

    if ((freshToday ?? 0) >= MAX_FRESH_TRANSLATIONS_PER_DAY) {
      return NextResponse.json(
        { error: 'translation_rate_limit', retry_after: '24h' },
        { status: 429 },
      )
    }

    // ── Haiku translation ─────────────────────────────────────────────────
    const langLabel = LANG_LABELS[target_lang] ?? 'English'
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model:       HAIKU_MODEL,
      max_tokens:  1024,
      temperature: 0.1,
      system: 'You are a professional translator. Translate the given text to the target language. Output ONLY the translated text — no quotes, no explanation, no added text.',
      messages: [{
        role:    'user',
        content: `Translate to ${langLabel}:\n\n${msg.text}`,
      }],
    })

    const translatedText = response.content[0]?.type === 'text'
      ? response.content[0].text.trim()
      : msg.text

    const costUsd =
      response.usage.input_tokens  * HAIKU_INPUT_COST_PER_TOKEN +
      response.usage.output_tokens * HAIKU_OUTPUT_COST_PER_TOKEN

    // ── Cache in messages.meta.translations + log fresh call ─────────────
    const updatedTranslations = { ...existingTranslations, [target_lang]: translatedText }
    await Promise.all([
      svc
        .from('messages')
        .update({ meta: { ...existingMeta, translations: updatedTranslations } })
        .eq('id', message_id),
      svc.from('ai_translation_log').insert({
        user_id:       user.id,
        message_id,
        target_lang,
        cache_hit:     false,
        input_tokens:  response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        cost_usd:      costUsd,
      }),
    ])

    return NextResponse.json({ text: translatedText, cached: false })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error'
    console.error('[messages/translate]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
