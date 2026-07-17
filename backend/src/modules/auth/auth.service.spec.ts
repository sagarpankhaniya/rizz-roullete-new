import { HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { AppException } from '../../common/exceptions/app.exception';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findOrCreateGuest' | 'toPublic' | 'findByIdOrThrow' | 'touchLastSeen'>
  >;
  let jwtService: jest.Mocked<Pick<JwtService, 'signAsync'>>;

  const guestUser = {
    id: '507f1f77bcf86cd799439011',
    anonymousId: '11111111-1111-4111-8111-111111111111',
    authProvider: 'guest' as const,
    isBanned: false,
    preferences: {},
    lastSeenAt: new Date(),
  };

  beforeEach(async () => {
    usersService = {
      findOrCreateGuest: jest.fn().mockResolvedValue(guestUser),
      toPublic: jest.fn().mockReturnValue({
        id: guestUser.id,
        anonymousId: guestUser.anonymousId,
        authProvider: 'guest',
        isBanned: false,
      }),
      findByIdOrThrow: jest.fn().mockResolvedValue(guestUser),
      touchLastSeen: jest.fn().mockResolvedValue(undefined),
    };

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('test.jwt.token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'jwt.secret') return 'test-secret-at-least-16';
              if (key === 'jwt.expiresIn') return '7d';
              throw new Error(`unexpected key ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  it('creates a guest session and returns accessToken + user', async () => {
    const result = await service.createGuestSession(guestUser.anonymousId);

    expect(usersService.findOrCreateGuest).toHaveBeenCalledWith(
      guestUser.anonymousId,
    );
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: guestUser.id, role: 'guest' },
      expect.objectContaining({ expiresIn: '7d' }),
    );
    expect(result.accessToken).toBe('test.jwt.token');
    expect(result.user.id).toBe(guestUser.id);
  });

  it('rejects banned guests', async () => {
    usersService.findOrCreateGuest.mockResolvedValue({
      ...guestUser,
      isBanned: true,
      banReason: 'abuse',
    } as never);

    await expect(
      service.createGuestSession(guestUser.anonymousId),
    ).rejects.toBeInstanceOf(AppException);

    try {
      await service.createGuestSession(guestUser.anonymousId);
    } catch (error) {
      expect(error).toBeInstanceOf(AppException);
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('returns current user for getMe', async () => {
    const me = await service.getMe(guestUser.id);
    expect(usersService.findByIdOrThrow).toHaveBeenCalledWith(guestUser.id);
    expect(usersService.touchLastSeen).toHaveBeenCalledWith(guestUser.id);
    expect(me.id).toBe(guestUser.id);
  });
});

