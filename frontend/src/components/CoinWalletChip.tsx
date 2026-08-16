import { useEffect, useState } from 'react';
import { Coins } from 'lucide-react';
import { getCoinBalance } from '../services/coins';
import { getToken } from '../utils/auth';
import { CoinPurchaseModal } from './CoinPurchaseModal';

type CoinWalletChipProps = {
  className?: string;
  /** Compact style for chat panel */
  variant?: 'default' | 'compact';
  onBalanceChange?: (balance: number) => void;
};

export function CoinWalletChip({
  className = '',
  variant = 'default',
  onBalanceChange,
}: CoinWalletChipProps) {
  const [balance, setBalance] = useState<number | null>(null);
  const [showPurchase, setShowPurchase] = useState(false);

  const refresh = () => {
    if (!getToken()) {
      setBalance(null);
      return;
    }
    getCoinBalance().then((res) => {
      setBalance(res.balance);
      onBalanceChange?.(res.balance);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!getToken()) return null;

  return (
    <>
      <div className={`coin-wallet-chip ${variant} ${className}`.trim()}>
        <span className="coin-wallet-balance">
          <Coins size={variant === 'compact' ? 14 : 16} aria-hidden />
          <b>{balance === null ? '…' : balance.toLocaleString()}</b>
          <span className="coin-wallet-label">coins</span>
        </span>
        <button
          type="button"
          className="coin-wallet-buy"
          onClick={() => setShowPurchase(true)}
        >
          Buy coins
        </button>
      </div>

      {showPurchase && (
        <CoinPurchaseModal
          onClose={() => setShowPurchase(false)}
          onSuccess={(newBalance) => {
            setBalance(newBalance);
            onBalanceChange?.(newBalance);
            setShowPurchase(false);
          }}
        />
      )}

      <style>{`
        .coin-wallet-chip {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 6px 10px 6px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,45,122,.35);
          background: rgba(18,5,16,.75);
          box-shadow: 0 0 16px rgba(255,45,122,.15);
        }
        .coin-wallet-chip.compact {
          gap: 8px;
          padding: 4px 8px 4px 10px;
        }
        .coin-wallet-balance {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #FFE9F2;
        }
        .coin-wallet-balance b {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 18px;
          letter-spacing: .04em;
          color: #FF4D93;
          font-weight: 400;
        }
        .coin-wallet-chip.compact .coin-wallet-balance b {
          font-size: 16px;
        }
        .coin-wallet-label {
          color: #B98AA3;
          font-size: 11px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .coin-wallet-buy {
          border: none;
          cursor: pointer;
          border-radius: 999px;
          padding: 6px 12px;
          font-family: 'Bebas Neue', sans-serif;
          font-size: 13px;
          letter-spacing: .08em;
          color: #fff;
          background: linear-gradient(135deg, #FF4D93, #A1104F);
          box-shadow: 0 0 12px rgba(255,45,122,.35);
        }
        .coin-wallet-chip.compact .coin-wallet-buy {
          padding: 5px 10px;
          font-size: 12px;
        }
        .coin-wallet-buy:hover {
          filter: brightness(1.08);
        }
      `}</style>
    </>
  );
}
