import type { CallPhase } from '../types/events';

interface CallControlsProps {
  phase: CallPhase;
  onStart: () => void;
  onLeave: () => void;
  onReset: () => void;
}

export function CallControls({
  phase,
  onStart,
  onLeave,
  onReset,
}: CallControlsProps) {
  const inActiveCall =
    phase === 'waiting' ||
    phase === 'matched' ||
    phase === 'connecting' ||
    phase === 'in_call';

  return (
    <div className="controls">
      {!inActiveCall && phase !== 'partner_left' && (
        <button type="button" className="btn btn-primary" onClick={onStart}>
          Start Call
        </button>
      )}

      {inActiveCall && (
        <button type="button" className="btn btn-danger" onClick={onLeave}>
          Leave Call
        </button>
      )}

      {(phase === 'partner_left' || phase === 'error') && (
        <button type="button" className="btn btn-primary" onClick={onReset}>
          Start Again
        </button>
      )}
    </div>
  );
}
