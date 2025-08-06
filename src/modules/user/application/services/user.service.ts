import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { UserServiceInterface } from '../interfaces/user.interface';
import { TUserResponse, UserRepository } from '../../infrastructure/interfaces';
import { CreateUserDto } from '../dto/user.dto';
import { compareEncrypts, encrypt } from '@/utils/bcrypt';

@Injectable()
export class UserService implements UserServiceInterface {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository,
  ) {}

  async validateUserAuth(email: string, password: string) {
    const user = await this.userRepository.findByEmail(email);
    const validPassword = compareEncrypts(password, user?.password_hash ?? '');
    if (!user) {
      throw new BadRequestException('User not found.');
    }
    if (!validPassword) {
      throw new ConflictException('Invalid email or password.');
    }
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async getByEmail(email: string) {
    const user = await this.userRepository.findByEmail(email, {
      omit: {
        password_hash: true,
      },
    });
    if (!user) {
      throw new ConflictException('User not found.');
    }
    return user;
  }

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.userRepository.findByEmail(
      createUserDto.email,
    );

    if (existingUser) {
      throw new ConflictException('A user with this email already exists.');
    }

    const hashPassword = encrypt(createUserDto.password);

    const user = this.userRepository.create({
      email: createUserDto.email,
      password_hash: hashPassword,
      name: createUserDto.name,
      organization_id: createUserDto.organizationId,
      role: createUserDto.role,
    });
    return user;
  }
}
