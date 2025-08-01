import { Module, Provider } from '@nestjs/common';
import { UserService } from './services/user.service';
import { PrismaModule, PrismaService } from '@/modules/prisma';
import { UserRepositoryImpl } from '../infrastructure';

export const USER_SERVICE = 'UserService';

const userServiceProvider: Provider = {
  provide: USER_SERVICE,
  useClass: UserService,
};

const userRepositoryProvider: Provider = {
  provide: 'UserRepository',
  useClass: UserRepositoryImpl
};

@Module({
  imports: [PrismaModule],
  providers: [userServiceProvider, userRepositoryProvider],
  exports: [userServiceProvider, userRepositoryProvider],
})
export class UserModule {}
