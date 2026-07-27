declare class AvsNodeSdkV1 {
  static AVS_URL: string;
  static VERIFICATION_VERSION_STANDARD_V1: number;
  static VERIFICATION_VERSION_IFRAME_V1: number;
  static SESSION_STATE_SUCCESS: number;

  userId: number | string | null;
  userData: Record<string, unknown> | null;
  verificationResult: {
    state?: string;
    stateInt?: number;
    sessionId?: number;
    errorCode?: number;
  } | null;

  constructor(cipherKey: string);
  fillRequest(requestList: Record<string, unknown>): void;
  toUrl(avsUrl?: string | null): string;
  toIframeUrl(avsUrl?: string | null): string;
  fromPayload(payloadHex: string): boolean;
}

export = AvsNodeSdkV1;
