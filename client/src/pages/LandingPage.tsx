import { Link } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import ContinueAsGuest from '../components/Auth/ContinueAsGuest'

const IconZap = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)
const IconLayout = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
  </svg>
)
const IconFilter = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
  </svg>
)
const IconClock = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
const IconBell = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)
const IconMoon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const FEATURES = [
  { Icon: IconZap,    title: 'Live sync',       desc: 'See teammates move cards, add comments, and make changes in real-time. No refresh, no polling.' },
  { Icon: IconLayout, title: 'Drag-and-drop boards', desc: 'Lists and cards you reorder by dragging, built on dnd-kit for smooth, accessible sorting.' },
  { Icon: IconFilter, title: 'Smart filtering', desc: 'Filter by assignee, label or due date across every board instantly.' },
  { Icon: IconClock,  title: 'Activity log',         desc: 'Every move, edit, and comment is timestamped and attributed, so you can see what changed.' },
  { Icon: IconBell,   title: 'Notifications',        desc: 'Get pinged when you are assigned a card or added to a board.' },
  { Icon: IconMoon,   title: 'Dark mode',            desc: 'Light by default, with a dark mode toggle that remembers your choice on that browser.' },
]

const MOCK_CARDS = {
  todo:       ['Define project scope', 'Stakeholder interviews', 'Research competitors'],
  inProgress: ['Design system setup', 'API architecture'],
  done:       ['Project kickoff', 'Team onboarding', 'Repo setup'],
}

const FAQS = [
  {
    q: 'How does the real-time Kanban board work?',
    a: 'Every board is synced over a live WebSocket connection. When someone creates, moves, or updates a card, that change is written once on the server and broadcast to everyone currently viewing the same board, with no refresh required. Presence dots show who is on the board with you.',
  },
  {
    q: 'How can I see real-time updates live?',
    a: 'Open the same Plama board in two windows side by side. The second window just needs to be a separate session, like a private/incognito window or a completely different browser. Just copy your board\'s invite link, paste it into the second window to join, and drag a card around to watch the changes update instantly across both screens.',
  },
  {
    q: 'What is guest mode?',
    a: 'Guest mode lets you try Plama without creating an account. Your work is saved locally in this browser session. Signing out, clearing browser data, or switching devices will erase it.\n\nNote: Guest sessions are also a little less seamless in real time (e.g. a returning guest may show up as a new name). Sign in for the smoothest experience and to save future work.',
  },
  {
    q: 'Can two guests collaborate on the same board?',
    a: 'Yes. From a board, click "Copy invite link" and open it in a second window or send it to someone else. Anyone who opens the link can join as a guest or by signing in.',
  },
  {
    q: 'Can teammates join a board I am on?',
    a: 'Yes, two ways: add them by email or copy the shareable invite link. Once access is granted, you\'ll both see the same board, with moves, comments, and assignments syncing in real time.\n\nNote: Adding an email grants account access directly (or when they sign up), but does not send an automated email.',
  },
]

function FaqSection() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section id="faq" className="relative z-10 px-6 sm:px-14 pb-28 max-w-7xl mx-auto scroll-mt-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12">
        <div className="sm:max-w-xs">
          <p className="text-xs font-medium text-white/25 tracking-[0.15em] uppercase mb-3">FAQ</p>
          <div className="w-8 h-px bg-indigo-500/50" />
        </div>
          <h2 className="text-3xl sm:text-[38px] font-bold tracking-tight leading-[1.1] sm:text-right">
          Common<br />
          <span className="text-white/25">questions.</span>
        </h2>
      </div>

      <div className="max-w-3xl sm:ml-auto rounded-2xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.06]">
        {FAQS.map((item, i) => {
          const isOpen = open === i
          return (
            <div key={item.q} className="bg-white/[0.015]">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-medium text-white/80">{item.q}</span>
                <span className={`flex-shrink-0 text-white/30 transition-transform ${isOpen ? 'rotate-45' : ''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </span>
              </button>
              <div className={`grid transition-[grid-template-rows] duration-200 ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <p className="px-5 pb-5 text-sm text-white/40 leading-relaxed whitespace-pre-line">{item.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
    if (!heroRef.current) return

    const x = (e.clientX / window.innerWidth - 0.5)
    const y = (e.clientY / window.innerHeight - 0.5)

    const rotateX = y * -10
    const rotateY = x * 12

    heroRef.current.style.transform =
      `rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(20px)`
    }

    window.addEventListener('mousemove', handler)
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  return (
    <div className="min-h-screen bg-[#0c0e13] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 sm:px-14 py-5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center font-black text-sm">P</div>
          <span className="text-base font-bold tracking-tight">plama</span>
        </div>
        <div className="flex items-center gap-x-1.5 sm:gap-x-2"> 
          <a href="#faq" className="hidden sm:inline text-sm font-medium text-white/50 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/[0.04] transition"> 
            FAQ 
          </a> 
          <Link to="/login" className="text-sm font-medium text-white/50 hover:text-white px-3 py-1.5 rounded-md hover:bg-white/[0.04] transition"> 
            Sign in 
          </Link> 
          <Link to="/register" className="text-sm font-semibold bg-white text-[#0c0e13] hover:bg-white/90 px-4 py-2 rounded-lg ml-1.5 transition"> 
            Get started 
          </Link> 
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-14 pt-24 pb-8 max-w-7xl mx-auto">

        <div className="max-w-3xl"> 
          <h1 
            className="font-fraunces text-5xl sm:text-[64px] lg:text-[72px] font-medium tracking-[-0.015em] leading-[1.05] mb-8 text-white/95" 
            style={{ animation: 'fadeUp 0.4s ease both' }}
          > 
            Where work<br /> 
            <span className="text-indigo-400 font-semibold tracking-[-0.02em]">clicks.</span> 
          </h1> 
          <p 
            className="text-[17px] text-white/50 leading-relaxed max-w-md mb-10" 
            style={{ animation: 'fadeUp 0.5s 0.1s ease both' }}
          > 
            A visual workspace for teams to plan, track, and ship in real time. 
          </p>

          <div className="flex flex-wrap items-center gap-3"
            style={{ animation: 'fadeUp 0.5s 0.16s ease both' }}>
            <Link to="/register"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition-all text-sm shadow-[0_0_24px_rgba(99,102,241,0.3)]">
              Start for free
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <ContinueAsGuest />
            <Link to="/login"
              className="text-sm text-white/40 hover:text-white/70 px-4 py-3 transition">
              Already have an account →
            </Link>
          </div>
        </div>

        {/* Mock board */}
        <div
          style={{
            perspective: '1400px',
            animation: 'boardFloat 6s ease-in-out infinite'
          }}
          className="mt-20"
        >
          <div
            ref={heroRef}
            className="transition-transform duration-150 ease-out"
            style={{ transformStyle: 'preserve-3d', willChange: 'transform' }}
          >
          <div className="rounded-2xl border border-white/[0.08] overflow-hidden shadow-[0_30px_60px_rgba(0,0,0,0.5)] bg-[#14161f]">

            {/* Titlebar */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-white/[0.06] bg-black/20">
              <div className="flex gap-1.5">
                {['bg-red-400/40','bg-yellow-400/40','bg-green-400/40'].map((c,i) => (
                  <div key={i} className={`w-2.5 h-2.5 rounded-full ${c}`} />
                ))}
              </div>
              <div className="flex-1 mx-6 h-3.5 rounded bg-white/[0.04] max-w-[160px]" />
              <div className="flex -space-x-1 ml-auto">
                {['#6366f1','#14b8a6','#f59e0b'].map((c, i) => (
                  <div key={i} className="w-6 h-6 rounded-full border-2 border-[#0f1118] flex items-center justify-center text-[9px] font-bold"
                    style={{ background: c }}>
                    {['B','A','M'][i]}
                  </div>
                ))}
              </div>
            </div>

            {/* Columns */}
            <div className="p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'To Do',       cards: MOCK_CARDS.todo,       accent: 'border-white/[0.05]',  tag: null },
                { label: 'In Progress', cards: MOCK_CARDS.inProgress, accent: 'border-indigo-500/20', tag: 'indigo' },
                { label: 'Done',        cards: MOCK_CARDS.done,       accent: 'border-teal-500/20',   tag: 'teal' },
              ].map((col) => (
                <div key={col.label} className={`rounded-xl p-3 border ${col.accent} bg-white/[0.02]`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">{col.label}</span>
                    <span className="text-[10px] text-white/25 bg-white/[0.05] rounded-full px-1.5 py-0.5">{col.cards.length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {col.cards.map((card, i) => (
                      <div key={i} className="rounded-lg px-3 py-2.5 border border-white/[0.06]"
                        style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-[11px] text-white/65 font-medium leading-snug">{card}</p>
                        {i === 0 && col.tag && (
                          <div className="mt-1.5 flex gap-1">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                              col.tag === 'indigo'
                                ? 'bg-indigo-500/15 text-indigo-300/80'
                                : 'bg-teal-500/15 text-teal-300/80'
                            }`}>Design</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
         </div>
        </div>
      </section>

      {/* ── Divider ─────────────────────────────── */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-14 py-24">
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
      </div>

      {/* ── Features ────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-14 pb-28 max-w-7xl mx-auto">

        {/* Asymmetric header — left label, right heading */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-16">
          <div className="sm:max-w-xs">
            <p className="text-xs font-medium text-white/25 tracking-[0.15em] uppercase mb-3">Features</p>
            <div className="w-8 h-px bg-indigo-500/50" />
          </div>
          <h2 className="text-3xl sm:text-[38px] font-bold tracking-tight leading-[1.1] sm:text-right">
            What's<br />
            <span className="text-white/25">in the box.</span>
          </h2>
        </div>

        {/* Features — 2 col on md, no icons boxed, just inline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/[0.05] rounded-2xl overflow-hidden border border-white/[0.05]">
          {FEATURES.map(({ Icon, title, desc }, i) => (
            <div key={i}
              className="group p-7 bg-[#0c0e13] hover:bg-white/[0.02] transition-colors duration-200 cursor-default">
              <div className="text-white/25 group-hover:text-indigo-400 transition-colors mb-4">
                <Icon />
              </div>
              <h3 className="text-sm font-semibold text-white/80 mb-2">{title}</h3>
              <p className="text-sm text-white/30 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <FaqSection />

      {/* ── CTA ─────────────────────────────────── */}
      <section className="relative z-10 px-6 sm:px-14 pb-32 max-w-7xl mx-auto">
        {/* Left-aligned instead of centered*/}
        <div className="max-w-2xl"> 
          <p className="text-xs font-semibold text-white/30 tracking-[0.2em] uppercase mb-5">
            Get started
          </p> 
          <h2 
            className="font-fraunces text-4xl sm:text-[56px] font-medium tracking-[-0.015em] leading-[1.05] mb-6 text-white/95"
          > 
            Ready to get<br />organized? 
          </h2>
          <p className="text-white/35 text-lg mb-10 max-w-sm leading-relaxed">
            Create your first board in seconds.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/register"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white font-semibold rounded-xl transition text-sm shadow-[0_0_28px_rgba(99,102,241,0.28)]">
              Create free account
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
            <Link to="/login"
              className="text-sm text-white/35 hover:text-white/65 transition">
              Sign in instead →
            </Link>
            <ContinueAsGuest variant="muted" />
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────── */}
      <footer className="relative z-10 px-6 sm:px-14 py-7 border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-indigo-500 flex items-center justify-center text-xs font-black">P</div>
            <span className="text-sm font-semibold text-white/35">plama</span>
          </div>
          <p className="text-xs text-white/15">
            © {new Date().getFullYear()} Plama. Made with <span className="opacity-50">♥</span> by 
            <a href="https://github.com/mokenye" className="hover:text-white/40 transition-colors ml-1">
              Mokenye
            </a>.
          </p>
          <a href="#faq" className="text-xs text-white/20 hover:text-white/40 transition">FAQ</a>
        </div>
      </footer>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes boardFloat {
          0%   { transform: translateY(0px); }
          50%  { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
      `}</style>
    </div>
  )
}