import { apiUrl } from '../utils/api';
import { authHeaders } from '../utils/auth';

export type AgeVerificationStatus = {
  ageVerified: boolean;
  isBanned: boolean;
  banReason: string | null;
};

export type AgeVerificationSession = {
  alreadyVerified: boolean;
  iframeUrl: string | null;
  redirectUrl: string | null;
  goCamBaseUrl: string;
  preferPopup: boolean;
};

type AvsEventMessage = {
  name: string;
  data?: {
    payload?: string;
    status?: boolean;
    [key: string]: unknown;
  };
};

type AvsJsSdkNamespace = {
  V1: {
    Config: {
      create: (config: { iframeLocationUrl: string }) => void;
      EVENT_ON_CHECK_IFRAME_LOADED: string;
      EVENT_STATUS_REQUEST: string;
      EVENT_RESOURCE_PRELOAD: string;
      EVENT_ON_INITIAL_VERIFICATION_SUCCESS: string;
      EVENT_ON_INITIAL_VERIFICATION_NOT_FOUND: string;
      EVENT_ON_INITIAL_VERIFICATION_FATAL_ERROR: string;
      EVENT_ON_RESOURCES_LOADED: string;
      EVENT_ON_VERIFICATION_SUCCESS: string;
      EVENT_ON_VERIFICATION_ERROR: string;
      EVENT_ON_CLOSE_IFRAME: string;
    };
    Core: new () => {
      init: () => void;
      onMessage: (eventMessage: AvsEventMessage) => void;
      emit: (name: string, data?: Record<string, unknown>) => void;
      iframeInstance: {
        expand: () => void;
        collapse: () => void;
        destroy: () => void;
      };
    };
  };
};

declare global {
  interface Window {
    AvsJsSdk?: AvsJsSdkNamespace;
  }
}

const AGE_FLOW_TIMEOUT_MS = 5 * 60 * 1000;

let sdkLoadPromise: Promise<void> | null = null;

function loadOfficialSdk(): Promise<void> {
  if (window.AvsJsSdk?.V1) {
    return Promise.resolve();
  }
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-go-cam-sdk="1"]',
    );
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () =>
        reject(new Error('Failed to load Go.cam JS SDK.')),
      );
      return;
    }

    const script = document.createElement('script');
    script.src = '/go-cam/avsJsSdkV1.js';
    script.async = true;
    script.dataset.goCamSdk = '1';
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error('Failed to load Go.cam JS SDK.'));
    document.head.appendChild(script);
  });

  return sdkLoadPromise;
}

async function parseJson<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as
    | T
    | { error?: string; code?: string; message?: string };

  if (!response.ok) {
    const err = new Error(
      (body as { error?: string; message?: string }).error ||
        (body as { message?: string }).message ||
        `Age verification request failed (${response.status}).`,
    ) as Error & { code?: string };
    if (
      typeof body === 'object' &&
      body &&
      'code' in body &&
      typeof (body as { code?: string }).code === 'string'
    ) {
      err.code = (body as { code: string }).code;
    }
    throw err;
  }

  return body as T;
}

export async function fetchAgeStatus(): Promise<AgeVerificationStatus> {
  const response = await fetch(apiUrl('/api/age-verification/status'), {
    headers: authHeaders(),
  });
  return parseJson<AgeVerificationStatus>(response);
}

export async function createAgeSession(): Promise<AgeVerificationSession> {
  const response = await fetch(apiUrl('/api/age-verification/session'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: '{}',
    signal: AbortSignal.timeout(20_000),
  });
  return parseJson<AgeVerificationSession>(response);
}

export async function verifyAgePayload(
  verificationResultPayload: string,
): Promise<{ success: true; sessionId: number | null }> {
  const response = await fetch(apiUrl('/api/age-verification/integrity'), {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ verificationResultPayload }),
  });
  return parseJson(response);
}

/** Official Go.cam postMessage event names (from avsJsSdkV1.js). */
const GO_CAM_EVENTS = {
  STATUS_REQUEST: 'avs.statusRequest',
  RESOURCE_PRELOAD: 'avs.resourcePreload',
  ON_CHECK_IFRAME_LOADED: 'avs.onCheckIframeLoaded',
  ON_INITIAL_VERIFICATION_SUCCESS: 'avs.onInitialVerificationSuccess',
  ON_INITIAL_VERIFICATION_NOT_FOUND: 'avs.onInitialVerificationNotFound',
  ON_INITIAL_VERIFICATION_FATAL_ERROR: 'avs.onInitialVerificationFatalError',
  ON_RESOURCES_LOADED: 'avs.onResourcesLoaded',
  ON_VERIFICATION_SUCCESS: 'avs.onVerificationSuccess',
  ON_VERIFICATION_ERROR: 'avs.onVerificationError',
  ON_CLOSE_IFRAME: 'avs.onCloseIframe',
} as const;

async function pollUntilSettled(
  timeoutMs: number,
): Promise<'verified' | 'banned'> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await fetchAgeStatus();
    if (status.isBanned) return 'banned';
    if (status.ageVerified) return 'verified';
    await new Promise((r) => window.setTimeout(r, 800));
  }
  throw Object.assign(new Error('Age verification timed out.'), {
    code: 'AGE_TIMEOUT',
  });
}

/**
 * In-app overlay: set iframe.src directly.
 * Do NOT use window.open(url, frameName) — that often navigates the top tab
 * away from Rizz and looks like a different site.
 */
async function runIframeFlow(iframeUrl: string): Promise<void> {
  // Keep the official SDK script available for Go.cam's own embed helpers.
  await loadOfficialSdk().catch(() => undefined);

  const iframeOrigin = new URL(iframeUrl).origin;

  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const overlay = document.createElement('div');
    overlay.id = 'rizz-go-cam-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Age verification');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483000',
      'display:flex',
      'flex-direction:column',
      'background:rgba(8,6,12,0.72)',
      'backdrop-filter:blur(6px)',
    ].join(';');

    const header = document.createElement('div');
    header.style.cssText = [
      'flex:0 0 auto',
      'display:flex',
      'align-items:center',
      'justify-content:space-between',
      'gap:12px',
      'padding:12px 16px',
      'background:#120e18',
      'color:#fff',
      'font:600 14px/1.3 system-ui,sans-serif',
      'border-bottom:1px solid rgba(255,255,255,0.08)',
    ].join(';');
    header.innerHTML =
      '<span>Rizz Roulette · Age verification (18+)</span>';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.style.cssText =
      'border:0;border-radius:8px;padding:8px 12px;cursor:pointer;background:#2a2433;color:#fff;font:600 13px system-ui,sans-serif';
    header.appendChild(closeBtn);

    const frameWrap = document.createElement('div');
    frameWrap.style.cssText =
      'flex:1 1 auto;min-height:0;padding:0;background:#0b0b0f';

    const iframe = document.createElement('iframe');
    iframe.id = 'avsFactoryIframe';
    iframe.name = 'avsFactoryIframe';
    iframe.title = 'Go.cam age verification';
    iframe.allow =
      `camera ${window.location.href} ${iframeUrl}; microphone ${window.location.href} ${iframeUrl}`;
    iframe.setAttribute('allowtransparency', 'true');
    iframe.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#0b0b0f';
    // Critical: navigate the iframe only — never the top window.
    iframe.src = iframeUrl;

    frameWrap.appendChild(iframe);
    overlay.appendChild(header);
    overlay.appendChild(frameWrap);
    document.body.appendChild(overlay);

    const emit = (name: string, data: Record<string, unknown> = {}) => {
      iframe.contentWindow?.postMessage({ name, data }, iframeOrigin);
    };

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(statusPollId);
      window.removeEventListener('message', onWindowMessage);
      overlay.remove();
      document.getElementById('avsFactoryIframe')?.remove();
      document.getElementById('rizz-go-cam-overlay')?.remove();
    };

    const finishOk = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    };

    const finishErr = (error: Error & { code?: string }) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    // Auto-return when Nest receives Go.cam's adult success callback — no
    // "Back to the main site" click required. Under-18 bans are handled via
    // ON_VERIFICATION_ERROR (not this poll), so a prior ban cannot abort a retry.
    const statusPollId = window.setInterval(() => {
      void (async () => {
        if (settled) return;
        try {
          const status = await fetchAgeStatus();
          if (status.ageVerified) {
            finishOk();
          }
        } catch {
          // keep polling
        }
      })();
    }, 700);

    closeBtn.onclick = () => {
      finishErr(
        Object.assign(
          new Error('Age verification was closed before completion.'),
          { code: 'AGE_CANCELLED' },
        ),
      );
    };

    const timeoutId = window.setTimeout(() => {
      finishErr(
        Object.assign(new Error('Age verification timed out.'), {
          code: 'AGE_TIMEOUT',
        }),
      );
    }, AGE_FLOW_TIMEOUT_MS);

    /**
     * Validate encrypted Go.cam payload against the logged-in user.
     * @param fromCachedCookie — true for ON_INITIAL_VERIFICATION_SUCCESS.
     *   A stale cookie from another account must start a fresh flow, not fail.
     */
    const checkIntegrity = async (
      payload?: string,
      fromCachedCookie = false,
    ) => {
      if (payload) {
        try {
          await verifyAgePayload(payload);
          finishOk();
          return;
        } catch (error) {
          const code = (error as Error & { code?: string }).code;
          if (code === 'USER_BANNED') {
            finishErr(error as Error & { code?: string });
            return;
          }
          // Cookie/payload belongs to a different account (or is invalid).
          // Official Go.cam demo: emit RESOURCE_PRELOAD and continue.
          if (
            fromCachedCookie &&
            (code === 'AGE_PAYLOAD_MISMATCH' ||
              code === 'AGE_PAYLOAD_INVALID')
          ) {
            emit(GO_CAM_EVENTS.RESOURCE_PRELOAD);
            return;
          }
          // Fall through to status poll — Go.cam callback may already have landed.
        }
      }

      try {
        const outcome = await pollUntilSettled(12_000);
        if (outcome === 'banned') {
          finishErr(
            Object.assign(
              new Error('Account banned: you must be 18 or older.'),
              { code: 'USER_BANNED' },
            ),
          );
          return;
        }
        finishOk();
      } catch {
        if (fromCachedCookie) {
          emit(GO_CAM_EVENTS.RESOURCE_PRELOAD);
          return;
        }
        finishErr(
          Object.assign(
            new Error(
              payload
                ? 'Age verification payload could not be confirmed.'
                : 'Missing age verification payload.',
            ),
            { code: payload ? 'AGE_PAYLOAD_INVALID' : 'AGE_PAYLOAD_MISSING' },
          ),
        );
      }
    };

    const onFailedVerification = async () => {
      try {
        const outcome = await pollUntilSettled(8_000);
        if (outcome === 'banned') {
          finishErr(
            Object.assign(
              new Error('Account banned: you must be 18 or older.'),
              { code: 'USER_BANNED' },
            ),
          );
          return;
        }
        // Rare: treated as fail locally but Nest already marked adult.
        finishOk();
      } catch {
        finishErr(
          Object.assign(
            new Error(
              'Age verification did not pass. If you are under 18 you cannot use this service.',
            ),
            { code: 'AGE_FAILED' },
          ),
        );
      }
    };

    const handleEvent = (eventMessage: AvsEventMessage) => {
      switch (eventMessage.name) {
        case GO_CAM_EVENTS.ON_CHECK_IFRAME_LOADED:
          emit(GO_CAM_EVENTS.STATUS_REQUEST);
          break;
        case GO_CAM_EVENTS.ON_INITIAL_VERIFICATION_SUCCESS:
          // Browser cookie from a prior account must not block this user.
          void checkIntegrity(eventMessage.data?.payload, true);
          break;
        case GO_CAM_EVENTS.ON_INITIAL_VERIFICATION_NOT_FOUND:
          emit(GO_CAM_EVENTS.RESOURCE_PRELOAD);
          break;
        case GO_CAM_EVENTS.ON_INITIAL_VERIFICATION_FATAL_ERROR:
          finishErr(
            Object.assign(new Error('Age verification failed to start.'), {
              code: 'AGE_FATAL',
            }),
          );
          break;
        case GO_CAM_EVENTS.ON_RESOURCES_LOADED:
          break;
        case GO_CAM_EVENTS.ON_VERIFICATION_SUCCESS:
          // Adult confirmed in Go.cam — validate + return to video call.
          void checkIntegrity(eventMessage.data?.payload);
          break;
        case GO_CAM_EVENTS.ON_VERIFICATION_ERROR:
          // Under 18 / failed — Nest callback bans; poll confirms.
          void onFailedVerification();
          break;
        case GO_CAM_EVENTS.ON_CLOSE_IFRAME:
          // "Back to the main site" / close: succeed if already adult, else cancel.
          void (async () => {
            try {
              const status = await fetchAgeStatus();
              if (status.isBanned) {
                finishErr(
                  Object.assign(
                    new Error(
                      status.banReason ??
                        'Account banned: you must be 18 or older.',
                    ),
                    { code: 'USER_BANNED' },
                  ),
                );
                return;
              }
              if (status.ageVerified) {
                finishOk();
                return;
              }
            } catch {
              // ignore and treat as cancel
            }
            finishErr(
              Object.assign(
                new Error('Age verification was closed before completion.'),
                { code: 'AGE_CANCELLED' },
              ),
            );
          })();
          break;
        default:
          break;
      }
    };

    const onWindowMessage = (event: MessageEvent) => {
      try {
        if (new URL(event.origin).hostname !== new URL(iframeOrigin).hostname) {
          return;
        }
      } catch {
        return;
      }
      const data = event.data as AvsEventMessage | null;
      if (!data || typeof data.name !== 'string') return;
      handleEvent(data);
    };

    window.addEventListener('message', onWindowMessage);

    iframe.addEventListener('load', () => {
      handleEvent({ name: GO_CAM_EVENTS.ON_CHECK_IFRAME_LOADED });
    });
  });
}

/**
 * Always keep Go.cam inside an in-page overlay (never top-level navigation).
 */
export async function runGoCamAgeVerification(
  session: AgeVerificationSession,
): Promise<void> {
  if (session.alreadyVerified) return;

  if (!session.iframeUrl) {
    throw new Error('Age verification URL was not provided.');
  }
  await runIframeFlow(session.iframeUrl);
}
