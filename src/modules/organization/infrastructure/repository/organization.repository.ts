import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  TCreateOrganizationInput,
  TOrganizationResponse,
  OrganizationRepositoryInterface,
} from '../interfaces';
import { PRISMA_SERVICE, PrismaService } from '@/modules/prisma';

@Injectable()
export class OrganizationRepository implements OrganizationRepositoryInterface {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly ormService: PrismaService,
  ) {}
  async findByName(name: string): Promise<TOrganizationResponse | null> {
    const organization = await this.ormService.organization.findUnique({
      where: { name },
    });

    if (!organization) return null;
    return organization;
  }
  async findById(id: string): Promise<TOrganizationResponse | null> {
    const organization = await this.ormService.organization.findUnique({
      where: { id },
    });

    if (!organization) return null;
    return organization;
  }
  async create(data: TCreateOrganizationInput) {
    const createdOrganization = await this.ormService.organization.create({
      data,
    });
    return createdOrganization;
  }
  update: (id: string, userData: any) => Promise<TOrganizationResponse>;
  delete: (id: string) => Promise<TOrganizationResponse>;
}
