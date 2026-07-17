import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import type { GuestAuthResponseDto } from './dto/guest-auth.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { PublicUserDto } from './dto/guest-auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async createGuestSession(anonymousId?: string): Promise<GuestAuthResponseDto> {
    const id = anonymousId ?? randomUUID();
    const user = await this.usersService.findOrCreateGuest(id);

    if (user.isBanned) {
      throw new AppException(
        'USER_BANNED',
        user.banReason ?? 'This account is banned',
        HttpStatus.FORBIDDEN,
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      role: 'guest',
    };

    const expiresIn = this.configService.getOrThrow<string>('jwt.expiresIn')
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwt.secret'),
      expiresIn: expiresIn as `${number}d` | `${number}h` | `${number}s`,
    })

    return {
      accessToken,
      user: this.usersService.toPublic(user),
    };
  }

  async getMe(userId: string): Promise<PublicUserDto> {
    const user = await this.usersService.findByIdOrThrow(userId);
    if (user.isBanned) {
      throw new AppException(
        'USER_BANNED',
        user.banReason ?? 'This account is banned',
        HttpStatus.FORBIDDEN,
      );
    }
    await this.usersService.touchLastSeen(userId);
    return this.usersService.toPublic(user);
  }
}

