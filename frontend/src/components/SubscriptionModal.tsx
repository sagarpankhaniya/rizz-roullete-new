import { useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, X } from 'lucide-react';
import type { RoomMode } from './LandingPage';
import { subscribeWithCard } from '../services/profile';
import type { StoredUser } from '../utils/user';

const MODERATED_PLANS = [
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$20',
    detail: 'Flexible monthly access to moderated matching.',
  },
  {
    id: 'yearly',
    label: 'Yearly',
    price: '$200',
    detail: 'Best value — full year of moderated matching.',
  },
] as const;

const UNMODERATED_PLANS = [
  {
    id: 'weekly',
    label: 'Weekly Trial',
    price: '$10',
    detail: 'Short access for testing the unmoderated room.',
  },
  {
    id: 'monthly',
    label: 'Monthly',
    price: '$20',
    detail: 'Flexible recurring access.',
  },
  {
    id: 'six',
    label: '6 Monthly',
    price: '$100',
    detail: 'Better value for regular matching.',
  },
  {
    id: 'yearly',
    label: '1 Year',
    price: '$150',
    detail: 'Best yearly subscription value.',
  },
] as const;

type SubscriptionModalProps = {
  mode: RoomMode;
  onClose: () => void;
  onBackToLanding?: () => void;
  /** Called after successful mock subscribe */
  onSubscribed?: (user: StoredUser) => void;
};

export function SubscriptionModal({
  mode,
  onClose,
  onBackToLanding,
  onSubscribed,
}: SubscriptionModalProps) {
  const isUnmod = mode === 'unmoderated';
  const plans = isUnmod ? UNMODERATED_PLANS : MODERATED_PLANS;
  const [step, setStep] = useState<'subscription' | 'payment'>('subscription');
  const [selectedPlan, setSelectedPlan] = useState<string>(plans[0].id);
  const [cardData, setCardData] = useState({
    nameOnCard: '',
    cardNumber: '',
    expiry: '',
    cvc: '',
  });
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleCardChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCardData((prev) => ({ ...prev, [name]: value }));
  };

  const completePayment = async () => {
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
      const result = await subscribeWithCard({
        plan: selectedPlan,
        nameOnCard: nameOnCard.trim(),
        cardNumber,
        expiry,
      });
      if (!result.ok) {
        setStatus(result.error);
        return;
      }
      onSubscribed?.(result.user);
      onClose();
    } catch {
      setStatus('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <section className={`flow-backdrop rizz-page ${mode}`} aria-hidden="false">
      <div className="flow-panel" role="dialog" aria-modal="true">
        <div className="flow-top">
          <span>{isUnmod ? 'Unmoderated Mode' : 'Moderated Mode'}</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {step === 'subscription' && (
          <div className="flow-screen">
            <h2>Choose Subscription</h2>
            <p>
              Changing your match preference requires a subscription. Select a
              plan and continue to payment.
            </p>
            <div
              className="plan-grid"
              style={
                !isUnmod
                  ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }
                  : undefined
              }
            >
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  className={selectedPlan === plan.id ? 'selected' : ''}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <strong>{plan.price}</strong>
                  <span>{plan.label}</span>
                  <small>{plan.detail}</small>
                </button>
              ))}
            </div>
            <div className="flow-actions">
              <button
                className="hot-button"
                type="button"
                onClick={() => {
                  setStatus('');
                  setStep('payment');
                }}
              >
                Continue to Payment
              </button>
              <button
                className="ghost-button"
                type="button"
                onClick={onBackToLanding ?? onClose}
              >
                Back to Landing
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="flow-screen payment-screen">
            <h2>Payment Details</h2>
            <p>
              Enter your card details to unlock match preference changes. No
              Stripe yet — we store the card and mark you subscribed.
            </p>
            <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
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
              <div
                className="form-grid"
                style={{ gridTemplateColumns: '1fr 1fr' }}
              >
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
            </div>
            {status && (
              <p className="flow-status" aria-live="polite">
                {status}
              </p>
            )}
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
                  setStep('subscription');
                }}
              >
                Change Plan
              </button>
            </div>
          </div>
        )}
      </div>
    </section>,
    document.body,
  );
}
