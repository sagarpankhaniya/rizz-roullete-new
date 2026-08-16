import { useState, type ChangeEvent } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, X, Zap } from 'lucide-react';
import { buyCoins } from '../services/coins';

const COIN_PACKS = [
  { id: 'small', label: 'Small Boost', amount: 450, price: '$4.99', duration: '10 mins' },
  { id: 'normal', label: 'Normal Boost', amount: 1000, price: '$9.99', duration: '30 mins' },
  { id: 'super', label: 'Super Boost', amount: 2100, price: '$19.99', duration: '1 hr' },
  { id: 'hyper', label: 'Hyper Boost', amount: 7900, price: '$49.99', duration: '5 hrs' },
] as const;

type CoinPurchaseModalProps = {
  onClose: () => void;
  onSuccess?: (newBalance: number) => void;
};

export function CoinPurchaseModal({ onClose, onSuccess }: CoinPurchaseModalProps) {
  const [step, setStep] = useState<'packs' | 'payment'>('packs');
  const [selectedPack, setSelectedPack] = useState<(typeof COIN_PACKS)[number]>(COIN_PACKS[0]);
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

  const handlePurchase = async () => {
    const { nameOnCard, cardNumber, expiry, cvc } = cardData;
    if (!nameOnCard.trim() || !cardNumber.trim() || !expiry.trim() || !cvc.trim()) {
      setStatus('Please fill in all card details.');
      return;
    }
    
    setStatus('');
    setSubmitting(true);
    try {
      const result = await buyCoins({
        packId: selectedPack.id,
        packLabel: selectedPack.label,
        amount: selectedPack.amount,
        nameOnCard: nameOnCard.trim(),
        cardNumber: cardNumber.trim(),
        expiry: expiry.trim(),
        cvc: cvc.trim(),
      });
      
      if (!result.ok) {
        setStatus(result.error || 'Purchase failed');
        return;
      }
      
      onSuccess?.(result.balance || 0);
      onClose();
    } catch {
      setStatus('Server error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <section className="flow-backdrop rizz-page moderated" aria-hidden="false">
      <div className="flow-panel" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
        <div className="flow-top">
          <span>Buy A Boost!</span>
          <button type="button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {step === 'packs' && (
          <div className="flow-screen">
            <h2 style={{ fontSize: '24px', marginBottom: '8px' }}>Select a Boost</h2>
            <p style={{ opacity: 0.7, marginBottom: '20px' }}>
              Match *ONLY* with the hottest people on Thundr! Try it today.
            </p>
            
            <div className="plan-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {COIN_PACKS.map((pack) => (
                <button
                  key={pack.id}
                  className={`coin-pack-card ${selectedPack.id === pack.id ? 'selected' : ''}`}
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    textAlign: 'center',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ position: 'relative', marginBottom: '12px' }}>
                    <div style={{ 
                      background: 'rgba(255, 61, 147, 0.2)', 
                      borderRadius: '50%', 
                      padding: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Zap size={32} color="#FF2D7A" fill="#FF2D7A" />
                    </div>
                    <div style={{
                      position: 'absolute',
                      top: '-8px',
                      right: '-20px',
                      background: '#FF2D7A',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '99px',
                      whiteSpace: 'nowrap'
                    }}>
                      Lasts {pack.duration}
                    </div>
                  </div>
                  <strong style={{ display: 'block', fontSize: '16px', marginBottom: '4px' }}>{pack.label}</strong>
                  <span style={{ color: '#FFD97A', fontFamily: 'Bebas Neue', fontSize: '20px' }}>
                    {pack.amount.toLocaleString()} Coins
                  </span>
                  <div style={{ marginTop: '12px', background: '#FF2D7A', color: 'white', padding: '6px 16px', borderRadius: '99px', fontWeight: 600, fontSize: '14px' }}>
                    {pack.price}
                  </div>
                </button>
              ))}
            </div>

            <div className="flow-actions" style={{ marginTop: '24px' }}>
              <button
                className="hot-button"
                type="button"
                onClick={() => setStep('payment')}
                style={{ width: '100%' }}
              >
                Continue to Payment
              </button>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="flow-screen payment-screen">
            <h2>Payment Details</h2>
            <p>
              Enter your card details to purchase {selectedPack.label}. 
              No actual payment is processed.
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
              <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
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
            {status && <p className="flow-status">{status}</p>}
            <div className="flow-actions">
              <button
                className="hot-button"
                type="button"
                onClick={handlePurchase}
                disabled={submitting}
              >
                <BadgeCheck size={18} /> {submitting ? 'Processing…' : 'Buy Now'}
              </button>
              <button className="ghost-button" type="button" onClick={() => setStep('packs')}>
                Back to Selection
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .coin-pack-card:hover {
          transform: translateY(-4px);
          border-color: #FF2D7A !important;
          background: rgba(255, 45, 122, 0.1) !important;
        }
        .coin-pack-card.selected {
          border-color: #FF2D7A !important;
          background: rgba(255, 45, 122, 0.15) !important;
          box-shadow: 0 0 20px rgba(255, 45, 122, 0.3);
        }
      `}</style>
    </section>,
    document.body
  );
}
