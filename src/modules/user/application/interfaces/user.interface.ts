import { TUserResponse } from '../../infrastructure/interfaces';
import { CreateUserDto } from '../dto/user.dto';

export interface UserServiceInterface {
  create(createUserDto: CreateUserDto): Promise<TUserResponse>;
  getByEmail(email: string): Promise<TUserResponse | null>;
  validateUserAuth(email: string, password: string): Promise<TUserResponse | null>;
}
