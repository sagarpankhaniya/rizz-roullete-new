import { livekitWsUrlToHttpHost } from './livekit-url.util';

describe('livekitWsUrlToHttpHost', () => {
  it('maps ws:// to http://', () => {
    expect(livekitWsUrlToHttpHost('ws://127.0.0.1:7880')).toBe(
      'http://127.0.0.1:7880',
    );
  });

  it('maps wss:// to https://', () => {
    expect(livekitWsUrlToHttpHost('wss://livekit.example.com')).toBe(
      'https://livekit.example.com',
    );
  });

  it('rejects non-WebSocket schemes', () => {
    expect(() => livekitWsUrlToHttpHost('https://example.com')).toThrow(
      /LIVEKIT_URL must start with ws:\/\/ or wss:\/\//,
    );
  });
});
