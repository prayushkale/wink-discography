export default function YearDividerSlide({ year }) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <h2 className="font-display text-[16rem] leading-none font-black bg-gradient-to-b from-white via-pink-200 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(255,110,199,0.35)]">
        {year}
      </h2>
      <div className="w-56 h-px bg-gradient-to-r from-transparent via-teal-300/70 to-transparent mt-2" />
      <p className="font-display tracking-[0.6em] text-teal-200/70 text-xs mt-6">WINK DISCOGRAPHY</p>
    </div>
  )
}
