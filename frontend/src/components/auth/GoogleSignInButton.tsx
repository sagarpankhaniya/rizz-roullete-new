import { useEffect, useRef, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';

type GoogleSignInButtonProps = {
  disabled?: boolean;
  onIdToken: (idToken: string) => void;
  onError?: () => void;
};

export function GoogleSignInButton({
  disabled = false,
  onIdToken,
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

  if (disabled) {
    return (
      <div className="google-sign-in-button google-sign-in-button--disabled">
        Continue with Google
      </div>
    );
  }

  return (
    <div className="google-sign-in-wrap" ref={wrapRef}>
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
        auto_select={false}
        context="signin"
        ux_mode="popup"
        theme="outline"
        size="large"
        text="continue_with"
        shape="pill"
        width={buttonWidth}
      />
    </div>
  );
}
