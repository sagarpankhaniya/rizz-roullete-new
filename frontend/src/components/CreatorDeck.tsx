import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { fetchCreators as loadCreators, type Creator } from '../services/creators';

const LOGO_MAIN = '/assets/logo-main.jpeg';
const LOGO_REVEAL = '/assets/logo-reveal.png';

export function CreatorDeck() {
  const navigate = useNavigate();
  const [view, setView] = useState<'deck' | 'grid'>('deck');
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [flippedIndices, setFlippedIndices] = useState<Set<number>>(new Set());
  const [revealed, setRevealed] = useState<boolean[]>([]);

  useEffect(() => {
    const fetchDeck = async () => {
      setLoading(true);
      try {
        const items = await loadCreators();
        setCreators(items);
        setRevealed(new Array(items.length).fill(false));
        items.forEach((_: unknown, i: number) => {
          setTimeout(() => {
            setRevealed((prev) => {
              const next = [...prev];
              if (next[i] !== undefined) next[i] = true;
              return next;
            });
          }, i * 60);
        });
      } catch (err) {
        console.error('Failed to fetch creators:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchDeck();
  }, []);

  const flipOpen = (index: number) => {
    setFlippedIndices((prev) => {
      if (prev.has(index)) return prev;
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleBackClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (view !== 'deck') return;
    flipOpen(index);
  };

  const revealAll = () => {
    setFlippedIndices(new Set(creators.map((_, i) => i)));
  };

  const shuffleFaceDown = () => {
    setFlippedIndices(new Set());
  };

  const flipLucky = () => {
    if (creators.length === 0) return;
    setFlippedIndices(new Set());
    const random = Math.floor(Math.random() * creators.length);
    setTimeout(() => {
      setFlippedIndices(new Set([random]));
      const el = document.querySelector(`[data-card-index="${random}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 260);
  };

  const cardCount = creators.length;

  return (
    <div className="deck-body">
      <div className="smoke" aria-hidden="true">
        <i />
        <i />
      </div>
      <div className="spotlight" aria-hidden="true" />
      <div className="scan" aria-hidden="true" />

      <div className="ticker" aria-hidden="true">
        <div>
          18+ ONLY · UNMODERATED · {cardCount} CARDS ON THE TABLE · SPIN THE WHEEL · FIND YOUR RIZZ · 18+ ONLY · UNMODERATED · {cardCount} CARDS ON THE TABLE · SPIN THE WHEEL · FIND YOUR RIZZ ·&nbsp;
        </div>
      </div>

      <div className="wrap">
        <header>
          <a className="brand" href="/match" onClick={(e) => { e.preventDefault(); navigate('/match'); }} aria-label="Back to match">
            <img className="badge" src={LOGO_REVEAL} alt="" />
            <div className="wordmark">
              RIZZ<span>ROULETTE</span>
            </div>
          </a>
          <div className="nav-actions">
            <button type="button" onClick={() => navigate('/match')} className="back-link">
              <ArrowLeft size={14} style={{ marginRight: 4 }} /> BACK
            </button>
            <div className="nav">
              {view === 'grid' ? (
                <b>GRID VIEW</b>
              ) : (
                <button type="button" onClick={() => setView('grid')}>GRID VIEW</button>
              )}
              <span className="sep"> / </span>
              {view === 'deck' ? (
                <b>THE DECK</b>
              ) : (
                <button type="button" onClick={() => setView('deck')}>THE DECK</button>
              )}
            </div>
          </div>
        </header>

        <section className="hero">
          <img className="hero-logo" src={LOGO_MAIN} alt="Rizz Roulette" />
          <h1>SPIN THE DECK</h1>
          <p className="sub">
            {loading
              ? 'Shuffling the deck…'
              : `${cardCount} cards face-down · browse free · enter a room when she is live`}
          </p>

          <div className="controls">
            <button type="button" className="ctrl solid" onClick={flipLucky}>
              🎲 FLIP ME A LUCKY ONE
            </button>
            <button type="button" className="ctrl" onClick={revealAll}>
              REVEAL ALL
            </button>
            <button type="button" className="ctrl" onClick={shuffleFaceDown}>
              SHUFFLE FACE-DOWN
            </button>
          </div>
        </section>

        <div className={`deck ${view === 'grid' ? 'grid-mode' : ''}`}>
          {loading ? (
            <div className="deck-loading">Loading Creators...</div>
          ) : (
            creators.map((creator, i) => {
              const isOpen = flippedIndices.has(i) || view === 'grid';
              return (
                <div
                  key={`${creator.slug}-${i}`}
                  data-card-index={i}
                  className={`flip reveal ${revealed[i] ? 'in' : ''} ${isOpen ? 'open' : ''}`}
                  onKeyDown={(e) => {
                    if (view === 'deck' && (e.key === 'Enter' || e.key === ' ') && !isOpen) {
                      e.preventDefault();
                      flipOpen(i);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Reveal ${creator.name}`}
                >
                  <div className="flip-inner">
                    <div
                      className="face back"
                      onClick={(e) => handleBackClick(e, i)}
                      role="presentation"
                    >
                      <img className="back-logo" src={LOGO_REVEAL} alt="" />
                      <div className="tap">TAP TO REVEAL</div>
                    </div>
                    <Link
                      to={`/creator/${creator.id}`}
                      className="face front"
                      onClick={(e) => {
                        if (!isOpen) e.preventDefault();
                      }}
                    >
                      {creator.photo ? (
                        <img src={creator.photo} alt={creator.name} />
                      ) : (
                        <div className="creator-placeholder">{creator.name[0]}</div>
                      )}
                      <div className="front-info">
                        <h3>{creator.name}</h3>
                        <p>{creator.bio}</p>
                        <span className={`enter${creator.isOnline ? '' : ' offline'}`}>
                          {creator.isOnline ? 'ENTER ROOM »' : 'OFFLINE · VIEW PROFILE »'}
                        </span>
                      </div>
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="foot-badge">
          <img src={LOGO_REVEAL} alt="" />
        </div>

        <footer>
          <p>&copy; 2026 Rizz Roulette LLC. All rights reserved.</p>
          <div className="tagline">YOUR NEW ADDICTION.</div>
          <div className="b18">18+</div>
        </footer>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Cormorant+Garamond:ital,wght@1,600&display=swap');

        .deck-body {
          --black: #050006;
          --panel: #120510;
          --pink: #FF2D7A;
          --hot: #FF4D93;
          --deep: #A1104F;
          --rose: #FF8FB5;
          --glow: rgba(255,45,122,.55);
          --soft: rgba(255,45,122,.12);
          --white: #FFE9F2;
          --dim: #C495AB;
          --line: rgba(255,45,122,.28);

          background: var(--black);
          color: var(--white);
          font-family: 'Inter', system-ui, sans-serif;
          min-height: 100vh;
          overflow-x: hidden;
          position: relative;
          margin: 0;
          padding: 0;
        }

        .smoke { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .smoke i { position: absolute; width: 60vw; height: 60vw; border-radius: 50%; filter: blur(90px); display: block; }
        .smoke i:nth-child(1) { background: radial-gradient(circle, #8E0F49, transparent 65%); top: -18vw; left: -22vw; opacity: .4; animation: d1 15s ease-in-out infinite alternate; }
        .smoke i:nth-child(2) { background: radial-gradient(circle, #FF2D7A, transparent 65%); bottom: -22vw; right: -22vw; opacity: .2; animation: d2 19s ease-in-out infinite alternate; }
        @keyframes d1 { to { transform: translate(6vw, 4vw) scale(1.15); } }
        @keyframes d2 { to { transform: translate(-6vw, -5vw) scale(1.1); } }

        .spotlight { position: fixed; inset: 0; pointer-events: none; z-index: 1; }
        .scan { position: fixed; inset: 0; pointer-events: none; z-index: 2; opacity: .45; background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.18) 3px 4px); }

        .wrap { position: relative; z-index: 3; max-width: 1180px; margin: 0 auto; padding: 0 22px; }

        .ticker { position: relative; z-index: 3; border-bottom: 1px solid var(--line); overflow: hidden; background: rgba(18,5,16,.7); white-space: nowrap; }
        .ticker div { display: inline-block; padding: 9px 0; font-family: 'Bebas Neue', sans-serif; font-size: 14px; letter-spacing: .3em; color: var(--pink); text-shadow: 0 0 12px var(--glow); animation: slide 26s linear infinite; }
        @keyframes slide { to { transform: translateX(-50%); } }

        header { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid var(--line); position: sticky; top: 0; z-index: 6; background: rgba(5,0,6,.85); backdrop-filter: blur(12px); }
        .brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: var(--white); }
        .badge { width: 50px; height: 50px; border-radius: 50%; box-shadow: 0 0 18px var(--glow), 0 0 44px rgba(255,45,122,.25); animation: pg 3s ease-in-out infinite; transition: transform .6s cubic-bezier(.3,1.6,.4,1); }
        .brand:hover .badge { transform: rotate(360deg); }
        @keyframes pg { 0%, 100% { box-shadow: 0 0 18px var(--glow); } 50% { box-shadow: 0 0 32px var(--hot), 0 0 70px rgba(255,45,122,.4); } }
        .wordmark { font-family: 'Bebas Neue', sans-serif; font-size: 27px; letter-spacing: .06em; line-height: 1; }
        .wordmark span { color: var(--pink); text-shadow: 0 0 14px var(--glow); }

        .nav-actions { display: flex; align-items: center; gap: 24px; }
        .back-link { background: none; border: none; color: var(--dim); cursor: pointer; display: flex; align-items: center; font-family: 'Bebas Neue', sans-serif; font-size: 15px; letter-spacing: .14em; padding: 0; }
        .nav { font-family: 'Bebas Neue', sans-serif; letter-spacing: .14em; font-size: 15px; color: var(--dim); display: flex; align-items: center; gap: 0; }
        .nav button { background: none; border: none; color: var(--dim); font: inherit; cursor: pointer; padding: 0; letter-spacing: inherit; }
        .nav b { color: var(--pink); font-weight: 400; text-shadow: 0 0 10px var(--glow); }
        .sep { opacity: 0.5; }

        .hero { text-align: center; padding: 50px 0 8px; }
        .hero-logo { width: min(500px, 90%); border-radius: 16px; box-shadow: 0 0 60px rgba(255,45,122,.3), 0 40px 100px -40px #000; animation: heroIn 1.2s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes heroIn { from { opacity: 0; transform: scale(.93) translateY(24px); filter: blur(8px); } to { opacity: 1; transform: none; filter: none; } }
        h1 { font-family: 'Bebas Neue', sans-serif; font-size: clamp(58px, 11vw, 110px); line-height: .9; margin-top: 22px; color: var(--white); text-shadow: 0 0 22px var(--glow), 0 0 70px rgba(255,45,122,.4); }
        .sub { font-family: 'Cormorant Garamond', serif; font-style: italic; font-weight: 600; font-size: clamp(18px, 2.4vw, 24px); color: var(--rose); text-shadow: 0 0 14px rgba(255,143,181,.4); margin-top: 4px; }

        .controls { margin-top: 22px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
        .ctrl { font-family: 'Bebas Neue', sans-serif; letter-spacing: .14em; font-size: 15px; cursor: pointer; border-radius: 999px; padding: 11px 24px; border: 1px solid var(--line); background: transparent; color: var(--pink); text-shadow: 0 0 10px var(--glow); transition: all .2s; }
        .ctrl:hover { background: var(--soft); box-shadow: 0 0 20px rgba(255,45,122,.3); }
        .ctrl.solid { background: linear-gradient(135deg, var(--hot), var(--deep)); color: #fff; border: none; box-shadow: 0 0 24px var(--glow); }
        .ctrl.solid:hover { transform: translateY(-2px); box-shadow: 0 0 40px var(--hot); }

        .deck { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 26px; padding: 40px 0 46px; }
        .deck-loading { grid-column: 1 / -1; text-align: center; padding: 40px; font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: var(--pink); }

        .flip { position: relative; width: 100%; aspect-ratio: 3/4; perspective: 1200px; cursor: pointer; border-radius: 16px; }
        .flip:focus-visible { outline: 2px solid var(--pink); outline-offset: 4px; }
        .flip-inner { position: absolute; inset: 0; transition: transform .7s cubic-bezier(.3, 1.1, .4, 1); transform-style: preserve-3d; }
        .flip.open .flip-inner { transform: rotateY(180deg); }
        .face { position: absolute; inset: 0; border-radius: 16px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; border: 1px solid var(--line); }

        .back {
          background:
            radial-gradient(circle at 50% 42%, rgba(255,45,122,.18), transparent 60%),
            repeating-linear-gradient(45deg, rgba(255,45,122,.05) 0 10px, transparent 10px 20px),
            linear-gradient(180deg, var(--panel), #0A0209);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 18px;
          box-shadow: inset 0 0 50px rgba(255,45,122,.08);
          transition: box-shadow .3s, transform .3s;
        }
        .flip:hover .back { box-shadow: inset 0 0 60px rgba(255,45,122,.16), 0 0 30px var(--glow); }
        .back::before, .back::after { content: ""; position: absolute; border: 1px solid var(--line); border-radius: 12px; inset: 14px; pointer-events: none; opacity: .6; }
        .back::after { inset: 22px; opacity: .3; }
        .back-logo { width: 118px; height: 118px; border-radius: 50%; box-shadow: 0 0 22px var(--glow), 0 0 50px rgba(255,45,122,.25); animation: pg 3s ease-in-out infinite; z-index: 1; object-fit: cover; }
        .tap { font-family: 'Bebas Neue', sans-serif; letter-spacing: .22em; font-size: 13px; color: var(--pink); text-shadow: 0 0 10px var(--glow); z-index: 1; animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: .5; } 50% { opacity: 1; } }

        .back { cursor: pointer; }
        .front { transform: rotateY(180deg); text-decoration: none; color: var(--white); display: block; background: #0A0209; cursor: pointer; }
        .front img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
        .creator-placeholder { position: absolute; inset: 0; background: #1a0515; display: grid; place-items: center; font-size: 120px; font-family: 'Bebas Neue', sans-serif; color: var(--pink); opacity: 0.2; }
        .front::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, transparent 40%, rgba(5,0,6,.9)); pointer-events: none; }
        .front-info { position: absolute; left: 0; right: 0; bottom: 0; padding: 16px 16px 18px; z-index: 1; }
        .front-info h3 { font-family: 'Bebas Neue', sans-serif; font-size: 32px; letter-spacing: .03em; line-height: 1; color: var(--white); text-shadow: 0 0 14px var(--glow); margin: 0; }
        .front-info p { color: var(--rose); font-size: 13px; margin-top: 4px; line-height: 1.35; min-height: 16px; }
        .enter { display: inline-block; margin-top: 8px; font-family: 'Bebas Neue', sans-serif; letter-spacing: .12em; font-size: 13px; color: var(--pink); text-shadow: 0 0 10px var(--glow); transition: letter-spacing .25s; cursor: pointer; }
        .enter.offline { color: var(--dim); text-shadow: none; letter-spacing: .1em; }
        .front:hover .enter:not(.offline) { letter-spacing: .24em; }

        .reveal { opacity: 0; transform: translateY(24px); transition: opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1); }
        .reveal.in { opacity: 1; transform: none; }

        .grid-mode .flip-inner { transform: rotateY(180deg); }

        .foot-badge { text-align: center; padding: 6px 0 26px; }
        .foot-badge img { width: 96px; height: 96px; border-radius: 50%; box-shadow: 0 0 30px var(--glow), 0 0 80px rgba(255,45,122,.2); object-fit: cover; }

        footer { border-top: 1px solid var(--line); padding: 26px 0 46px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
        footer p { font-size: 12.5px; color: var(--dim); margin: 0; }
        .tagline { font-family: 'Bebas Neue', sans-serif; letter-spacing: .24em; font-size: 15px; color: var(--pink); text-shadow: 0 0 14px var(--glow); }
        .b18 { font-family: 'Bebas Neue', sans-serif; border: 1.5px solid var(--pink); color: var(--pink); border-radius: 50%; width: 36px; height: 36px; display: inline-grid; place-items: center; font-size: 13px; box-shadow: 0 0 12px rgba(255,45,122,.35); }

        @media (max-width: 560px) {
          .deck { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .nav-actions { gap: 12px; }
          h1 { font-size: 48px; }
          .nav { display: none; }
        }

        @media (prefers-reduced-motion: reduce) {
          .smoke i, .badge, .ticker div, .back-logo, .tap { animation: none !important; }
          .reveal { opacity: 1; transform: none; transition: none; }
          .flip-inner { transition: none; }
        }
      `}</style>
    </div>
  );
}
