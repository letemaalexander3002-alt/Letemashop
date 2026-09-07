export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center max-w-sm w-full">
        <div className="text-6xl mb-4">🔍</div>
        <h1 className="text-xl font-black text-white mb-2 uppercase tracking-wide">Ukurasa Haupatikani</h1>
        <p className="text-slate-500 text-sm mb-6">
          Ukurasa unaotafuta haupo. Labda URL si sahihi.
        </p>
        <a href="/"
          className="bg-blue-600 text-white px-8 py-3 rounded-full font-bold text-sm inline-block hover:bg-blue-500 transition">
          🏠 Rudi Nyumbani
        </a>
      </div>
    </div>
  )
}
