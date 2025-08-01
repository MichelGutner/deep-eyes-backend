import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TUserCreateInput, TUserResponse, UserRepository } from '../interfaces';
import { PRISMA_SERVICE, PrismaService } from '@/modules/prisma';

@Injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly ormService: PrismaService,
  ) {}
  async findByEmail(email: string): Promise<TUserResponse | null> {
    const user = await this.ormService.user.findUnique({
      where: { email },
    });

    if (!user) return null;

    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  async create(user: TUserCreateInput) {
    const createdUser = await this.ormService.user.create({
      data: user,
    });
    const { password_hash, ...userWithoutPassword } = createdUser;
    return userWithoutPassword;
  }
  update: (id: string, userData: any) => Promise<TUserResponse>;
  delete: (id: string) => Promise<TUserResponse>;
}
