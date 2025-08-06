import {
  CreateUserDto,
  USER_SERVICE,
  UserServiceInterface,
} from '@/modules/user';
import {
  BadRequestException,
  Body,
  Controller,
  Inject,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginInputDto } from '../dtos/login.dto';
import { TokenInputDto } from '../dtos/token.dto';

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(JwtService)
    private readonly jwtService: JwtService,

    @Inject(USER_SERVICE)
    private readonly userService: UserServiceInterface,
  ) {}

  @Post('login')
  async login(@Body() body: LoginInputDto) {
    const user = await this.userService.validateUserAuth(
      body.email,
      body.password,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    const payload = this.parserUserData(user);

    const accessToken = this.jwtService.sign(payload);

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    return {
      accessToken,
      refreshToken,
      user: payload,
    };
  }

  @Post('user')
  async createUser(@Body() body: CreateUserDto) {
    try {
      const user = await this.userService.create(body);
      const payload = this.parserUserData(user);

      const accessToken = this.jwtService.sign(payload);
      const refreshToken = this.jwtService.sign(payload, {
        expiresIn: '7d',
      });

      return { accessToken, refreshToken, user: payload };
    } catch (error) {
      throw new BadRequestException(`User creation failed: ${error.message}`);
    }
  }

  @Post('verify')
  async verify(@Body() body: TokenInputDto) {
    try {
      const payload = this.jwtService.verify(body.token);
      return { valid: true, user: payload };
    } catch (error) {
      return { valid: false };
    }
  }

  @Post('refresh')
  async refresh(@Body() body: TokenInputDto) {
    try {
      const decoded = this.jwtService.verify(body.token);

      const payload = this.parserUserData(decoded);

      const accessToken = this.jwtService.sign(payload);

      return {
        accessToken,
        user: payload,
      };
    } catch (error: any) {
      throw new UnauthorizedException(`Invalid refresh token`);
    }
  }

  private parserUserData(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organizationId: user.organization_id,
      lastLogin: user.lastActive,
      status: user.status,
    };
  }
}
