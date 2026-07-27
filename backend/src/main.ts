import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(json({ limit: '3mb' }));
  // Go.cam posts application/x-www-form-urlencoded callbacks.
  app.use(urlencoded({ extended: true }));
  // Honor X-Forwarded-For behind ngrok / reverse proxies (registration IP).
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  const corsOriginRaw =
    config.get<string>('corsOrigin') ?? 'http://localhost:5173';
  const corsOrigins = corsOriginRaw.split(',').map((o) => o.trim());

  app.enableCors({
    origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const port = config.get<number>('port') ?? 3001;
  await app.listen(port);

  Logger.log(`NestJS listening on http://localhost:${port}`, 'Bootstrap');
  Logger.log(`CORS origins: ${corsOrigins.join(', ')}`, 'Bootstrap');
}

void bootstrap();
