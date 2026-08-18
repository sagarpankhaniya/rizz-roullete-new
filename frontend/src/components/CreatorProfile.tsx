import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  clearPendingCreator,
  fetchCreatorById,
  storeCreatorRoom,
  storePendingCreator,
  type Creator,
} from '../services/creators';
import { getToken } from '../utils/auth';
import {
  enterCreatorRoom,
  getCoinBalance,
  ENTRY_FEE,
} from '../services/coins';
import { CoinPurchaseModal } from './CoinPurchaseModal';

const LOGO_MAIN = '/assets/logo-main.jpeg';
const LOGO_REVEAL = '/assets/logo-reveal.png';

export function CreatorProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);
  const [entryError, setEntryError] = useState('');

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchCreatorById(id);
        setCreator(data);
      } catch (err) {
        console.error('Failed to fetch creator:', err);
        setCreator(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
    const interval = window.setInterval(() => {
      void fetchCreatorById(id).then((data) => {
        if (data) setCreator(data);
      });
    }, 15000);
    return () => window.clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!getToken()) return;
    clearPendingCreator();
    getCoinBalance().then((res) => setBalance(res.balance));
  }, []);

  const proceedToCall = () => {
    navigate('/creator-room');
  };

  const handleEnterFailure = (result: {
    code?: string;
    error?: string;
    balance?: number;
  }) => {
    if (result.code === 'INSUFFICIENT_COINS') {
      setBalance(result.balance ?? 0);
      setShowPurchase(true);
      return;
    }
    if (result.code === 'CREATOR_OFFLINE' || result.code === 'CREATOR_NOT_LIVE') {
      setEntryError(
        result.error ||
          'This creator is offline right now. Check back when she goes live.',
      );
      if (creator) setCreator({ ...creator, isOnline: false });
      return;
    }
    setEntryError(result.error || 'Could not enter room');
  };

  const enterRoom = async () => {
    if (!creator || entering) return;
    setEntryError('');

    if (!creator.isOnline) {
      setEntryError(
        `${creator.name} is offline right now. You can browse for free — come back when she goes live.`,
      );
      return;
    }

    if (!getToken()) {
      storePendingCreator(creator);
      navigate('/');
      return;
    }

    setEntering(true);
    try {
      const result = await enterCreatorRoom(creator.id);
      if (!result.ok) {
        handleEnterFailure(result);
        return;
      }

      setBalance(result.newBalance);
      storeCreatorRoom({ id: result.creatorId, name: creator.name });
      proceedToCall();
    } catch {
      setEntryError('Server error. Please try again.');
    } finally {
      setEntering(false);
    }
  };

  const handlePurchaseSuccess = async (newBalance: number) => {
    setBalance(newBalance);
    setShowPurchase(false);
    if (!creator || newBalance < ENTRY_FEE) return;

    setEntering(true);
    setEntryError('');
    try {
      const result = await enterCreatorRoom(creator.id);
      if (!result.ok) {
        handleEnterFailure(result);
        return;
      }
      setBalance(result.newBalance);
      storeCreatorRoom({ id: result.creatorId, name: creator.name });
      proceedToCall();
    } catch {
      setEntryError('Server error. Please try again.');
    } finally {
      setEntering(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-body">
        <div className="wrap" style={{ padding: '80px 22px', textAlign: 'center', fontFamily: 'Bebas Neue', fontSize: 24, color: '#FF2D7A' }}>
          Loading…
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="profile-body">
        <div className="wrap" style={{ padding: '80px 22px', textAlign: 'center' }}>
          <p>Creator not found.</p>
          <Link to="/deck" style={{ color: '#FF2D7A' }}>Back to deck</Link>
        </div>
      </div>
    );
  }

  const displayName = creator.name.toUpperCase();
  const locationLabel = creator.country?.toUpperCase() || 'LIVE NOW';
  const genderLabel = creator.gender
    ? creator.gender.charAt(0).toUpperCase() + creator.gender.slice(1)
    : 'Creator';
  const canAfford = balance === null || balance >= ENTRY_FEE;

  return (
    <div className="profile-body">
      <div className="smoke" aria-hidden="true"><i /><i /></div>
      <div className="spotlight" aria-hidden="true" />
      <div className="scan" aria-hidden="true" />

      <div className="ticker" aria-hidden="true">
        <div>18+ ONLY · UNMODERATED · LIVE AFTER DARK · SPIN THE WHEEL · FIND YOUR RIZZ · 18+ ONLY · UNMODERATED · LIVE AFTER DARK · SPIN THE WHEEL · FIND YOUR RIZZ ·&nbsp;</div>
      </div>

      <div className="wrap">
        <header>
          <Link className="brand" to="/deck" aria-label="Rizz Roulette home">
            <img className="badge" src={LOGO_REVEAL} alt="" />
            <div className="wordmark">RIZZ<span>ROULETTE</span></div>
          </Link>
          <div className="crumb">CREATORS / <b>{displayName}</b></div>
        </header>

        <section className="hero-logo">
          <img src={LOGO_MAIN} alt="Rizz Roulette" />
          <div className="hero-tag">SPIN THE WHEEL · FIND YOUR RIZZ</div>
        </section>

        <section className="creator">
          <div className="photo-tilt reveal in">
            <figure className="photo">
              {creator.photo ? (
                <img src={creator.photo} alt={creator.name} />
              ) : (
                <div className="photo-placeholder">{creator.name[0]}</div>
              )}
              <figcaption className="stamp">VERIFIED CREATOR</figcaption>
            </figure>
          </div>

          <div className="reveal in">
            <div className="eyebrow">FEATURED CREATOR · {locationLabel}</div>
            <h1 className="neon">{displayName}</h1>
            <p className="whisper">SPIN IN. STAY A WHILE.</p>
            <p className="bio">{creator.bio}</p>
            <p className="browse-note">
              {creator.isOnline
                ? `Browse free · ${ENTRY_FEE.toLocaleString()} coins to enter her room`
                : 'Browse free · she goes live after dark'}
            </p>

            {getToken() && balance !== null && (
              <div className="wallet-row">
                <span>Your balance: <b>{balance.toLocaleString()}</b> coins</span>
                {creator.isOnline && (
                  <span className="entry-fee">Entry: {ENTRY_FEE.toLocaleString()} coins</span>
                )}
              </div>
            )}

            {entryError && <p className="entry-error">{entryError}</p>}

            <div className="cta-row">
              {creator.isOnline && (
                <button
                  type="button"
                  className="btn btn-hot"
                  onClick={() => void enterRoom()}
                  disabled={entering}
                >
                  {entering
                    ? 'OPENING ROOM…'
                    : canAfford
                      ? 'SPIN INTO HER ROOM'
                      : 'GET COINS TO ENTER'}
                </button>
              )}
              <Link to="/deck" className="btn btn-ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                BACK TO DECK
              </Link>
            </div>
            <div className="live">
              <span className={`dot${creator.isOnline ? '' : ' offline'}`} />
              <span>{creator.isOnline ? 'online now' : 'offline · goes live after dark'} · EST</span>
            </div>
          </div>
        </section>

        <section className="strip reveal in" aria-label="Quick facts">
          <div><b>{genderLabel.toUpperCase()}</b><small>creator profile</small></div>
          <div><b>{locationLabel}</b><small>{creator.country ? 'based here' : 'location TBD'}</small></div>
          <div><b>80% TO HER</b><small>every tip goes to the creator</small></div>
        </section>

        <div className="foot-badge reveal in">
          <img src={LOGO_REVEAL} alt="" />
        </div>

        <footer>
          <p><span className="b18">18+</span></p>
          <p className="tagline">SPIN THE WHEEL. FIND YOUR RIZZ.</p>
          <p>&copy; 2026 Rizz Roulette LLC · RTA-labeled · All creators verified 18+</p>
        </footer>
      </div>

      {showPurchase && (
        <CoinPurchaseModal
          onClose={() => setShowPurchase(false)}
          onSuccess={handlePurchaseSuccess}
        />
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&family=Special+Elite&display=swap');
        .profile-body {
          --black:#050006; --panel:#120510; --pink:#FF2D7A; --hot:#FF4D93; --deep:#A1104F;
          --glow:rgba(255,45,122,.55); --soft:rgba(255,45,122,.12);
          --white:#FFE9F2; --dim:#B98AA3; --line:rgba(255,45,122,.28);
          background:var(--black); color:var(--white); font-family:'Inter',system-ui,sans-serif;
          min-height:100vh; overflow-x:hidden; position:relative;
        }
        .smoke{position:fixed;inset:0;pointer-events:none;z-index:0}
        .smoke i{position:absolute;width:60vw;height:60vw;border-radius:50%;filter:blur(90px);display:block}
        .smoke i:nth-child(1){background:radial-gradient(circle,#8E0F49,transparent 65%);top:-18vw;left:-22vw;opacity:.4}
        .smoke i:nth-child(2){background:radial-gradient(circle,#FF2D7A,transparent 65%);bottom:-22vw;right:-22vw;opacity:.22}
        .spotlight{position:fixed;inset:0;pointer-events:none;z-index:1}
        .scan{position:fixed;inset:0;pointer-events:none;z-index:2;opacity:.5;background:repeating-linear-gradient(0deg,transparent 0 3px,rgba(0,0,0,.18) 3px 4px)}
        .wrap{position:relative;z-index:3;max-width:1040px;margin:0 auto;padding:0 22px}
        .ticker{position:relative;z-index:3;border-bottom:1px solid var(--line);overflow:hidden;background:rgba(18,5,16,.7);white-space:nowrap}
        .ticker div{display:inline-block;padding:9px 0;font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:.3em;color:var(--pink);text-shadow:0 0 12px var(--glow);animation:slide 22s linear infinite}
        @keyframes slide{to{transform:translateX(-50%)}}
        header{display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:6;background:rgba(5,0,6,.85);backdrop-filter:blur(12px)}
        .brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--white)}
        .badge{width:50px;height:50px;border-radius:50%;box-shadow:0 0 18px var(--glow),0 0 44px rgba(255,45,122,.25)}
        .wordmark{font-family:'Bebas Neue',sans-serif;font-size:27px;letter-spacing:.06em;line-height:1}
        .wordmark span{color:var(--pink);text-shadow:0 0 14px var(--glow)}
        .crumb{font-family:'Bebas Neue',sans-serif;letter-spacing:.16em;font-size:14px;color:var(--dim)}
        .crumb b{color:var(--pink);font-weight:400;text-shadow:0 0 10px var(--glow)}
        .hero-logo{padding:44px 0 8px;text-align:center}
        .hero-logo img{width:min(720px,100%);border-radius:16px;box-shadow:0 0 60px rgba(255,45,122,.3),0 40px 100px -40px #000}
        .hero-tag{font-family:'Bebas Neue',sans-serif;letter-spacing:.42em;font-size:15px;color:var(--pink);text-shadow:0 0 16px var(--glow);margin-top:22px}
        .creator{display:grid;grid-template-columns:minmax(290px,400px) 1fr;gap:52px;padding:60px 0 48px;align-items:center}
        .photo-tilt{perspective:900px}
        .photo{position:relative;border-radius:12px;overflow:hidden;border:2px solid var(--pink);box-shadow:0 0 30px var(--glow),0 0 90px rgba(255,45,122,.2),0 30px 80px -30px #000;transform:rotate(-1.2deg);margin:0}
        .photo img,.photo-placeholder{display:block;width:100%;aspect-ratio:3/4;object-fit:cover}
        .photo-placeholder{background:#1a0515;display:grid;place-items:center;font-size:120px;font-family:'Bebas Neue',sans-serif;color:var(--pink);opacity:.25;aspect-ratio:3/4}
        .stamp{position:absolute;top:14px;right:-6px;transform:rotate(6deg);font-family:'Special Elite',monospace;font-size:12px;letter-spacing:.08em;background:var(--pink);color:#14000A;padding:6px 14px;border-radius:2px;box-shadow:0 0 18px var(--glow)}
        .eyebrow{font-family:'Bebas Neue',sans-serif;letter-spacing:.3em;font-size:14px;color:var(--pink);text-shadow:0 0 12px var(--glow);margin-bottom:8px}
        h1.neon{font-family:'Bebas Neue',sans-serif;font-size:clamp(90px,15vw,160px);line-height:.85;margin-left:-4px;color:var(--white);text-shadow:0 0 22px var(--glow),0 0 70px rgba(255,45,122,.5)}
        .whisper{font-family:'Bebas Neue',sans-serif;font-size:clamp(20px,2.6vw,26px);letter-spacing:.08em;color:var(--hot);text-shadow:0 0 14px var(--glow);margin:18px 0 6px}
        .bio{color:var(--dim);font-size:15.5px;line-height:1.8;max-width:52ch;margin-top:12px}
        .browse-note{margin-top:10px;font-family:'Bebas Neue',sans-serif;letter-spacing:.12em;font-size:14px;color:var(--pink);opacity:.85}
        .wallet-row{display:flex;flex-wrap:wrap;gap:16px;margin-top:18px;font-size:14px;color:var(--dim)}
        .wallet-row b{color:var(--hot);font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:.04em}
        .entry-fee{color:var(--pink);font-family:'Bebas Neue',sans-serif;letter-spacing:.08em}
        .entry-error{color:#ff6b6b;margin-top:12px;font-size:14px}
        .cta-row{display:flex;gap:14px;margin-top:30px;flex-wrap:wrap}
        .btn{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:.1em;padding:15px 30px;border-radius:6px;cursor:pointer;border:none;transition:transform .15s,box-shadow .2s}
        .btn-hot{background:linear-gradient(135deg,var(--hot),var(--deep));color:#fff;box-shadow:0 0 24px var(--glow)}
        .btn-hot:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 0 44px var(--hot)}
        .btn-hot:disabled{opacity:.7;cursor:wait}
        .btn-ghost{background:transparent;color:var(--pink);border:1.5px solid var(--pink);text-shadow:0 0 10px var(--glow)}
        .btn-ghost:hover{background:var(--soft)}
        .live{display:inline-flex;align-items:center;gap:9px;margin-top:24px;font-family:'Special Elite',monospace;font-size:13px;color:var(--dim)}
        .dot{width:10px;height:10px;border-radius:50%;background:var(--pink);box-shadow:0 0 12px var(--pink);animation:blink 1.5s infinite}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
        .dot.offline{background:#666;box-shadow:none;animation:none}
        .strip{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:12px;overflow:hidden;background:linear-gradient(180deg,var(--panel),#0A0209);margin-bottom:40px}
        .strip>div{padding:22px 26px;border-right:1px solid var(--line)}
        .strip>div:last-child{border-right:none}
        .strip b{font-family:'Bebas Neue',sans-serif;font-size:25px;letter-spacing:.05em;display:block;font-weight:400;color:var(--hot);text-shadow:0 0 12px var(--glow)}
        .strip small{color:var(--dim);font-size:12.5px}
        .foot-badge{text-align:center;padding:4px 0 26px}
        .foot-badge img{width:110px;height:110px;border-radius:50%;box-shadow:0 0 30px var(--glow)}
        footer{border-top:1px solid var(--line);padding:26px 0 44px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
        footer p{font-size:12.5px;color:var(--dim);margin:0}
        .tagline{font-family:'Bebas Neue',sans-serif;letter-spacing:.24em;font-size:15px;color:var(--pink);text-shadow:0 0 14px var(--glow)}
        .b18{font-family:'Bebas Neue',sans-serif;border:1.5px solid var(--pink);color:var(--pink);border-radius:50%;width:36px;height:36px;display:inline-grid;place-items:center;font-size:13px}
        .reveal.in{opacity:1;transform:none}
        @media (max-width:820px){.creator{grid-template-columns:1fr;gap:36px;padding-top:44px}.strip{grid-template-columns:1fr}.strip>div{border-right:none;border-bottom:1px solid var(--line)}.crumb{display:none}}
      `}</style>
    </div>
  );
}
