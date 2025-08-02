import { Organization } from '@prisma/client';

export interface OrganizationRepositoryInterface {
  findByName: (name: string) => Promise<Organization | null>;
  findById: (id: string) => Promise<Organization | null>;
  create: (newOrganization: TCreateOrganizationInput) => Promise<Organization>;
  update: (id: string, userData: any) => Promise<Organization>;
}

export type TOrganizationResponse = Organization;
export type TCreateOrganizationInput = Omit<
  Organization,
  'id' | 'created_at' | 'updated_at'
>;
