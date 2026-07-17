import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Sparkles } from 'lucide-react';
import { apiUrl } from '../utils/api';

export default function InviteCreatorPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setStatus('Enter an email address.');
      return;
    }

    setStatus('');
    setInviteUrl('');
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/invites/creator'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to send invite');
      }
      setInviteUrl(result.invite?.inviteUrl ?? '');
      if (result.invite?.emailSent === false) {
        setStatus(
          `Invite created, but email was not sent: ${result.invite.emailError ?? 'unknown error'}. Copy the link below.`,
        );
      } else {
        setStatus(`Invite sent to ${result.invite?.email ?? email}.`);
      }
      setEmail('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Server error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="rizz-page moderated invite-creator-page">
      <div className="photo-bg mod-bg" />
      <div className="mood-overlay" />
      <section className="invite-creator-card">
        <p className="invite-creator-kicker">Creator invites</p>
        <h1>Invite a Creator</h1>
        <p className="invite-creator-copy">
          Send a one-time signup link. When they create an account, they get VIP
          on the video call screen and the invite expires.
        </p>
        <form onSubmit={handleSubmit} className="invite-creator-form">
          <label>
            Email
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="creator@email.com"
              autoComplete="email"
              required
            />
          </label>
          <button className="hot-button" type="submit" disabled={submitting}>
            <Sparkles size={18} />
            {submitting ? 'Sending…' : 'Send Invite'}
          </button>
        </form>
        {status && <p className="invite-creator-status">{status}</p>}
        {inviteUrl && (
          <p className="invite-creator-link">
            <Mail size={16} />
            <a href={inviteUrl} target="_blank" rel="noreferrer">
              {inviteUrl}
            </a>
          </p>
        )}
        <Link className="soft-link" to="/">
          Back to Landing
        </Link>
      </section>
    </main>
  );
}
