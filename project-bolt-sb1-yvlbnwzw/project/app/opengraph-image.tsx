import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'GigZone - Platforma za majstore i poslove';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #1f2937 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Orange accent top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '6px',
            background: 'linear-gradient(90deg, #f97316, #ea580c)',
          }}
        />

        {/* Logo circle */}
        <div
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, #f97316, #ea580c)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '32px',
          }}
        >
          <span style={{ fontSize: '52px', fontWeight: 'bold', color: 'white' }}>G</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: '64px',
            fontWeight: 'bold',
            color: 'white',
            marginBottom: '16px',
            letterSpacing: '-1px',
          }}
        >
          GigZone
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: '28px',
            color: '#9ca3af',
            textAlign: 'center',
            maxWidth: '700px',
            lineHeight: 1.4,
          }}
        >
          Platforma za majstore, usluge i poslove
        </div>

        {/* Tags */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '40px',
          }}
        >
          {['Usluge', 'Poslovi', 'Profesionalci', 'Dijaspora'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(249, 115, 22, 0.15)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                color: '#fb923c',
                borderRadius: '999px',
                padding: '8px 20px',
                fontSize: '20px',
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            color: '#6b7280',
            fontSize: '20px',
          }}
        >
          gigzone.app
        </div>
      </div>
    ),
    { ...size }
  );
}
