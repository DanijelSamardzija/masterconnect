import { supabase } from '@/lib/supabase/client';
import type { GigZoneUrlInfo } from './parse-gigzone-url';
import type { PreviewData } from './types';

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return 'gigzone.app'; }
}

export async function resolveInternal(url: string, info: GigZoneUrlInfo): Promise<PreviewData | null> {
  if (!info) return null;
  const domain = domainOf(url);

  switch (info.type) {
    case 'booking-termini': {
      const [bpRes, locRes] = await Promise.all([
        (supabase as any)
          .from('booking_profiles')
          .select('name, avatar_url, description')
          .eq('id', info.businessId)
          .eq('is_active', true)
          .maybeSingle(),
        info.locationId
          ? supabase.from('business_locations').select('name, city').eq('id', info.locationId).maybeSingle()
          : supabase.from('business_locations').select('city').eq('business_id', info.businessId).eq('is_primary', true).maybeSingle(),
      ]);
      const bp = bpRes.data as { name: string; avatar_url: string | null; description: string | null } | null;
      if (!bp) return null;
      const loc = locRes.data as { city?: string | null } | null;
      const desc = [bp.description, loc?.city].filter(Boolean).join(' · ') || null;
      return { url, title: bp.name, description: desc, imageUrl: bp.avatar_url ?? null, domain, internalType: 'booking-termini' };
    }

    case 'majstori': {
      const [bpRes, locRes] = await Promise.all([
        (supabase as any)
          .from('booking_profiles')
          .select('name, logo_url, description')
          .eq('id', info.businessId)
          .eq('is_active', true)
          .maybeSingle(),
        supabase.from('business_locations').select('city').eq('business_id', info.businessId).eq('is_primary', true).maybeSingle(),
      ]);
      const bp = bpRes.data as { name: string; logo_url: string | null; description: string | null } | null;
      if (!bp) return null;
      const loc = locRes.data as { city?: string | null } | null;
      const desc = [bp.description, loc?.city].filter(Boolean).join(' · ') || null;
      return { url, title: bp.name, description: desc, imageUrl: bp.logo_url ?? null, domain, internalType: 'majstori' };
    }

    case 'booking-service': {
      const [svcRes, bpRes] = await Promise.all([
        (supabase as any).from('service_catalog').select('name, description').eq('id', info.serviceId).maybeSingle(),
        (supabase as any).from('booking_profiles').select('name, avatar_url').eq('id', info.businessId).maybeSingle(),
      ]);
      const svc = svcRes.data as { name: string; description: string | null } | null;
      if (!svc) return null;
      const bp = bpRes.data as { name: string; avatar_url: string | null } | null;
      const desc = [svc.description, bp?.name].filter(Boolean).join(' · ') || null;
      return { url, title: svc.name, description: desc, imageUrl: bp?.avatar_url ?? null, domain, internalType: 'booking-service' };
    }

    case 'post': {
      const { data } = await (supabase as any)
        .from('posts')
        .select('text, job_title, city, author:profiles!posts_user_id_fkey(name, avatar_url)')
        .eq('id', info.postId)
        .maybeSingle();
      if (!data) return null;
      const author = Array.isArray(data.author) ? data.author[0] : data.author;
      const title = data.job_title || (typeof data.text === 'string' ? data.text.slice(0, 60).trim() : '') || 'GigZone';
      const desc = [author?.name, data.city].filter(Boolean).join(' · ') || null;
      return { url, title, description: desc, imageUrl: author?.avatar_url ?? null, domain, internalType: 'post' };
    }

    case 'profile': {
      const { data } = await (supabase as any)
        .from('profiles')
        .select('name, avatar_url, bio, city, category')
        .eq('id', info.userId)
        .maybeSingle();
      if (!data) return null;
      const desc = [data.bio || data.category, data.city].filter(Boolean).join(' · ') || null;
      return { url, title: data.name || 'GigZone profil', description: desc, imageUrl: data.avatar_url ?? null, domain, internalType: 'profile' };
    }

    case 'job': {
      const { data } = await (supabase as any)
        .from('jobs')
        .select('title, description, city, budget')
        .eq('id', info.jobId)
        .maybeSingle();
      if (!data) return null;
      const budgetStr = data.budget ? `${data.budget} EUR` : null;
      const desc = [data.city, budgetStr].filter(Boolean).join(' · ') || (typeof data.description === 'string' ? data.description.slice(0, 80) : null);
      return { url, title: data.title || 'Posao', description: desc, imageUrl: null, domain, internalType: 'job' };
    }

    case 'service': {
      // GigZone Usluge are stored in posts table
      const { data } = await (supabase as any)
        .from('posts')
        .select('text, job_title, city, author:profiles!posts_user_id_fkey(name, avatar_url)')
        .eq('id', info.serviceId)
        .maybeSingle();
      if (!data) return null;
      const author = Array.isArray(data.author) ? data.author[0] : data.author;
      const title = data.job_title || (typeof data.text === 'string' ? data.text.slice(0, 60).trim() : '') || 'Usluga';
      const desc = [author?.name, data.city].filter(Boolean).join(' · ') || null;
      return { url, title, description: desc, imageUrl: author?.avatar_url ?? null, domain, internalType: 'service' };
    }

    default:
      return null;
  }
}
