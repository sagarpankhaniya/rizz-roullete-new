import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onIdToken: (idToken: string) => void;
  onError?: () => void;
};

/**
 * Uses Google Identity Services (ID token / credential flow).
 * Only needs Authorized JavaScript origins — no redirect URIs required.
 */
export function GoogleSignInButton({
  disabled = false,
  onIdToken,
  onError,
}: GoogleSignInButtonProps) {
  if (disabled) {
    return (
      <div className="google-sign-in-button google-sign-in-button--disabled">
        Continue with Google
      </div>
    );
  }

  return (
    <div className="google-sign-in-wrap">
      <GoogleLogin
        onSuccess={(response: CredentialResponse) => {
          if (response.credential) {
            onIdToken(response.credential);
          } else {
            onError?.();
          }
        }}
        onError={() => onError?.()}
        useOneTap={false}
        theme="outline"
        size="large"
        text="continue_with"
        shape="pill"
        width={320}
      />
    </div>
  );
}
