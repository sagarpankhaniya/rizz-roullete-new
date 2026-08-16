import { IsNotEmpty, IsString } from 'class-validator';

export class EnterCreatorRoomDto {
  @IsNotEmpty()
  @IsString()
  creatorId: string;
}
