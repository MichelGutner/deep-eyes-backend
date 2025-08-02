import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrganizationServiceInterface } from '../interfaces/organization.interface';
import { OrganizationRepositoryInterface } from '../../infrastructure/interfaces';
import { CreateOrganizationDto } from '../dto/organization.dto';

@Injectable()
export class OrganizationService implements OrganizationServiceInterface {
  constructor(
    @Inject('OrganizationRepository')
    private readonly orgRepository: OrganizationRepositoryInterface,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const existsOrg = await this.orgRepository.findByName(dto.name);

    if (existsOrg) {
      throw new ConflictException('A user with this email already exists.');
    }

    const createdOrganization = this.orgRepository.create(dto);
    return createdOrganization;
  }

  async get(id: string) {
    const organization = await this.orgRepository.findById(id);
    if (!organization) {
      throw new NotFoundException('Organization not found.');
    }
    return organization;
  }
}
