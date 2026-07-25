import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AdminAuthGuard extends AuthGuard('jwt') implements CanActivate {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ok = await super.canActivate(context);
    if (!ok) return false;

    const request = context.switchToHttp().getRequest<{ user: JwtPayload }>();
    const payload = request.user;
    if (!payload?.userId) {
      throw new UnauthorizedException('Invalid admin token');
    }

    const user = await this.usersService.findById(payload.userId);
    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    request.user = {
      userId: String(user._id),
      email: user.email,
      role: 'admin',
    };
    return true;
  }
}
