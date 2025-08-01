import { Body, Controller, Inject, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Controller('auth')
export class AuthController {
  constructor(@Inject(JwtService) private readonly jwtService: JwtService) {}

  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    if (body.username !== 'admin' || body.password !== 'password')
      return {
        error: 'Invalid credentials',
        message: 'Username or password is incorrect',
      };
    const payload = { sub: 1, username: body.username, roles: ['admin'] };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        username: payload.username,
        roles: payload.roles,
      },
    };
  }

  @Post('signup')
  async signup(@Body() body: { username: string; password: string }) {
    // In a real application, you would save the user to the database here
    const payload = { sub: 1, username: body.username, roles: ['user'] };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: payload.sub,
        username: payload.username,
        roles: payload.roles,
      },
    };
  }

  @Post('verify')
  async verify(@Body() body: { token: string }) {
    try {
      const payload = this.jwtService.verify(body.token);
      return { valid: true, user: payload };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  @Post('refresh')
  async refresh(@Body() body: { token: string }) {
    try {
      const decoded = this.jwtService.verify(body.token, {
        secret: process.env.JWT_SECRET || 'defaultSecret',
      });
      const newPayload = {
        sub: decoded.sub,
        username: decoded.username,
        roles: decoded.roles,
      };
      return {
        access_token: this.jwtService.sign(newPayload),
        user: {
          id: newPayload.sub,
          username: newPayload.username,
          roles: newPayload.roles,
        },
      };
    } catch (error: any) {
      throw new Error(`Invalid token: ${error.message}`);
    }
  }
}
