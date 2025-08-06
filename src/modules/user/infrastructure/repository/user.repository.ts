import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TUserCreateInput, TUserResponse, UserRepository } from '../interfaces';
import { PRISMA_SERVICE, PrismaService } from '@/modules/prisma';

@Injectable()
export class UserRepositoryImpl implements UserRepository {
  constructor(
    @Inject(PRISMA_SERVICE) private readonly ormService: PrismaService,
  ) {}
  async findByEmail(
    email: string,
    options?: {
      omit?: {
        password_hash?: boolean;
      };
    },
  ): Promise<TUserResponse | null> {
    return this.ormService.user.findUnique({
      where: { email },
      ...options,
      include: {
        organization: true,
      },
    });
  }
  async create(data: TUserCreateInput) {
    return this.ormService.user.create({
      data,
      include: { organization: true },
      omit: {
        password_hash: true,
      },
    });
  }
  update: (id: string, userData: any) => Promise<TUserResponse>;
  delete: (id: string) => Promise<TUserResponse>;
}
