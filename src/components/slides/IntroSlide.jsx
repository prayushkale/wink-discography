export default function IntroSlide({ data }) {
  const g = data.group
  const stats = [
    { label: 'SINGLES', value: data.singles.length },
    { label: 'ALBUMS', value: data.albums.length },
    { label: 'No.1 HITS', value: '5' },
    { label: 'YEARS ACTIVE', value: '8' },
  ]
  return (
    <div className="h-full flex flex-col items-center justify-center px-16">
      <p className="font-display tracking-[0.7em] text-teal-300/80 text-sm mb-4 neon-cyan">J-POP IDOL DUO · 1988–1996</p>
      <h1 className="font-display text-8xl font-black tracking-tight bg-gradient-to-r from-pink-400 via-fuchsia-300 to-teal-300 bg-clip-text text-transparent neon-pink">
        WINK
      </h1>
      <p className="jp text-2xl text-slate-300 mt-2">ウィンク — The Complete Discography</p>

      <div className="grid grid-cols-2 gap-5 mt-10 w-full max-w-4xl">
        {g.members.map((m) => (
          <div key={m.nameEn} className="card p-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-500/60 to-teal-400/50 flex items-center justify-center font-display text-xl">
              {m.nameEn[0]}
            </div>
            <div>
              <p className="font-semibold text-lg">{m.nameEn}</p>
              <p className="jp text-slate-400 text-sm">
                {m.nameJp} · b. {m.born}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-8 mt-8">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className="font-display text-3xl text-pink-300 neon-pink">{s.value}</p>
            <p className="text-[10px] tracking-[0.25em] text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="card px-6 py-4 mt-8 max-w-3xl text-center">
        <p className="text-sm text-slate-300 leading-relaxed">
          Expressionless, doll-like performances · extravagant doll-inspired fashion · the famous "robot dance" · Japanese covers
          of European pop, later ~60% originals · <span className="chip chip-gold mx-1">31st Japan Record Award Grand Prix</span>
          <span className="text-slate-400">for 淋しい熱帯魚 (1989)</span>
        </p>
      </div>
    </div>
  )
}
