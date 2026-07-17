import { utilities as nestWinstonModuleUtilities, WinstonModule } from 'nest-winston';
import * as winston from 'winston';

/**
 * WHY Winston via nest-winston:
 * Structured JSON in production (ops/aggregators);
 * colorized console in development for readability.
 * Secrets must never be logged — redact at call sites.
 */
export function createWinstonLogger(nodeEnv: string) {
  const isProduction = nodeEnv === 'production';

  return WinstonModule.createLogger({
    transports: [
      new winston.transports.Console({
        level: isProduction ? 'info' : 'debug',
        format: isProduction
          ? winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            )
          : winston.format.combine(
              winston.format.timestamp(),
              winston.format.ms(),
              nestWinstonModuleUtilities.format.nestLike('RizzRoutlet', {
                prettyPrint: true,
                colors: true,
              }),
            ),
      }),
    ],
  });
}

