import {
  BadRequestException,
  Body,
  Controller,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type JwtPayload,
} from '../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { UserProfileService } from '../users/user-profile.service';
import { PreferenceQueueService } from './preference-queue.service';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { UpdateMatchCountryDto } from './dto/update-match-country.dto';
import { normalizeInterestedIn } from '../common/utils/normalize.util';

@Controller('api/profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userProfileService: UserProfileService,
    private readonly preferenceQueue: PreferenceQueueService,
  ) {}

  /**
   * Live preference change:
   * 1) Require subscription if changing from current value
   * 2) Cache in Redis + enqueue Mongo write (async)
   * 3) Return immediately so client can re-queue matching
   */
  @Patch('preference')
  async updatePreference(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdatePreferenceDto,
  ) {
    const interestedIn = normalizeInterestedIn(body.interestedIn);
    if (!interestedIn) {
      throw new BadRequestException('Invalid match preference.');
    }

    const currentUser = await this.usersService.findById(user.userId);
    if (!currentUser) {
      throw new BadRequestException('User not found');
    }

    if (!currentUser.gender) {
      throw new BadRequestException('Gender is required before matching.');
    }

    // Fast path — Redis cache + async Mongo
    await this.preferenceQueue.cachePrefs(user.userId, {
      gender: currentUser.gender,
      interestedIn,
    });
    await this.preferenceQueue.enqueueMongoUpdate(user.userId, interestedIn);

    // Optimistic public user (Mongo may lag a moment)
    const publicUser = await this.userProfileService.toPublicUser(currentUser);
    publicUser.interestedIn = interestedIn;

    return { success: true, user: publicUser };
  }

  @Patch('match-country')
  async updateMatchCountry(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateMatchCountryDto,
  ) {
    const raw = body.matchCountry;
    const matchCountry =
      raw === null || raw === undefined || String(raw).trim() === ''
        ? null
        : String(raw).trim().toUpperCase();

    const updated = await this.usersService.updateMatchCountry(
      user.userId,
      matchCountry,
    );
    const publicUser = await this.userProfileService.toPublicUser(updated);
    return { success: true, user: publicUser };
  }
}
