import { Controller, Get, Param, Query } from '@nestjs/common';
import { CreatorsService } from './creators.service';

@Controller('api/creators')
export class CreatorsController {
  constructor(private readonly creatorsService: CreatorsService) {}

  @Get()
  async listCreators(@Query('page') page?: number, @Query('limit') limit?: number) {
    void page;
    void limit;
    const { items, total } = await this.creatorsService.listForBrowse();
    return {
      success: true,
      items,
      total,
    };
  }

  @Get(':id')
  async getCreator(@Param('id') id: string) {
    const creator = await this.creatorsService.getByIdOrSlug(id);
    return {
      success: true,
      creator,
    };
  }
}
