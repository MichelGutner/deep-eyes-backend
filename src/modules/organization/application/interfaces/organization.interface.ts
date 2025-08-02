import { TOrganizationResponse } from '../../infrastructure/interfaces';
import { CreateOrganizationDto } from '../dto/organization.dto';

export interface OrganizationServiceInterface {
  create(dto: CreateOrganizationDto): Promise<TOrganizationResponse>;
  get(id: string): Promise<TOrganizationResponse>;
}
