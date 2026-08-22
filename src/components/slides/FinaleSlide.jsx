export default function FinaleSlide({ data, epilogue = [] }) {
  const g = data.group
  return (
    <div className="h-full flex flex-col items-center justify-center px-20">
      <p className="font-display tracking-[0.5em] text-teal-300/70 text-xs mb-4">1996 · ACTIVITY SUSPENDED — NEVER DISBANDED</p>
      <h2 className="font-display text-6xl font-black bg-gradient-to-r from-pink-400 to-teal-300 bg-clip-text text-transparent neon-pink">
        THANK YOU, WINK
      </h2>

      <div className="grid grid-cols-2 gap-x-14 gap-y-3 mt-10 max-w-5xl text-lg text-slate-200 leading-relaxed">
        <p><span className="text-slate-500">Chart legacy:</span> {g.chartLegacy}</p>
        <p><span className="text-slate-500">Awards:</span> {g.awards}</p>
        <p><span className="text-slate-500">Reunions:</span> {g.reunions}</p>
        <p><span className="text-slate-500">Style:</span> {g.style}</p>
      </div>

      {epilogue.length > 0 && (
        <div className="card px-6 py-3 mt-8 max-w-2xl text-center opacity-80">
          <p className="text-[10px] tracking-[0.3em] text-slate-500 mb-1">EPILOGUE · 30TH ANNIVERSARY</p>
          {epilogue.map((s) => (
            <p key={s.num} className="text-lg text-slate-100">
              {s.titleEn} <span className="jp text-slate-500">({s.releaseDate.slice(0, 4)} analog reissue)</span>
            </p>
          ))}
        </div>
      )}

      <div className="w-72 h-px bg-gradient-to-r from-transparent via-pink-300/60 to-transparent mt-12" />
      <p className="jp text-slate-500 text-xs mt-4">お疲れさまでした、ウィンク — 1988–1996</p>
    </div>
  )
}
