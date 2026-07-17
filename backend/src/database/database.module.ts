import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

/**
 * WHY Mongoose via Nest DI:
 * Connection lifecycle managed by Nest; schemas/repositories inject models cleanly.
 * Durable data only (users, sessions, history) — realtime queue stays in Redis.
 */
@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.getOrThrow<string>('database.uri'),
        autoIndex: configService.get<string>('app.nodeEnv') !== 'production',
      }),
    }),
  ],
})
export class DatabaseModule {}

