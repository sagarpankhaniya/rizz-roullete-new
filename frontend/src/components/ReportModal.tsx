import { useState } from 'react';
import { Flag, X } from 'lucide-react';
import { apiUrl } from '../utils/api';
import { authHeaders } from '../utils/auth';

export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment / bullying' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'spam_scam', label: 'Spam / scam' },
  { value: 'underage', label: 'Underage concern' },
  { value: 'other', label: 'Other' },
] as const;

type ReportModalProps = {
  partnerName: string;
  partnerUserId: string;
  roomName?: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
};

export function ReportModal({
  partnerName,
  partnerUserId,
  roomName,
  onClose,
  onSubmitted,
}: ReportModalProps) {
  const [reason, setReason] =
    useState<(typeof REPORT_REASONS)[number]['value']>('harassment');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState('');
  const [sent, setSent] = useState(false);

  async function submitReport() {
    setSubmitting(true);
    setStatus('');
    try {
      const res = await fetch(apiUrl('/api/reports'), {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          reportedUserId: partnerUserId,
          reason,
          details: details.trim() || undefined,
          roomName: roomName || undefined,
          reportedIdentity: partnerName,
        }),
      });
      const result = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !result.success) {
        setStatus(result.error || 'Could not send report.');
        return;
      }
      setSent(true);
      setStatus(result.message || 'Report sent. Finding next match…');
      onSubmitted?.();
    } catch {
      setStatus('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flow-backdrop rizz-page moderated">
      <div
        className="flow-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-title"
      >
        <div className="flow-top">
          <span>
            <Flag size={14} style={{ marginRight: 6 }} />
            Report user
          </span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="flow-screen">
          <h2 id="report-title">Report {partnerName}</h2>
          <p>
            Tell an admin if this person is misbehaving. We will review and
            may ban their account.
          </p>

          {!sent && (
            <>
              <label className="report-field-label" htmlFor="report-reason">
                Reason
              </label>
              <select
                id="report-reason"
                className="report-select"
                value={reason}
                onChange={(e) =>
                  setReason(
                    e.target.value as (typeof REPORT_REASONS)[number]['value'],
                  )
                }
              >
                {REPORT_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <label className="report-field-label" htmlFor="report-details">
                Details (optional)
              </label>
              <textarea
                id="report-details"
                className="report-textarea"
                rows={3}
                maxLength={1000}
                placeholder="What happened?"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </>
          )}

          {status && <p className="report-status">{status}</p>}

          <div className="flow-actions">
            {!sent && (
              <button
                type="button"
                className="hot-button"
                disabled={submitting}
                onClick={() => void submitReport()}
              >
                {submitting ? 'Sending…' : 'Send report'}
              </button>
            )}
            <button type="button" className="ghost-button" onClick={onClose}>
              {sent ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
