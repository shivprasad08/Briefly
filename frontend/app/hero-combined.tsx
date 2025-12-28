import WavyBackground from "@/components/ui/blue-meshy-background";

export default function HeroCombined() {
  return (
    <WavyBackground className="relative min-h-screen flex items-center justify-start overflow-hidden">
      <div className="relative z-10 max-w-3xl pl-8 pt-24 pb-16">
        <span className="inline-flex items-center rounded-full bg-black/80 px-3 py-1 mb-6 text-xs font-semibold text-white/80 backdrop-blur-md">
          <span className="mr-2 bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full w-2 h-2 inline-block" />
          NEW <span className="ml-1 font-bold">Contextual AI</span>
        </span>
        <h1 className="text-5xl md:text-6xl font-extrabold text-white leading-tight drop-shadow-xl mb-6">
          Briefly — Meeting insights,<br />
          summaries, and answers<br />
          without the busywork.
        </h1>
        <p className="text-lg text-white/80 mb-8 max-w-xl">
          Upload meeting notes and PDFs. Get instant insights, comprehensive summaries, and intelligent answers powered by AI.
        </p>
        <div className="flex gap-4">
          <button className="px-6 py-3 text-base font-semibold text-white bg-gradient-to-r from-indigo-500 to-blue-400 rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300">
            Create a session
          </button>
          <button className="px-6 py-3 text-base font-semibold text-white/80 bg-white/10 border border-white/20 rounded-xl shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-300">
            View sessions
          </button>
        </div>
      </div>
      {/* Optional: Add a dark radial overlay for the ellipse effect */}
      <div className="pointer-events-none absolute left-0 top-0 w-[900px] h-[900px] bg-black rounded-full opacity-80 blur-3xl -z-1" style={{filter:'blur(120px)',top:'-200px',left:'-200px'}} />
      {/* Optional: Add a bottom gradient overlay for the color band */}
      <div className="pointer-events-none absolute bottom-0 left-0 w-full h-1/3 bg-gradient-to-t from-[#b86b1c] via-[#5a5ad6] to-transparent opacity-80 blur-2xl -z-1" style={{filter:'blur(60px)'}} />
    </WavyBackground>
  );
}
