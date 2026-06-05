import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#DB2777',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '36px',
          gap: 2,
        }}
      >
        <div style={{ fontSize: 100, color: 'white', lineHeight: 1 }}>♡</div>
        <div style={{ fontSize: 26, color: 'white', fontWeight: 700, letterSpacing: 2 }}>nail</div>
      </div>
    ),
    { ...size }
  )
}
