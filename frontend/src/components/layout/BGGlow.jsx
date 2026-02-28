export default function BGGlow() {
  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {/* Primary green orb — top left */}
      <div
        className="absolute w-[700px] h-[700px] rounded-full animate-float-a"
        style={{
          background: 'radial-gradient(circle, rgba(50,200,100,0.13) 0%, rgba(50,200,100,0.04) 45%, transparent 70%)',
          top: '-15%',
          left: '-12%',
        }}
      />
      {/* Purple accent — bottom right */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-float-b"
        style={{
          background: 'radial-gradient(circle, rgba(147,80,255,0.10) 0%, rgba(147,80,255,0.03) 45%, transparent 70%)',
          bottom: '-12%',
          right: '-12%',
        }}
      />
      {/* Teal accent — center right */}
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-pulse-glow"
        style={{
          background: 'radial-gradient(circle, rgba(50,200,100,0.07) 0%, transparent 70%)',
          top: '35%',
          right: '5%',
        }}
      />
    </div>
  )
}
