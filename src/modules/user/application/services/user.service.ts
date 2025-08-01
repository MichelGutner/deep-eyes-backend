import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { UserServiceInterface } from '../interfaces/user.interface';
import { UserRepository } from '../../infrastructure/interfaces';
import { CreateUserDto } from '../dto/user.dto';
import { encrypt } from '@/utils/bcrypt';

@Injectable()
export class UserService implements UserServiceInterface {
  constructor(
    @Inject('UserRepository')
    private readonly userRepository: UserRepository
  ) {}

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
