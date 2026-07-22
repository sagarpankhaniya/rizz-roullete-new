import { useState } from 'react';
import { X } from 'lucide-react';
import { apiUrl } from '../utils/api';
import type { RoomMode } from './LandingPage';

type UnbanRequestModalProps = {
  email: string;
  mode?: RoomMode;
  onClose: () => void;
};

export function UnbanRequestModal({
  email,
  mode = 'moderated',
  onClose,
}: UnbanRequestModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(false);

  async function requestUnban() {
    setSubmitting(true);
    setStatus('');
    try {
      const res = await fetch(apiUrl('/api/unban-request'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !result.success) {
        setStatus(result.error || 'Could not send unban request.');
        return;
      }
      setSent(true);
      setStatus(result.message || 'Unban request sent to admin.');
    } catch {
      setStatus('Server error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={`flow-backdrop rizz-page ${mode}`}>
      <div
        className="flow-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unban-title"
      >
        <div className="flow-top">
          <span>Account Restricted</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flow-screen">
          <h2 id="unban-title">Request Unban</h2>
          <p>
            This account is currently restricted. Tap the button below to ask
            an admin to review and remove the ban.
          </p>
          <p className="tag-hint" style={{ marginTop: 8 }}>
            {email}
          </p>
          {status && <p className="tip-status">{status}</p>}
          <div className="flow-actions">
            {!sent && (
              <button
                type="button"
                className="hot-button"
                disabled={submitting}
                onClick={() => void requestUnban()}
              >
                {submitting ? 'Sending…' : 'Request Admin to Unban'}
              </button>
            )}
            <button type="button" className="ghost-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
