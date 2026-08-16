import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket } from '../services/socket';
import { SOCKET_EVENTS } from '../types/events';
import { getCoinBalance } from '../services/coins';
import { CoinPurchaseModal } from './CoinPurchaseModal';

const MIN = 10;
const MAX = 5000;

const MENU = [
  { label: 'Say my name', price: 50 },
  { label: 'Blow a kiss', price: 100 },
  { label: 'Dance for me', price: 200 },
  { label: 'Outfit change', price: 500 },
  { label: 'Go private', price: 2000 },
];

type CoinModuleProps = {
  partnerIdentity: string;
  /** Tips only work during an active call */
  tipsEnabled?: boolean;
};

export function CoinModule({
  partnerIdentity,
  tipsEnabled = true,
}: CoinModuleProps) {
  const [balance, setBalance] = useState(0);
  const [charging, setCharging] = useState(false);
  const [amount, setAmount] = useState(MIN);
  const [showPurchase, setShowPurchase] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [customRequest, setCustomRequest] = useState('');
  const [customAmount, setCustomAmount] = useState(String(MIN));
  const [feed, setFeed] = useState<{ id: number; text: string }[]>([]);
  const [intensity, setIntensity] = useState(0);
  const [bigAmt, setBigAmt] = useState<string | null>(null);

  const t0 = useRef<number>(0);
  const raf = useRef<number>(0);
  const socket = getSocket();

  useEffect(() => {
    getCoinBalance().then((res) => setBalance(res.balance));
  }, []);

  const levelFor = (a: number) => {
    if (a >= 1000) return 5;
    if (a >= 400) return 4;
    if (a >= 150) return 3;
    if (a >= 50) return 2;
    return 1;
  };

  const addFeed = useCallback((a: number, label?: string) => {
    const text = label ? `${a} coins for "${label}" sent to ${partnerIdentity}` : `${a} coins sent to ${partnerIdentity}`;
    const id = Date.now();
    setFeed((prev) => [...prev, { id, text }].slice(-4));
    setTimeout(() => {
      setFeed((prev) => prev.filter((f) => f.id !== id));
    }, 5000);
  }, [partnerIdentity]);

  const fire = useCallback((a: number, label?: string, notifyChat?: boolean) => {
    if (!tipsEnabled) return;
    if (a > balance) {
      setShowPurchase(true);
      return;
    }

    socket.emit(
      SOCKET_EVENTS.SEND_TIP,
      { amount: String(a), menuItem: label?.trim() || undefined },
      (response?: { ok?: boolean; newBalance?: number }) => {
        if (response?.ok && typeof response.newBalance === 'number') {
          setBalance(response.newBalance);
          setBigAmt(`+${a.toLocaleString()}`);
          setTimeout(() => setBigAmt(null), 1250);
          addFeed(a, label);
          setIntensity(levelFor(a));
          setTimeout(() => setIntensity(0), 1400);
          if (notifyChat && label?.trim()) {
            socket.emit(SOCKET_EVENTS.SEND_CHAT, {
              text: `💰 ${a.toLocaleString()} coins — ${label.trim()}`,
            });
          }
          return;
        }
        getCoinBalance().then((res) => setBalance(res.balance));
        setShowPurchase(true);
      },
    );
  }, [balance, socket, addFeed, tipsEnabled]);

  const sendCustomRequest = () => {
    if (!tipsEnabled) return;
    const label = customRequest.trim();
    const coins = Number.parseInt(customAmount, 10);
    if (!label || label.length > 120) return;
    if (!Number.isFinite(coins) || coins < MIN || coins > MAX) return;
    if (coins > balance) {
      setShowPurchase(true);
      return;
    }
    fire(coins, label, true);
    setCustomRequest('');
    setCustomAmount(String(MIN));
    setShowDrawer(false);
  };

  const parsedCustomAmount = Number.parseInt(customAmount, 10);
  const customAmountValid =
    Number.isFinite(parsedCustomAmount) &&
    parsedCustomAmount >= MIN &&
    parsedCustomAmount <= MAX;
  const customCanSend =
    tipsEnabled &&
    customRequest.trim().length > 0 &&
    customAmountValid &&
    parsedCustomAmount <= balance;

  const ramp = useCallback((ts: number) => {
    if (!tipsEnabled || !charging) return;
    if (!t0.current) t0.current = ts;
    const t = (ts - t0.current) / 1000;
    let a = 10 * (1 + t * t * 8);
    const ceiling = Math.min(MAX, balance);
    a = Math.min(ceiling, a);
    const rounded = a < 100 ? Math.round(a / 5) * 5 : Math.round(a / 10) * 10;
    
    setAmount(rounded);
    setIntensity(levelFor(rounded));
    raf.current = requestAnimationFrame(ramp);
  }, [charging, balance, tipsEnabled]);

  useEffect(() => {
    if (!tipsEnabled) {
      setCharging(false);
    }
  }, [tipsEnabled]);

  useEffect(() => {
    if (charging) {
      raf.current = requestAnimationFrame(ramp);
    } else {
      cancelAnimationFrame(raf.current);
    }
    return () => cancelAnimationFrame(raf.current);
  }, [charging, ramp]);

  const startHold = (e: React.PointerEvent | React.KeyboardEvent) => {
    if (!tipsEnabled || showDrawer) return;
    if (balance < MIN) {
      setShowPurchase(true);
      return;
    }
    e.preventDefault();
    setCharging(true);
    t0.current = 0;
    setAmount(MIN);
  };

  const endHold = (send: boolean) => {
    if (!charging) return;
    setCharging(false);
    if (send && amount >= MIN) {
      fire(amount, 'Hold to tip');
    }
    setAmount(MIN);
    setIntensity(0);
  };

  return (
    <div className="coin-module">
      <div className="top-bar">
        <div className="wallet">
          <span className="amt">{balance.toLocaleString()}</span>
          <button className="topup" onClick={() => setShowPurchase(true)}>GET COINS</button>
        </div>
      </div>

      <div className="tip-feed">
        {feed.map((item) => (
          <div key={item.id} className="feed-item">
            {item.text}
          </div>
        ))}
      </div>

      <div className={`intensity-meter ${charging || intensity > 0 ? 'on' : ''}`}>
        {[1, 2, 3, 4, 5].map((lv) => (
          <i key={lv} className={intensity >= lv ? 'lit' : ''} />
        ))}
        <label>INTENSITY</label>
      </div>

      {bigAmt && <div className="big-amt go">{bigAmt}</div>}

      {!tipsEnabled && (
        <div className="coin-waiting-banner">
          Waiting for {partnerIdentity} to connect — buy coins now, tips unlock once live.
        </div>
      )}

      <div className={`bottom-dock${showDrawer ? ' hidden' : ''}${!tipsEnabled ? ' tips-disabled' : ''}`}>
        <div className="chips">
          <button type="button" className="chip" disabled={!tipsEnabled} onClick={() => fire(50, 'Hi')}>50 Hi</button>
          <button type="button" className="chip" disabled={!tipsEnabled} onClick={() => fire(100, 'Nice')}>100 Nice</button>
          <button type="button" className="chip" disabled={!tipsEnabled} onClick={() => fire(500, 'Spoil')}>500 Spoil</button>
          <button
            type="button"
            className={`chip menu-btn ${showDrawer ? 'open' : ''}`}
            disabled={!tipsEnabled}
            onClick={() => tipsEnabled && setShowDrawer(true)}
          >
            HER MENU
          </button>
        </div>
        <div className="send-row">
          <button
            type="button"
            className={`hold-btn ${charging ? 'charging' : ''}`}
            disabled={!tipsEnabled}
            onPointerDown={startHold}
            onPointerUp={() => endHold(true)}
            onPointerLeave={() => endHold(false)}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && startHold(e)}
            onKeyUp={(e) => (e.key === ' ' || e.key === 'Enter') && endHold(true)}
          >
            <span
              className="fill"
              style={{
                transform: `scaleX(${charging ? Math.min(1, amount / Math.min(MAX, balance)) : 0})`,
              }}
            />
            <div className="lbl">
              <b>{charging ? 'CHARGING...' : 'HOLD TO TIP'}</b>
              <span>{charging ? 'RELEASE TO SEND' : 'DRAG OFF TO CANCEL'}</span>
            </div>
            <div className="val">{amount.toLocaleString()}</div>
          </button>
        </div>
      </div>

      {showDrawer && (
        <div className="tip-drawer open" role="dialog" aria-label={`${partnerIdentity}'s menu`}>
          <button type="button" className="close-btn" onClick={() => setShowDrawer(false)} aria-label="Close menu">
            &times;
          </button>
          <h3>{partnerIdentity}&apos;s Menu</h3>
          <div className="menu-list">
            {MENU.map((m) => (
              <button
                key={m.label}
                type="button"
                className={`menu-item ${m.price > balance ? 'locked' : ''}`}
                disabled={!tipsEnabled || m.price > balance}
                onClick={() => {
                  if (m.price <= balance) {
                    fire(m.price, m.label, true);
                    setShowDrawer(false);
                  }
                }}
              >
                <span className="menu-label">{m.label}</span>
                <span className="price">{m.price.toLocaleString()}</span>
              </button>
            ))}
          </div>

          <div className="menu-custom">
            <div className="menu-custom-row">
              <input
                type="text"
                className="menu-custom-request"
                placeholder="Type what you want her to do…"
                maxLength={120}
                value={customRequest}
                disabled={!tipsEnabled}
                onChange={(e) => setCustomRequest(e.target.value)}
              />
              <input
                type="number"
                className="menu-custom-amount"
                min={MIN}
                max={MAX}
                step={5}
                value={customAmount}
                disabled={!tipsEnabled}
                aria-label="Coin amount"
                onChange={(e) => setCustomAmount(e.target.value)}
              />
              <button
                type="button"
                className="menu-custom-send"
                disabled={!customCanSend}
                onClick={sendCustomRequest}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      {showPurchase && (
        <CoinPurchaseModal 
          onClose={() => setShowPurchase(false)} 
          onSuccess={(newBal) => setBalance(newBal)}
        />
      )}

      <style>{`
        .coin-module { position: absolute; inset: 0; pointer-events: none; z-index: 20; color: #F2F2F6; }
        .coin-module > * { pointer-events: auto; }

        .coin-waiting-banner {
          position: absolute; left: 16px; right: 16px; bottom: 108px;
          padding: 10px 14px; border-radius: 10px; font-size: 12px; line-height: 1.4;
          background: rgba(14,14,18,0.88); border: 1px solid rgba(255,197,61,0.35);
          color: #FFC53D; text-align: center;
        }

        .bottom-dock.tips-disabled { opacity: 0.55; }
        .bottom-dock.tips-disabled .chip,
        .bottom-dock.tips-disabled .hold-btn { cursor: not-allowed; }
        
        .top-bar { position: absolute; top: 0; right: 0; padding: 14px 16px; }
        .wallet { 
          display: flex; align-items: center; gap: 8px; 
          background: rgba(14,14,18,0.72); backdrop-filter: blur(14px);
          border: 1px solid rgba(255,255,255,0.09); border-radius: 999px; padding: 6px 8px 6px 12px;
        }
        .wallet .amt { font-family: 'Bebas Neue', sans-serif; font-size: 20px; color: #FFC53D; }
        .topup { 
          background: #FF1B6B; border: none; color: white; border-radius: 999px;
          padding: 5px 11px; font-weight: 600; font-size: 11px; cursor: pointer;
        }

        .tip-feed { position: absolute; left: 16px; bottom: 140px; display: flex; flex-direction: column-reverse; gap: 6px; }
        .feed-item {
          background: rgba(14,14,18,0.72); backdrop-filter: blur(12px);
          border: 1px solid rgba(255,255,255,0.09); border-left: 2px solid #FFC53D;
          border-radius: 5px; padding: 6px 11px; font-size: 12px;
          animation: feedIn 0.3s ease-out;
        }
        @keyframes feedIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }

        .intensity-meter { 
          position: absolute; right: 16px; bottom: 140px; display: flex; flex-direction: column-reverse; 
          gap: 4px; align-items: center; opacity: 0; transition: 0.2s;
        }
        .intensity-meter.on { opacity: 1; }
        .intensity-meter i { width: 8px; height: 16px; background: rgba(255,255,255,0.11); border-radius: 2px; transition: 0.1s; }
        .intensity-meter i.lit { background: #FF1B6B; transform: scaleX(1.3); }
        .intensity-meter label { font-size: 9px; letter-spacing: 0.1em; color: #8B8B99; writing-mode: vertical-rl; margin-bottom: 6px; }

        .big-amt { 
          position: absolute; left: 50%; bottom: 200px; transform: translateX(-50%);
          font-family: 'Bebas Neue', sans-serif; font-size: 64px; color: #FFC53D;
          text-shadow: 0 0 20px rgba(255, 197, 61, 0.6); opacity: 0;
        }
        .big-amt.go { animation: bigAmt 1.2s cubic-bezier(0.2, 0.9, 0.3, 1) both; }
        @keyframes bigAmt { 
          0% { opacity: 0; transform: translateX(-50%) scale(0.5); }
          20% { opacity: 1; transform: translateX(-50%) scale(1.1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-30px) scale(0.9); }
        }

        .bottom-dock { position: absolute; bottom: 0; left: 0; right: 0; padding: 10px 12px 12px; background: linear-gradient(0deg, rgba(8,8,10,0.95), transparent); z-index: 21; }
        .bottom-dock.hidden { display: none; }
        .chips { display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap; }
        .chip { 
          background: rgba(14,14,18,0.72); border: 1px solid rgba(255,255,255,0.09);
          border-radius: 999px; color: white; padding: 6px 12px; font-size: 11px; font-weight: 600;
          cursor: pointer; transition: 0.2s;
        }
        .chip:hover { border-color: #FF1B6B; background: rgba(255, 27, 107, 0.1); }
        .menu-btn { margin-left: auto; }
        .menu-btn.open { color: #FF1B6B; border-color: #FF1B6B; }

        .send-row { max-width: 420px; margin: 0 auto; width: 100%; }
        .hold-btn {
          position: relative; width: 100%; height: 44px; border-radius: 8px; border: none;
          background: linear-gradient(135deg, #FF1B6B, #B3124E); color: white;
          display: flex; align-items: center; justify-content: space-between; padding: 0 14px;
          cursor: pointer; overflow: hidden;
        }
        .hold-btn .fill { position: absolute; inset: 0; background: rgba(255,197,61,0.4); transform-origin: left; transform: scaleX(0); pointer-events: none; }
        .hold-btn .lbl { position: relative; z-index: 1; text-align: left; line-height: 1.2; }
        .hold-btn .lbl b { display: block; font-size: 12px; letter-spacing: 0.03em; }
        .hold-btn .lbl span { display: block; font-size: 9px; opacity: 0.75; }
        .hold-btn .val { position: relative; z-index: 1; font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #FFC53D; flex-shrink: 0; margin-left: 8px; line-height: 1; }

        .tip-drawer {
          position: absolute; left: 0; right: 0; bottom: 0;
          max-height: min(78vh, 480px);
          background: rgba(11,11,15,0.98);
          backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px 16px 0 0; padding: 18px 14px calc(20px + env(safe-area-inset-bottom, 0px));
          z-index: 30;
          display: flex; flex-direction: column;
          animation: drawerIn 0.28s ease-out;
        }
        @keyframes drawerIn { from { transform: translateY(100%); } to { transform: none; } }
        .tip-drawer h3 { font-family: 'Bebas Neue', sans-serif; font-size: 22px; margin: 0 36px 12px 0; letter-spacing: 0.02em; }
        .menu-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          overflow-y: auto;
          flex: 0 0 auto;
          max-height: 240px;
          margin-bottom: 10px;
        }
        .menu-item {
          display: flex; flex-direction: row; align-items: center; justify-content: space-between;
          gap: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 12px 14px; color: white; cursor: pointer;
          min-height: 48px; text-align: left; transition: border-color 0.2s, background 0.2s;
          width: 100%;
        }
        .menu-item:hover:not(:disabled) { border-color: rgba(255, 27, 107, 0.45); background: rgba(255, 27, 107, 0.08); }
        .menu-item .menu-label { flex: 1; min-width: 0; font-size: 14px; font-weight: 600; line-height: 1.3; }
        .menu-item.locked { opacity: 0.35; cursor: not-allowed; }
        .menu-item:disabled { cursor: not-allowed; }
        .menu-item .price {
          flex-shrink: 0; font-family: 'Bebas Neue', sans-serif; font-size: 20px;
          color: #FFC53D; letter-spacing: 0.04em; line-height: 1;
        }
        .menu-custom { flex-shrink: 0; }
        .menu-custom-row {
          display: flex; gap: 8px; align-items: stretch; width: 100%;
        }
        .menu-custom-request {
          flex: 1; min-width: 0; box-sizing: border-box;
          padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06); color: white; font-size: 13px;
        }
        .menu-custom-request::placeholder { color: rgba(255,255,255,0.35); }
        .menu-custom-request:focus { outline: none; border-color: rgba(255, 27, 107, 0.5); }
        .menu-custom-amount {
          width: 72px; flex-shrink: 0; box-sizing: border-box; padding: 10px 8px;
          border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);
          background: rgba(255,255,255,0.06); color: #FFC53D;
          font-family: 'Bebas Neue', sans-serif; font-size: 20px; text-align: center;
        }
        .menu-custom-amount:focus { outline: none; border-color: rgba(255, 197, 61, 0.45); }
        .menu-custom-send {
          flex-shrink: 0; min-width: 72px; padding: 0 14px;
          border: none; border-radius: 8px; background: linear-gradient(135deg, #FF1B6B, #B3124E);
          color: white; font-weight: 700; font-size: 13px; cursor: pointer;
        }
        .menu-custom-send:disabled { opacity: 0.4; cursor: not-allowed; }
        .close-btn { position: absolute; top: 12px; right: 12px; background: none; border: none; color: #8B8B99; font-size: 28px; line-height: 1; cursor: pointer; padding: 4px; }
      `}</style>
    </div>
  );
}
