import { Module, Provider } from '@nestjs/common';
import { OrganizationService } from './services/organization.service';
import { PrismaModule } from '@/modules/prisma';
import { OrganizationRepository } from '../infrastructure';
import { OrganizationController } from './controllers/organization.controller';

export const ORGANIZATION_SERVICE = 'OrganizationService';

const organizationServiceProvider: Provider = {
  provide: 'OrganizationService',
  useClass: OrganizationService,
};

const organizationRepositoryProvider: Provider = {
  provide: 'OrganizationRepository',
  useClass: OrganizationRepository,
};

@Module({
  controllers: [OrganizationController],
  imports: [PrismaModule],
  providers: [organizationServiceProvider, organizationRepositoryProvider],
  exports: [organizationServiceProvider, organizationRepositoryProvider],
})
export class OrganizationModule {}
