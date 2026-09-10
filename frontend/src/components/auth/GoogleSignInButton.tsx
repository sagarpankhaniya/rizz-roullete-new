import { useEffect, useRef, useState } from 'react';
import { useGoogleLogin } from '@react-oauth/google';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  /**
   * Called with the OAuth2 authorization code (auth-code flow).
   * The backend exchanges this code for an ID token server-side,
   * which supports passkeys and all Google authentication methods.
   */
  onAuthCode: (code: string, redirectUri: string) => void;
  onError?: () => void;
};

/**
 * Uses the OAuth2 authorization code flow (flow='auth-code').
 * This opens accounts.google.com in a popup — a full browser context that
 * supports passkeys, hardware security keys, and every Google auth method.
 * The backend exchanges the code for tokens via GOOGLE_CLIENT_SECRET.
 */
export function GoogleSignInButton({
  disabled = false,
  onAuthCode,
  onError,
}: GoogleSignInButtonProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [buttonWidth, setButtonWidth] = useState(320);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;

    const updateWidth = () => {
      setButtonWidth(Math.max(Math.floor(node.getBoundingClientRect().width), 200));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // The redirect_uri for auth-code flow must be registered in Google Cloud Console.
  // For the popup flow, Google accepts the current origin as the redirect URI.
  const redirectUri = window.location.origin;

  const login = useGoogleLogin({
    flow: 'auth-code',
    scope: 'openid email profile',
    redirect_uri: redirectUri,
    onSuccess: (response) => {
      onAuthCode(response.code, redirectUri);
    },
    onError: () => onError?.(),
    onNonOAuthError: () => onError?.(),
  });

  if (disabled) {
    return (
      <div className="google-sign-in-button google-sign-in-button--disabled">
        Continue with Google
      </div>
    );
  }

  return (
    <div className="google-sign-in-wrap" ref={wrapRef}>
      <button
        type="button"
        className="google-sign-in-button"
        style={{ width: buttonWidth }}
        onClick={() => login()}
        aria-label="Continue with Google"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 48 48"
          width="20"
          height="20"
          aria-hidden="true"
          focusable="false"
        >
          <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
          <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
          <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          <path fill="none" d="M0 0h48v48H0z" />
        </svg>
        <span>Continue with Google</span>
      </button>
    </div>
  );
}
