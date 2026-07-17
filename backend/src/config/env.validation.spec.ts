import { validateEnv } from './env.validation';

describe('validateEnv', () => {
  const valid = {
    NODE_ENV: 'test',
    PORT: '3000',
    MONGODB_URI: 'mongodb://localhost:27017/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: '1234567890123456',
    JWT_EXPIRES_IN: '7d',
    CORS_ORIGINS: 'http://localhost:5173',
    LIVEKIT_API_KEY: 'devkey',
    LIVEKIT_API_SECRET: 'secret',
    LIVEKIT_URL: 'ws://localhost:7880',
    LIVEKIT_HOST: 'http://localhost:7880',
  };

  it('parses a valid configuration', () => {
    const config = validateEnv(valid);
    expect(config.PORT).toBe(3000);
    expect(config.MATCH_RECENT_HOURS).toBe(24);
  });

  it('rejects a short JWT secret', () => {
    expect(() =>
      validateEnv({ ...valid, JWT_SECRET: 'short' }),
    ).toThrow(/Invalid environment configuration/);
  });

  it('rejects missing Mongo URI', () => {
    const { MONGODB_URI: _, ...rest } = valid;
    expect(() => validateEnv(rest)).toThrow(/MONGODB_URI/);
  });
});

