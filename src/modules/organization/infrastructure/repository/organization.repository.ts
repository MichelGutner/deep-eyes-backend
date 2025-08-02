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
    return this.ormService.organization.findUnique({
      where: { name },
    });
  }
  async findById(id: string): Promise<TOrganizationResponse | null> {
    return this.ormService.organization.findUnique({
      where: { id },
      include: { users: true, applications: true },
    });
  }
  async create(data: TCreateOrganizationInput) {
    return this.ormService.organization.create({
      data,
    });
  }
  update: (id: string, userData: any) => Promise<TOrganizationResponse>;
  delete: (id: string) => Promise<TOrganizationResponse>;
}
