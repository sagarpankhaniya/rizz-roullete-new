import { X } from 'lucide-react';
import { useEffect, useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { clearToken, setToken } from '../utils/auth';
import { clearPendingCreator } from '../services/creators';
import { apiUrl } from '../utils/api';
import { authenticateWithGoogle } from '../services/googleAuth';
import { GoogleSignInButton } from './auth/GoogleSignInButton';
import { UnbanRequestModal } from './UnbanRequestModal';

export type RoomMode = 'moderated' | 'unmoderated';

type ModeConfig = {
  chip: string;
  toggle: string;
  title: string;
  copy: string;
  cta: string;
  warning: string;
  signupCopy: string;
};

const ALL_STATS = [
  { value: '2,312', label: 'Online Now' },
  { value: '1:3', label: 'Best Female Ratio' },
  { value: '3s', label: 'Avg Match' },
  { value: '2,847', label: 'Verified Online' },
  { value: '$0', label: 'VIP For Women' },
  { value: '3s', label: 'Avg Match' },
];

const modes: Record<RoomMode, ModeConfig> = {
  moderated: {
    chip: 'Standard Room',
    toggle: 'Standard',
    title: 'Random video chat',
    copy: 'Press start and you are in a live video call with a real person in about three seconds. Not clicking? Press Next. Free VIP for women keeps the best gender ratio in random video chat, so you are actually meeting women — not staring at an empty queue.',
    cta: 'Start Video Chat',
    warning:
      '18+ only • Your camera stays off until you press start • No call is recorded • Nudity is not allowed in the standard room',
    signupCopy:
      'Pick a username and clear the age check. That is the whole sign-up — no real name, no phone number.',
  },
  unmoderated: {
    chip: 'Adult Room · 18+',
    toggle: 'Adult 18+',
    title: 'The 18+ room',
    copy: 'Verified adults only, consent required, ID checked at the door. Every safety control stays exactly where it is — and VIP is free for women, permanently.',
    cta: 'Enter 18+ Room',
    warning:
      'Verified adults only • Consent required on every call • Report, block and blur always on screen • Nothing recorded, nothing stored',
    signupCopy:
      'Pick a username and clear ID verification. That is the whole sign-up.',
  },
};

const SAFETY_TOOLS = [
  {
    icon: '🪪',
    title: 'Age-verified entry',
    copy: 'Face age-estimation plus government ID checks before your first call. Everyone you meet has cleared the same gate.',
    note: 'Required in both rooms',
  },
  {
    icon: '⚑',
    title: 'One-tap report',
    copy: 'Reporting ends the call instantly and sends the moderation team what they need to act on it. Reports are reviewed by people, not only by a model.',
    note: 'Ends the call immediately',
  },
  {
    icon: '⛔',
    title: 'Permanent block',
    copy: 'Block someone and the queue will never pair you again — including on any new account made from the same device.',
    note: 'Device-level, not account-level',
  },
  {
    icon: '◎',
    title: 'Face blur',
    copy: 'Join blurred and lift it only when you want to. Your camera never switches on until you press start.',
    note: 'Toggle any time mid-call',
  },
  {
    icon: '👁',
    title: 'Live screening',
    copy: 'Streams are scanned in real time for nudity in the standard room, and for any sign of a minor in both rooms. Matches are cut instantly.',
    note: 'Always running',
  },
  {
    icon: '🔒',
    title: 'Never recorded',
    copy: 'Calls are peer-to-peer and encrypted end to end. No call is saved. A short buffer is only ever kept when you file a report.',
    note: 'Encrypted, not stored',
  },
  {
    icon: '🚫',
    title: 'Bans that stick',
    copy: 'Device fingerprinting and a tiered ban system, so a banned user cannot be back in the queue five minutes later under a new name.',
    note: 'Tiered enforcement',
  },
  {
    icon: '🕶',
    title: 'Anonymous by default',
    copy: 'A username is all you need. No real name, no phone number, no contact list, and nothing of yours is shared with the person on the other side.',
    note: 'No personal data exposed',
  },
];

function CandyRain() {
  return (
    <div className="floating-candy" aria-hidden="true">
      <span className="candy c1">🎥</span>
      <span className="candy c2">🌐</span>
      <span className="candy c3">🎧</span>
      <span className="candy c4">💬</span>
      <span className="candy c5">🎙</span>
      <span className="candy c6">◉</span>
    </div>
  );
}

function LogoLockup() {
  return (
    <div className="logo-spin-wrap anim-fade-up">
      <span className="roulette-o-cover"></span>
      <img className="top-brand-logo" src="/assets/logo-main.jpeg" alt="Rizz Roulette" />
      <img className="spinning-roulette-o" src="/assets/logo-reveal.png" alt="" aria-hidden="true" />
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: RoomMode; setMode: (mode: RoomMode) => void }) {
  const isUnmoderated = mode === 'unmoderated';
  return (
    <button
      id="mode-toggle"
      className="mode-toggle"
      type="button"
      onClick={() => setMode(isUnmoderated ? 'moderated' : 'unmoderated')}
      title="Switch mode"
    >
      <span>{isUnmoderated ? 'Adult 18+' : 'Standard'}</span>
      <b aria-hidden="true">
        <i />
      </b>
    </button>
  );
}

function SafetyToolsModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="sf-overlay is-open"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sf-panel" role="dialog" aria-modal="true" aria-labelledby="rrSafetyTitle">
        <div className="sf-head">
          <div>
            <h3 id="rrSafetyTitle">Safety tools on every call</h3>
            <p>
              These are not policies buried in a terms page. Every one of them is a control sitting
              under your video for the whole call, and none of them takes more than one tap.
            </p>
          </div>
          <button className="sf-close" type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="sf-grid">
          {SAFETY_TOOLS.map((tool) => (
            <div className="sf-item" key={tool.title}>
              <i>{tool.icon}</i>
              <b>{tool.title}</b>
              <p>{tool.copy}</p>
              <em>{tool.note}</em>
            </div>
          ))}
        </div>

        <p className="sf-foot">
          18+ only. Recording, screen-capturing or redistributing any call is prohibited and
          enforced. This site is RTA-labelled so it can be blocked by parental filtering software.
          Rizz Roulette LLC operates in line with 18 U.S.C. 2257 record-keeping requirements and
          processes DMCA notices.
        </p>
      </div>
    </div>
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
  const [screen, setScreen] = useState<'signup' | 'google-gender'>('signup');
  const [googleAuthCode, setGoogleAuthCode] = useState<{ code: string; redirectUri: string } | null>(null);
  const [googleProfile, setGoogleProfile] = useState<{
    firstName: string;
    email: string;
  } | null>(null);
  const [googleGender, setGoogleGender] = useState('female');
  const [form, setForm] = useState({
    firstName: '',
    email: inviteEmail ?? '',
    password: '',
    gender: 'female',
    interestedIn: 'everyone',
  });
  const [status, setStatus] = useState(inviteError ?? '');
  const [submitting, setSubmitting] = useState(false);

  const active = modes[mode];

  const handleFormChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  async function handleGoogleAuthCode(code: string, redirectUri: string, gender?: string) {
    setStatus('');
    setSubmitting(true);
    try {
      const result = await authenticateWithGoogle({
        code,
        redirectUri,
        gender,
        interestedIn: form.interestedIn,
        ...(inviteId ? { inviteId } : {}),
      });

      if (!result.success) {
        if ('needsGender' in result && result.needsGender) {
          setGoogleAuthCode({ code, redirectUri });
          setGoogleProfile(result.profile);
          setGoogleGender('female');
          setScreen('google-gender');
          return;
        }
        if ('code' in result && result.code === 'USER_BANNED') {
          onBanned?.(googleProfile?.email ?? form.email.trim().toLowerCase());
          return;
        }
        console.error('[Google Auth] sign-in failed — error:', ('error' in result && result.error) || '', '| code:', ('code' in result && result.code) || 'none');
        setStatus(
          ('error' in result && result.error) || 'Google sign-in failed',
        );
        return;
      }

      setToken(result.token);
      setGoogleAuthCode(null);
      setGoogleProfile(null);

      onRegister?.(result.user, result.token);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`[Google Auth] Unexpected exception:\n${msg}`);
      setStatus('Server error');
    } finally {
      setSubmitting(false);
    }
  }

  async function completeGoogleGenderSignup() {
    if (!googleAuthCode) return;
    const gender = googleGender === 'other' ? 'male' : googleGender;
    await handleGoogleAuthCode(googleAuthCode.code, googleAuthCode.redirectUri, gender);
  }

  async function registerAccount() {
    const res = await fetch(apiUrl('/api/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: form.firstName,
        email: form.email,
        password: form.password,
        gender: form.gender === 'other' ? 'male' : form.gender,
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
    if (!form.firstName.trim()) {
      setStatus('Please enter a username to continue.');
      return;
    }
    if (!form.email || !form.password || !form.gender) {
      setStatus('Please fill all required fields.');
      return;
    }
    setStatus('');

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

  return (
    <section className={`flow-backdrop flow-backdrop-solid rizz-page ${mode}`}>
      <div className="flow-panel flow-panel-solid" role="dialog" aria-modal="true" aria-labelledby="rrFlowTitle">
        <div className="flow-top">
          <span className="rr-pill">
            {isLogin ? 'User Login' : active.chip}
          </span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {isLogin ? (
          <div className="flow-screen">
            <h2 id="rrFlowTitle">Welcome Back</h2>
            <p>Log in to your account and start matching.</p>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
              <label>
                Email / Mobile
                <input
                  name="email"
                  value={form.email}
                  onChange={handleFormChange}
                  type="text"
                  placeholder="For account recovery only"
                />
              </label>
              <label>
                Password
                <input
                  name="password"
                  value={form.password}
                  onChange={handleFormChange}
                  type="password"
                  placeholder="At least 8 characters"
                />
              </label>
            </div>
            <p className={`flow-status${status ? ' is-visible' : ''}`} aria-live="polite">
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
              <GoogleSignInButton
                disabled={submitting}
                onAuthCode={(code, redirectUri) => void handleGoogleAuthCode(code, redirectUri)}
                onError={() => setStatus('Google sign-in was cancelled or failed.')}
              />
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
                <h2 id="rrFlowTitle">Create Your Account</h2>
                <p>
                  {inviteId
                    ? 'Creator invite — sign up with this email to unlock your VIP badge on video calls. This invite is one-time use.'
                    : active.signupCopy}
                </p>
                <div className="form-grid">
                  <label className="full">
                    Username
                    <input
                      name="firstName"
                      value={form.firstName}
                      onChange={handleFormChange}
                      type="text"
                      maxLength={20}
                      placeholder="How you will appear in calls"
                    />
                  </label>
                  <label>
                    Email / Mobile
                    <input
                      name="email"
                      value={form.email}
                      onChange={handleFormChange}
                      type="text"
                      placeholder="For account recovery only"
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
                      placeholder="At least 8 characters"
                    />
                  </label>
                  <label className="full">
                    I am
                    <select name="gender" value={form.gender} onChange={handleFormChange}>
                      <option value="female">A woman — VIP is free for you</option>
                      <option value="male">A man</option>
                      <option value="other">Prefer not to say</option>
                    </select>
                  </label>
                </div>
                <p className={`flow-status${status ? ' is-visible' : ''}`} aria-live="polite">
                  {status}
                </p>
                <div className="flow-actions">
                  <button
                    className="hot-button"
                    type="button"
                    onClick={() => void createAccount()}
                    disabled={submitting}
                  >
                    {submitting ? 'Creating account…' : 'Verify Age & Continue'}
                  </button>
                  <GoogleSignInButton
                    disabled={submitting}
                    onAuthCode={(code, redirectUri) => void handleGoogleAuthCode(code, redirectUri)}
                    onError={() => setStatus('Google sign-in was cancelled or failed.')}
                  />
                  <button className="ghost-button" type="button" onClick={onClose}>
                    Back to Landing
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setStatus('');
                      setIsLogin(true);
                    }}
                  >
                    Already have an account? Log In
                  </button>
                </div>
              </div>
            )}

            {screen === 'google-gender' && (
              <div className="flow-screen">
                <h2>One More Step</h2>
                <p>
                  {googleProfile
                    ? `Hi ${googleProfile.firstName}! Pick how you identify so we can run camera verification correctly.`
                    : 'Pick how you identify so we can run camera verification correctly.'}
                </p>
                <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
                  <label className="full">
                    I am
                    <select
                      name="googleGender"
                      value={googleGender}
                      onChange={(e) => setGoogleGender(e.target.value)}
                    >
                      <option value="female">A woman — VIP is free for you</option>
                      <option value="male">A man</option>
                      <option value="other">Prefer not to say</option>
                    </select>
                  </label>
                </div>
                <p className={`flow-status${status ? ' is-visible' : ''}`} aria-live="polite">
                  {status}
                </p>
                <div className="flow-actions">
                  <button
                    className="hot-button"
                    type="button"
                    onClick={() => void completeGoogleGenderSignup()}
                    disabled={submitting}
                  >
                    {submitting ? 'Continuing…' : 'Continue'}
                  </button>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => {
                      setGoogleAuthCode(null);
                      setGoogleProfile(null);
                      setScreen('signup');
                      setStatus('');
                    }}
                  >
                    Back
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
  onRegister?: (user: unknown, token: string, destination?: 'match' | 'deck' | 'creator') => void;
  pendingCreatorRoom?: boolean;
};

export default function LandingPage({ mode, onModeChange, onRegister, pendingCreatorRoom }: LandingPageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const inviteIdFromUrl = searchParams.get('invite_id');
  const [flowOpen, setFlowOpen] = useState(() => Boolean(inviteIdFromUrl) || Boolean(pendingCreatorRoom));
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [unbanEmail, setUnbanEmail] = useState<string | null>(null);
  const [inviteId, setInviteId] = useState<string | null>(inviteIdFromUrl);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [signupDestination, setSignupDestination] = useState<'match' | 'deck' | 'creator'>(() =>
    pendingCreatorRoom ? 'creator' : 'match',
  );
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

  useEffect(() => {
    if (!safetyOpen && !flowOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (safetyOpen) setSafetyOpen(false);
      else if (flowOpen) setFlowOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [safetyOpen, flowOpen]);

  const handleModeChange = (newMode: RoomMode) => {
    onModeChange(newMode);
  };

  const handleEnter = () => {
    clearPendingCreator();
    setSignupDestination('match');
    setFlowOpen(true);
  };

  const handleRegister = (userData: unknown, token: string) => {
    setFlowOpen(false);
    if (inviteIdFromUrl) {
      searchParams.delete('invite_id');
      setSearchParams(searchParams, { replace: true });
      setInviteId(null);
    }
    onRegister?.(userData, token, signupDestination);
    setSignupDestination('match');
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
          <div className="anim-fade-up anim-delay-1">
            <LogoLockup />
          </div>
          <ModeToggle mode={mode} setMode={handleModeChange} />
        </header>

        <section className="hero-area anim-fade-up anim-delay-2">
          <div className="copy-glass anim-fade-up anim-delay-2">
            <h1>{active.title}</h1>
            <p>{active.copy}</p>
          </div>
        </section>

        <footer className="bottom-bar anim-fade-up anim-delay-4">
          <div className="stat-row">
            {ALL_STATS.map((stat, index) => (
              <div key={`${stat.label}-${index}`}>
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          <div className="meta-row">
            <span className="vip-pill">♛ VIP free for women</span>
            <span className="safety-pill">🪪 Age verified</span>
            <span className="safety-pill">🔒 Never recorded</span>
            <span className="safety-pill">⚑ Report &amp; block</span>
            <button
              className="safety-link"
              type="button"
              onClick={() => setSafetyOpen(true)}
            >
              All safety tools
            </button>
          </div>

          <div className="divider" />

          <div className="wheel-row">
            <div className="wheel" aria-hidden="true" />
            <button className="enter-cta" type="button" onClick={handleEnter}>
              {active.cta}
            </button>
            <div className="wheel" aria-hidden="true" />
          </div>
          <p>{active.warning}</p>
        </footer>
      </section>

      {flowOpen &&
        createPortal(
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
          document.body,
        )}

      {safetyOpen &&
        createPortal(<SafetyToolsModal onClose={() => setSafetyOpen(false)} />, document.body)}

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
