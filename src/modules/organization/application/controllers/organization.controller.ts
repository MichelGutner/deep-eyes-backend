import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { ORGANIZATION_SERVICE } from '../organization.module';
import { OrganizationServiceInterface } from '../interfaces/organization.interface';
import { CreateOrganizationDto } from '../dto/organization.dto';

@Controller('organization')
export class OrganizationController {
  constructor(
    @Inject('OrganizationService')
    private readonly service: OrganizationServiceInterface,
  ) {}

  @Post()
  async createOrganization(@Body() data: CreateOrganizationDto) {
    return this.service.create(data);
  }

  @Get(':id')
  async getOrganization(@Param('id') id: string) {
    return this.service.get(id);
  }
}
