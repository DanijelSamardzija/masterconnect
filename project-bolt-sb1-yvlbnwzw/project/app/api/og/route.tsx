import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get('postId');

  let authorName = 'GigZone korisnik';
  let postText = '';
  let typeLabel = 'Objava';

  if (postId) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      const { data } = await supabase
        .from('posts')
        .select('text, post_type, author:profiles!posts_user_id_fkey(name)')
        .eq('id', postId)
        .maybeSingle();

      if (data) {
        const author = Array.isArray(data.author) ? data.author[0] : data.author;
        authorName = (author as any)?.name || 'GigZone korisnik';
        postText = (data.text || '').slice(0, 120);
        typeLabel =
          data.post_type === 'job_seeker_post' ? 'Tražim posao' :
          data.post_type === 'hiring_post' ? 'Tražim radnika' :
          data.post_type === 'service_request' ? 'Tražim uslugu' :
          data.post_type === 'service_listing' ? 'Usluga' :
          data.post_type === 'portfolio_post' ? 'Portfolio' : 'Objava';
      }
    } catch {}
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0a0a0a',
          padding: '60px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '40px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#ea580c',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '24px',
              fontWeight: 'bold',
              color: 'white',
            }}
          >
            G
          </div>
          <span style={{ color: '#ea580c', fontSize: '28px', fontWeight: '800' }}>GigZone</span>
          <div
            style={{
              marginLeft: 'auto',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '20px',
              padding: '6px 16px',
              color: '#888',
              fontSize: '18px',
            }}
          >
            {typeLabel}
          </div>
        </div>

        {/* Author */}
        <div style={{ color: '#ea580c', fontSize: '22px', fontWeight: '600', marginBottom: '20px' }}>
          {authorName}
        </div>

        {/* Post text */}
        <div
          style={{
            color: '#ffffff',
            fontSize: postText.length > 80 ? '28px' : '36px',
            fontWeight: '600',
            lineHeight: '1.4',
            flex: 1,
          }}
        >
          {postText || 'GigZone — Platforma za majstore i poslove'}
        </div>

        {/* Bottom */}
        <div style={{ color: '#555', fontSize: '18px', marginTop: '40px' }}>
          www.gigzone.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
