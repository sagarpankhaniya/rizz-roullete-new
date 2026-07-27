import { Play, ShieldCheck, LockKeyhole, Star, X, Sparkles, UserRound, Crown, BadgeCheck } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { authHeaders, clearToken, setToken } from '../utils/auth';
import { apiUrl } from '../utils/api';
import { UnbanRequestModal } from './UnbanRequestModal';

export type RoomMode = 'moderated' | 'unmoderated';

type ModeConfig = {
  label: string;
  chip: string;
  title: string;
  copy: string;
  cta: string;
  warning: string;
  online: string;
  speed: string;
  plan: string;
  bg: string;
};

const modes: Record<RoomMode, ModeConfig> = {
  moderated: {
    label: 'Moderated',
    chip: 'Moderated Mode',
    title: 'Cute Cupid Matching',
    copy: 'A candy-gloss space for flirty video chat with safer prompts, clean boundaries, and just enough butterflies.',
    cta: 'Enter Cute Mode',
    warning: '18+ only • consent-first • flirty prompts • moderated matching',
    online: '2,312',
    speed: '5s',
    plan: 'Safe flirt',
    bg: '/assets/landing-bg-1.jpg'
  },
  unmoderated: {
    label: 'Unmoderated',
    chip: 'Unmoderated Mode',
    title: 'Fast, Unfiltered Matching',
    copy: 'A neon late-night roulette room with higher energy, premium entry, and fast-fire stranger matches.',
    cta: 'Enter Unmoderated',
    warning: '18+ only • respect consent • premium entry • high-intensity roulette',
    online: '2,847',
    speed: '3s',
    plan: 'VIP heat',
    bg: '/assets/landing-bg-2.jpg'
  }
};

const plans = [
  ['Weekly Trial', '$10', 'Short access for testing the unmoderated room.'],
  ['Monthly', '$20', 'Flexible recurring access.'],
  ['6 Monthly', '$100', 'Better value for regular matching.'],
  ['1 Year', '$150', 'Best yearly subscription value.']
];

function CandyRain() {
  return (
    <div className="floating-candy" aria-hidden="true">
      {Array.from({ length: 8 }).map((_, index) => <span key={index} />)}
    </div>
  );
}

function LogoLockup() {
  return (
    <div className="logo-spin-wrap anim-fade-up">
      <span className="roulette-o-cover"></span>
      <img className="top-brand-logo" src="/assets/logo-main.png" alt="Rizz Roulette" />
      <img className="spinning-roulette-o" src="/assets/logo-spin.png" alt="" aria-hidden="true" />
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: RoomMode; setMode: (mode: RoomMode) => void }) {
  const isUnmoderated = mode === 'unmoderated';
  return (
    <button id="mode-toggle" className="mode-toggle" type="button" onClick={() => setMode(isUnmoderated ? 'moderated' : 'unmoderated')}>
      <span>{isUnmoderated ? 'Unmoderated' : 'Moderated'}</span>
      <b aria-hidden="true"><i /></b>
    </button>
  );
}

type SignupPanelProps = {
  mode: RoomMode;
  onClose: () => void;
  onRegister?: (user: unknown, token: string) => void;
  onBanned?: (email: string) => void;
  inviteId?: string | null;
  inviteEmail?: string | null;
  inviteError?: string | null;
};

function SignupPanel({
  mode,
  onClose,
  onRegister,
  onBanned,
  inviteId = null,
  inviteEmail = null,
  inviteError = null,
}: SignupPanelProps) {
  const [isLogin, setIsLogin] = useState(false);
  const [screen, setScreen] = useState<'signup' | 'plans' | 'payment' | 'live'>('signup');
  const [selectedPlan, setSelectedPlan] = useState(plans[1][0]);
  const [form, setForm] = useState({
    firstName: '',
    email: inviteEmail ?? '',
    password: '',
    gender: '',
    interestedIn: 'female',
  });
  const [cardData, setCardData] = useState({
    nameOnCard: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });
  const [status, setStatus] = useState(inviteError ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const checked = e.target instanceof HTMLInputElement ? e.target.checked : false;
    const type = e.target instanceof HTMLInputElement ? e.target.type : '';
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleCardChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  function planToApiId(planName: string) {
    if (planName === 'Monthly' || planName === 'Weekly Trial') return 'monthly';
    return 'yearly';
  }

  async function registerAccount() {
    const res = await fetch(apiUrl('/api/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        email: form.email,
        password: form.password,
        gender: form.gender,
        interestedIn: form.interestedIn,
        ...(inviteId ? { inviteId } : {}),
      }),
    });
    const result = await res.json();
    if (!result.success) {
      throw new Error(result.error || 'Registration failed');
    }
    setToken(result.token);
    return result;
  }

  async function handleLogin() {
    if (!form.email || !form.password) {
      setStatus('Please enter your email and password.');
      return;
    }

    setStatus('');
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
        }),
      });

      if (res.status === 401 || res.status === 403) {
        clearToken();
        localStorage.removeItem('rizz_username');
        localStorage.removeItem('rizz_mode');
      }

      const result = await res.json();
      if (result.success) {
        setToken(result.token);
        // onRegister bootstraps camera from this user gesture (iOS requirement).
        onRegister?.(result.user, result.token);
      } else if (result.code === 'USER_BANNED') {
        onBanned?.(form.email.trim().toLowerCase());
      } else {
        setStatus(result.error || 'Login failed');
      }
    } catch {
      setStatus('Server error');
    } finally {
      setSubmitting(false);
    }
  }

  async function createAccount() {
    if (!form.firstName || !form.email || !form.password || !form.gender) {
      setStatus('Please fill all required fields.');
      return;
    }
    setStatus('');
    if (mode === 'unmoderated') {
      setScreen('plans');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registerAccount();
      onRegister?.(result.user, result.token);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Server error');
    } finally {
      setSubmitting(false);
    }
  }

  async function completePayment() {
    const { nameOnCard, cardNumber, expiry, cvc } = cardData;
    if (!nameOnCard.trim() || !cardNumber.trim() || !expiry.trim() || !cvc.trim()) {
      setStatus('Please fill in all card details.');
      return;
    }
    if (!/^\d{13,19}$/.test(cardNumber.replace(/\s/g, ''))) {
      setStatus('Enter a valid card number.');
      return;
    }
    if (!/^\d{2}\/\d{2}$/.test(expiry.trim())) {
      setStatus('Expiry must be in MM/YY format.');
      return;
    }
    if (!/^\d{3,4}$/.test(cvc.trim())) {
      setStatus('Enter a valid CVC.');
      return;
    }

    setStatus('');
    setSubmitting(true);
    try {
      const result = await registerAccount();
      const subRes = await fetch(apiUrl('/api/subscribe'), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          plan: planToApiId(selectedPlan),
          nameOnCard: nameOnCard.trim(),
          cardNumber: cardNumber.replace(/\s/g, ''),
          expiry: expiry.trim(),
        }),
      });
      const subResult = await subRes.json();
      if (!subResult.success) {
        throw new Error(subResult.error || 'Subscription failed');
      }
      onRegister?.(subResult.user, result.token);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Server error');
    } finally {
      setSubmitting(false);
    }
  }

  if (screen === 'live') {
    return null;
  }

  return (
    <section className={`flow-backdrop rizz-page ${mode}`}>
      <div className="flow-panel" role="dialog" aria-modal="true">
        <div className="flow-top">
          <span>
            {isLogin
              ? 'User Login'
              : mode === 'unmoderated'
                ? 'Unmoderated Mode'
                : 'Moderated Mode'}
          </span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {isLogin ? (
          <div className="flow-screen">
            <h2>Welcome Back</h2>
            <p>Log in to your account and start matching.</p>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                Email
                <input
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  type="email"
                  placeholder="Email"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  value={form.password}
                  onChange={handleFormChange}
                  type="password"
                  placeholder="Password"
                />
              </label>
            </div>
            <p className="flow-status" aria-live="polite">
              {status}
            </p>
            <div className="flow-actions">
              <button
                className="hot-button"
                type="button"
                onClick={() => void handleLogin()}
                disabled={submitting}
              >
                {submitting ? 'Logging in…' : 'Log In'}
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={() => {
                  setStatus('');
                  setIsLogin(false);
                }}
              >
                Don&apos;t have an account? Sign Up
              </button>
              <button className="ghost-button" type="button" onClick={onClose}>
                Back to Landing
              </button>
            </div>
          </div>
        ) : (
          <>
            {screen === 'signup' && (
              <div className="flow-screen">
                <h2>Create Your Rizz Account</h2>
                <p>
                  {inviteId
                    ? 'Creator invite — sign up with this email to unlock your VIP badge on video calls. This invite is one-time use.'
                    : 'Create your account to start matching. Your initial match preference is free — subscribe later if you want to change it.'}
                </p>
                <div className="form-grid">
                  <label className="full">
                    First Name
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleFormChange}
                      type="text"
                      placeholder="Enter username"
                    />
                  </label>
                  <label>
                    Email
                    <input
                      name="email"
                      value={form.email}
                      onChange={handleFormChange}
                      type="email"
                      placeholder="Email"
                      readOnly={Boolean(inviteEmail)}
                    />
                  </label>
                  <label>
                    Password
                    <input
                      name="password"
                      value={form.password}
                      onChange={handleFormChange}
                      type="password"
                      placeholder="Password"
                    />
                  </label>
                  <label>
                    Your Gender
                    <select
                      name="gender"
                      value={form.gender}
                      onChange={handleFormChange}
                    >
                      <option value="">Select gender</option>
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                  <label>
                    Interested In
                    <select
                      name="interestedIn"
                      value={form.interestedIn}
                      onChange={handleFormChange}
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="everyone">Everyone</option>
                    </select>
                  </label>
                </div>
                <p className="flow-status" aria-live="polite">
                  {status}
                </p>
                <div className="flow-actions">
                  <button
                    className="hot-button"
                    type="button"
                    onClick={() => void createAccount()}
                    disabled={submitting}
                  >
                    <Sparkles size={18} />{' '}
                    {submitting ? 'Creating account…' : 'Create Account & Continue'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setStatus('');
                      setIsLogin(true);
                    }}
                  >
                    <UserRound size={18} /> Already have an account? Log In
                  </button>
                  <button className="ghost-button" type="button" onClick={onClose}>
                    Back to Landing
                  </button>
                </div>
              </div>
            )}

            {screen === 'plans' && (
              <div className="flow-screen">
                <h2>Choose Subscription</h2>
                <p>Unmoderated mode uses the premium payment flow before entry.</p>
                <div className="plan-grid">
                  {plans.map(([name, price, detail]) => (
                    <button
                      className={selectedPlan === name ? 'selected' : ''}
                      key={name}
                      type="button"
                      onClick={() => setSelectedPlan(name)}
                    >
                      <strong>{price}</strong>
                      <span>{name}</span>
                      <small>{detail}</small>
                    </button>
                  ))}
                </div>
                <div className="flow-actions">
                  <button
                    className="hot-button"
                    type="button"
                    onClick={() => {
                      setStatus('');
                      setScreen('payment');
                    }}
                  >
                    <Crown size={18} /> Proceed to Payment
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setScreen('signup')}
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {screen === 'payment' && (
              <div className="flow-screen payment-screen">
                <h2>Payment Details</h2>
                <p>
                  Enter your card details to complete your subscription. Stripe
                  integration will be added later.
                </p>
                <div className="form-grid">
                  <label className="full">
                    Name on Card
                    <input
                      name="nameOnCard"
                      value={cardData.nameOnCard}
                      onChange={handleCardChange}
                      type="text"
                      placeholder="Full name"
                      autoComplete="cc-name"
                    />
                  </label>
                  <label className="full">
                    Card Number
                    <input
                      name="cardNumber"
                      value={cardData.cardNumber}
                      onChange={handleCardChange}
                      type="text"
                      inputMode="numeric"
                      placeholder="4242 4242 4242 4242"
                      autoComplete="cc-number"
                    />
                  </label>
                  <label>
                    Expiry
                    <input
                      name="expiry"
                      value={cardData.expiry}
                      onChange={handleCardChange}
                      type="text"
                      placeholder="MM/YY"
                      autoComplete="cc-exp"
                    />
                  </label>
                  <label>
                    CVC
                    <input
                      name="cvc"
                      value={cardData.cvc}
                      onChange={handleCardChange}
                      type="text"
                      inputMode="numeric"
                      placeholder="123"
                      autoComplete="cc-csc"
                    />
                  </label>
                </div>
                <div className="receipt">
                  <span>Plan</span>
                  <strong>{selectedPlan}</strong>
                  <span>Status</span>
                  <strong>Ready</strong>
                </div>
                <p className="flow-status" aria-live="polite">
                  {status}
                </p>
                <div className="flow-actions">
                  <button
                    className="hot-button"
                    type="button"
                    onClick={() => void completePayment()}
                    disabled={submitting}
                  >
                    <BadgeCheck size={18} />{' '}
                    {submitting ? 'Processing…' : 'Subscribe & Continue'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setStatus('');
                      setScreen('plans');
                    }}
                  >
                    Change Plan
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

export type LandingPageProps = {
  mode: RoomMode;
  onModeChange: (mode: RoomMode) => void;
  onRegister?: (user: unknown, token: string) => void;
};

export default function LandingPage({ mode, onModeChange, onRegister }: LandingPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteIdFromUrl = searchParams.get('invite_id');
  const [flowOpen, setFlowOpen] = useState(() => Boolean(inviteIdFromUrl));
  const [unbanEmail, setUnbanEmail] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(inviteIdFromUrl);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const active = modes[mode];

  useEffect(() => {
    if (!inviteIdFromUrl) return;

    let cancelled = false;
    setFlowOpen(true);
    setInviteId(inviteIdFromUrl);

    const loadInvite = async () => {
      try {
        const res = await fetch(apiUrl(`/api/invites/${encodeURIComponent(inviteIdFromUrl)}`));
        const result = await res.json();
        if (cancelled) return;
        if (!result.success) {
          setInviteError(result.error || 'This invite is invalid or already used.');
          setInviteEmail(null);
          return;
        }
        setInviteEmail(result.invite?.email ?? null);
        setInviteError(null);
      } catch {
        if (!cancelled) {
          setInviteError('Could not validate invite. You can still try signing up.');
        }
      }
    };

    void loadInvite();
    return () => {
      cancelled = true;
    };
  }, [inviteIdFromUrl]);

  const handleModeChange = (newMode: RoomMode) => {
    onModeChange(newMode);
  };

  const handleEnter = () => {
    setFlowOpen(true);
  };

  const handleRegister = (userData: unknown, token: string) => {
    setFlowOpen(false);
    if (inviteIdFromUrl) {
      searchParams.delete('invite_id');
      setSearchParams(searchParams, { replace: true });
      setInviteId(null);
    }
    onRegister?.(userData, token);
  };

  return (
    <main className={`rizz-page ${mode}`}>
      <div className="photo-bg mod-bg" />
      <div className="photo-bg unmod-bg" />
      <div className="mood-overlay" />
      <CandyRain />

      <section className="landing-ui">
        <header className="top-row">
          <div className="mode-chip anim-fade-up">
            <span />
            {active.chip}
          </div>
          <div className="anim-fade-up anim-delay-1"><LogoLockup /></div>
          <ModeToggle mode={mode} setMode={handleModeChange} />
        </header>

        <section className="hero-area anim-fade-up anim-delay-2">
          <div className="copy-glass anim-fade-up anim-delay-2">
            <p className="mini-kicker">{mode === 'moderated' ? 'Candy hearts. Real sparks.' : 'Neon heat. Fast spins.'}</p>
            <h1>{active.title}</h1>
            <p>{active.copy}</p>
            <div className="hero-actions">
              <button id="cta-enter" className="hot-button" type="button" onClick={handleEnter}>
                <Play size={18} /> {active.cta}
              </button>
              <button className="soft-link" type="button" onClick={() => handleModeChange(mode === 'moderated' ? 'unmoderated' : 'moderated')}>
                Switch to {mode === 'moderated' ? 'Unmoderated' : 'Moderated'}
              </button>
            </div>
          </div>
        </section>

        <footer className="bottom-bar anim-fade-up anim-delay-4">
          <div className="stat-row">
            <div><strong>{active.online}</strong><span>Online Now</span></div>
            <div><strong>{active.plan}</strong><span>Room Mood</span></div>
            <div><strong>{active.speed}</strong><span>Avg Match</span></div>
          </div>
          <div className="wheel-row">
            <img src="/assets/landing-bg-4.png" alt="" />
            <button type="button" onClick={handleEnter}>{active.cta}</button>
            <img src="/assets/landing-bg-4.png" alt="" />
          </div>
          <p>{active.warning}</p>
        </footer>
      </section>

      <aside className="feature-strip">
        <div><ShieldCheck size={18} /><span>Consent-first</span></div>
        <div><LockKeyhole size={18} /><span>Premium gates</span></div>
        <div><Star size={18} /><span>Creator hosts</span></div>
      </aside>

      {flowOpen && createPortal(
        <SignupPanel
          key={`${inviteId ?? 'no-invite'}-${inviteEmail ?? ''}`}
          mode={mode}
          onClose={() => setFlowOpen(false)}
          onRegister={handleRegister}
          onBanned={(email) => {
            setFlowOpen(false);
            setUnbanEmail(email);
          }}
          inviteId={inviteId}
          inviteEmail={inviteEmail}
          inviteError={inviteError}
        />,
        document.body
      )}
      {unbanEmail &&
        createPortal(
          <UnbanRequestModal
            email={unbanEmail}
            mode={mode}
            onClose={() => setUnbanEmail(null)}
          />,
          document.body,
        )}
    </main>
  );
}
