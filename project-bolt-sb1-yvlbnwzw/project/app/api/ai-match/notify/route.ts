import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { runMatchingPipeline } from '@/lib/matching/pipeline'
import { sendEmail } from '@/lib/brevo'

export const runtime = 'nodejs'
// Generous timeout — pipeline + N email sends
export const maxDuration = 60

const FREE_NOTIFICATIONS_PER_MONTH = 3
const PAID_NOTIFICATION_COST       = 5  // credits
const ANTI_SPAM_HOURS              = 24  // only 1 notification per professional per 24h
const MAX_CANDIDATES_TO_NOTIFY     = 5
const MIN_SCORE_TO_NOTIFY          = 30  // skip very low-quality matches
const ELIGIBLE_POST_TYPES          = ['hiring_post', 'service_request'] as const

const bodySchema = z.object({
  post_id: z.string().uuid(),
})

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function getAuthUser(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? ''
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )
  const { data: { user }, error } = await client.auth.getUser()
  return error || !user ? null : user
}

// ── Multilingual templates ────────────────────────────────────────────────────

interface NotifTexts {
  inAppTitle:  string
  inAppBody:   string
  emailSubject: string
  emailHtml:   string
}

function buildTexts(
  lang: string,
  postTitle: string,
  posterName: string,
  postCity: string | null,
  score: number,
  postUrl: string,
): NotifTexts {
  const city = postCity ? ` · ${postCity}` : ''

  const templates: Record<string, NotifTexts> = {
    sr: {
      inAppTitle:   `Pronađen match za tebe${city}`,
      inAppBody:    `Oglas "${postTitle}" od ${posterName} podudara se ${score}% s tvojim profilom.`,
      emailSubject: `GigZone — Pronašli smo oglas koji ti odgovara`,
      emailHtml:    `
<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#f97316;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:700">GigZone</span>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;font-size:18px">Pronašli smo oglas koji ti odgovara 🎯</h2>
    <p style="color:#475569;margin:0 0 16px">${posterName} je objavio/la oglas koji odgovara tvom profilu (<strong>${score}%</strong> podudaranje)${city}.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <strong style="font-size:15px">${postTitle}</strong>
    </div>
    <a href="${postUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Pogledaj oglas</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Ne želiš ovakve obavijesti? <a href="https://www.gigzone.app/settings" style="color:#94a3b8">Isključi ih u postavkama</a>.</p>
  </div>
</div>`,
    },
    en: {
      inAppTitle:   `New match found for you${city}`,
      inAppBody:    `Listing "${postTitle}" by ${posterName} matches your profile ${score}%.`,
      emailSubject: `GigZone — We found a listing that matches you`,
      emailHtml:    `
<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#f97316;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:700">GigZone</span>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;font-size:18px">We found a listing that matches you 🎯</h2>
    <p style="color:#475569;margin:0 0 16px">${posterName} posted a listing that matches your profile (<strong>${score}%</strong> match)${city}.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <strong style="font-size:15px">${postTitle}</strong>
    </div>
    <a href="${postUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">View listing</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Don't want these notifications? <a href="https://www.gigzone.app/settings" style="color:#94a3b8">Disable them in settings</a>.</p>
  </div>
</div>`,
    },
    de: {
      inAppTitle:   `Neues Match für dich${city}`,
      inAppBody:    `Inserat „${postTitle}" von ${posterName} passt ${score}% zu deinem Profil.`,
      emailSubject: `GigZone — Wir haben ein passendes Inserat gefunden`,
      emailHtml:    `
<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#f97316;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:700">GigZone</span>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;font-size:18px">Wir haben ein passendes Inserat gefunden 🎯</h2>
    <p style="color:#475569;margin:0 0 16px">${posterName} hat ein Inserat veröffentlicht, das zu deinem Profil passt (<strong>${score}%</strong> Übereinstimmung)${city}.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <strong style="font-size:15px">${postTitle}</strong>
    </div>
    <a href="${postUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Inserat anzeigen</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Keine solchen Benachrichtigungen mehr? <a href="https://www.gigzone.app/settings" style="color:#94a3b8">In Einstellungen deaktivieren</a>.</p>
  </div>
</div>`,
    },
    es: {
      inAppTitle:   `Nuevo match encontrado${city}`,
      inAppBody:    `El anuncio "${postTitle}" de ${posterName} coincide ${score}% con tu perfil.`,
      emailSubject: `GigZone — Encontramos un anuncio que te corresponde`,
      emailHtml:    `
<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#f97316;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:700">GigZone</span>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;font-size:18px">Encontramos un anuncio que te corresponde 🎯</h2>
    <p style="color:#475569;margin:0 0 16px">${posterName} publicó un anuncio que coincide con tu perfil (<strong>${score}%</strong> de coincidencia)${city}.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <strong style="font-size:15px">${postTitle}</strong>
    </div>
    <a href="${postUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Ver anuncio</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">¿No quieres estas notificaciones? <a href="https://www.gigzone.app/settings" style="color:#94a3b8">Desactívalas en ajustes</a>.</p>
  </div>
</div>`,
    },
    fr: {
      inAppTitle:   `Nouveau match trouvé${city}`,
      inAppBody:    `L'annonce « ${postTitle} » de ${posterName} correspond à ${score}% à votre profil.`,
      emailSubject: `GigZone — Nous avons trouvé une annonce qui vous correspond`,
      emailHtml:    `
<div style="font-family:Inter,Segoe UI,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
  <div style="background:#f97316;padding:20px 28px;border-radius:10px 10px 0 0">
    <span style="color:#fff;font-size:20px;font-weight:700">GigZone</span>
  </div>
  <div style="background:#fff;padding:28px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 10px 10px">
    <h2 style="margin:0 0 12px;font-size:18px">Nous avons trouvé une annonce qui vous correspond 🎯</h2>
    <p style="color:#475569;margin:0 0 16px">${posterName} a publié une annonce qui correspond à votre profil (<strong>${score}%</strong> de correspondance)${city}.</p>
    <div style="background:#fff7ed;border:1px solid #fdba74;border-radius:8px;padding:14px 16px;margin-bottom:20px">
      <strong style="font-size:15px">${postTitle}</strong>
    </div>
    <a href="${postUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">Voir l'annonce</a>
    <p style="color:#94a3b8;font-size:12px;margin-top:24px">Vous ne voulez pas ces notifications ? <a href="https://www.gigzone.app/settings" style="color:#94a3b8">Désactivez-les dans les paramètres</a>.</p>
  </div>
</div>`,
    },
  }

  return templates[lang] ?? templates['en']
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (process.env.AI_MATCH_DISABLED === 'true') {
    return NextResponse.json({ error: 'matching_disabled' }, { status: 503 })
  }

  // Auth: post owner must call this
  const user = await getAuthUser(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const raw    = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  const { post_id } = parsed.data

  const supabase = serviceClient()

  // Verify post exists, belongs to caller, and is eligible type
  const { data: post } = await supabase
    .from('posts')
    .select('id, user_id, post_type, text, job_title, category, city, country')
    .eq('id', post_id)
    .maybeSingle()

  if (!post) return NextResponse.json({ error: 'post_not_found' }, { status: 404 })
  if (post.user_id !== user.id) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  if (!(ELIGIBLE_POST_TYPES as readonly string[]).includes(post.post_type)) {
    return NextResponse.json({ error: 'post_type_not_eligible' }, { status: 400 })
  }

  // Idempotency: have we already triggered notifications for this post?
  // Count how many professionals were already notified
  const { count: alreadySent } = await supabase
    .from('matchmaking_notification_log')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', post_id)

  if ((alreadySent ?? 0) >= MAX_CANDIDATES_TO_NOTIFY) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_notified' })
  }

  // Fetch poster profile (for email/name)
  const { data: posterProfile } = await supabase
    .from('profiles')
    .select('name, email, preferred_language')
    .eq('id', user.id)
    .maybeSingle()

  const posterName = (posterProfile?.name && !posterProfile.name.includes('@'))
    ? posterProfile.name
    : 'GigZone korisnik'

  // Run matching pipeline (or use cached results)
  let rankedProfiles: Array<{ profile_id: string; score: number }> = []

  const { data: cached } = await supabase
    .from('matchmaking_results')
    .select('ranked_profiles, expires_at')
    .eq('post_id', post_id)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (cached?.ranked_profiles) {
    rankedProfiles = (cached.ranked_profiles as any[]).map((r: any) => ({
      profile_id: r.profile_id ?? r.id,
      score:      Math.round((r.score ?? r.normalizedScore ?? 0) * 100),
    }))
  } else {
    // Exclude blocked users
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocker_user_id, blocked_user_id')
      .or(`blocker_user_id.eq.${user.id},blocked_user_id.eq.${user.id}`)

    const excludeIds: string[] = (blocks ?? []).flatMap((b: any) =>
      b.blocker_user_id === user.id ? [b.blocked_user_id] : [b.blocker_user_id],
    )

    try {
      const result = await runMatchingPipeline(supabase, {
        post_id,
        post_text:      post.text     ?? '',
        post_category:  post.category ?? null,
        post_city:      post.city     ?? null,
        post_country:   post.country  ?? null,
        post_type:      post.post_type,
        exclude_ids:    excludeIds,
        requester_lang: posterProfile?.preferred_language ?? 'en',
        ...(post.job_title ? { job_title: post.job_title } : {}),
      } as any)

      // Store cache
      await supabase.from('matchmaking_results').upsert(
        {
          post_id,
          user_id:         user.id,
          extraction:      result.extraction,
          ranked_profiles: result.ranked_profiles,
          candidate_count: result.candidate_count,
          expires_at:      new Date(Date.now() + 24 * 3_600_000).toISOString(),
        },
        { onConflict: 'post_id' },
      )

      rankedProfiles = (result.ranked_profiles as any[]).map((r: any) => ({
        profile_id: r.profile_id ?? r.id,
        score:      Math.round((r.score ?? r.normalizedScore ?? 0) * 100),
      }))
    } catch (err: any) {
      console.error('[ai-match/notify] pipeline error', err?.message)
      return NextResponse.json({ error: 'pipeline_error' }, { status: 500 })
    }
  }

  // Filter by minimum quality score
  const candidates = rankedProfiles
    .filter(c => c.score >= MIN_SCORE_TO_NOTIFY)
    .slice(0, MAX_CANDIDATES_TO_NOTIFY)

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, notified: 0, reason: 'no_eligible_candidates' })
  }

  // Build post URL (from post's language context — use en as base)
  const postUrl = `https://www.gigzone.app/en/jobs/${post_id}`
  const postTitle = post.job_title || post.text?.slice(0, 80) || 'Oglas'

  let notifiedCount = 0
  const now = new Date()
  const oneDayAgo = new Date(now.getTime() - ANTI_SPAM_HOURS * 3_600_000).toISOString()

  for (const candidate of candidates) {
    // Fetch professional's profile
    const { data: prof } = await supabase
      .from('profiles')
      .select('id, name, email, preferred_language, match_notifications_enabled, is_admin')
      .eq('id', candidate.profile_id)
      .maybeSingle()

    if (!prof) continue
    // Skip post owner themselves
    if (prof.id === user.id) continue
    // Skip if opted out
    if (prof.match_notifications_enabled === false) continue

    // Anti-spam: did this professional receive a match notification in the last 24h?
    const { count: recentCount } = await supabase
      .from('matchmaking_notification_log')
      .select('*', { count: 'exact', head: true })
      .eq('professional_id', prof.id)
      .gte('sent_at', oneDayAgo)

    if ((recentCount ?? 0) > 0) continue

    // Monthly quota check
    const { data: monthlyCount } = await supabase
      .rpc('get_monthly_match_notification_count', { p_professional_id: prof.id })

    const isFree = (monthlyCount ?? 0) < FREE_NOTIFICATIONS_PER_MONTH
    let creditsCharged = 0

    if (!isFree) {
      // Check if professional has enough credits
      const { data: balance } = await supabase
        .from('credits_balance')
        .select('balance')
        .eq('user_id', prof.id)
        .maybeSingle()

      if (!balance || balance.balance < PAID_NOTIFICATION_COST) continue

      // Deduct credits
      const newBal = balance.balance - PAID_NOTIFICATION_COST
      const { error: deductErr } = await supabase
        .from('credits_balance')
        .update({ balance: newBal, updated_at: now.toISOString() })
        .eq('user_id', prof.id)

      if (deductErr) continue

      await supabase.from('credit_transactions').insert({
        user_id:      prof.id,
        amount:       -PAID_NOTIFICATION_COST,
        type:         'spend',
        description:  'ai_match_notification',
        reference_id: post_id,
      })

      creditsCharged = PAID_NOTIFICATION_COST
    }

    const lang = prof.preferred_language ?? 'en'
    const texts = buildTexts(lang, postTitle, posterName, post.city, candidate.score, postUrl)

    // Insert in-app notification
    await supabase.from('notifications').insert({
      user_id:     prof.id,
      type:        'match',
      action_type: 'ai_match_found',
      post_id:     post_id,
      title:       texts.inAppTitle,
      body:        texts.inAppBody,
      meta: {
        post_id,
        post_type:        post.post_type,
        poster_id:        user.id,
        poster_name:      posterName,
        score:            candidate.score,
        credits_charged:  creditsCharged,
      },
    })

    // Log to notification_log (UNIQUE on professional_id+post_id enforces idempotency)
    const { error: logErr } = await supabase.from('matchmaking_notification_log').insert({
      professional_id: prof.id,
      post_id,
      post_owner_id:   user.id,
      score:           candidate.score,
      credits_charged: creditsCharged,
    })

    // If UNIQUE conflict (already notified) — skip silently, still ok
    if (logErr && !(logErr as any).code?.startsWith('23505')) {
      console.error('[ai-match/notify] log insert error', logErr.message)
      continue
    }

    // Email (fire-and-forget, don't await)
    if (prof.email && !prof.email.includes('+test')) {
      sendEmail({
        to:      prof.email,
        subject: texts.emailSubject,
        html:    texts.emailHtml,
      }).catch(() => {})
    }

    notifiedCount++
  }

  return NextResponse.json({ ok: true, notified: notifiedCount })
}
