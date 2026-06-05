import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Blooming♡ 美甲預約'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #fff0f6 0%, #fce7f3 50%, #fbcfe8 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 120, color: '#DB2777', lineHeight: 1 }}>♡</div>
        <div style={{ fontSize: 64, fontWeight: 700, color: '#831843', letterSpacing: -1 }}>Blooming♡</div>
        <div style={{ fontSize: 28, color: '#9d174d', opacity: 0.8 }}>美甲工作室 · 線上預約平台</div>
        <div
          style={{
            marginTop: 12,
            background: '#DB2777',
            color: 'white',
            fontSize: 24,
            fontWeight: 600,
            padding: '12px 32px',
            borderRadius: 50,
          }}
        >
          立即預約
        </div>
      </div>
    ),
    { ...size }
  )
}
