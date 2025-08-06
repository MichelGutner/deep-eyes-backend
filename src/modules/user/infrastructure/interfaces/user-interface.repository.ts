import { User } from '@prisma/client';

export type UserRepository = {
  findByEmail: (
    email: string,
    options?: {
      omit?: {
        password_hash?: boolean;
      };
    },
  ) => Promise<TUserResponse | null>;
  create: (newUser: TUserCreateInput) => Promise<TUserResponse>;
  update: (id: string, userData: any) => Promise<TUserResponse>;
  delete: (id: string) => Promise<TUserResponse>;
};

export type TUserResponse = Partial<User>;
export type TUserCreateInput = Omit<
  User,
  'id' | 'created_at' | 'updated_at' | 'status' | 'lastActive'
>;
