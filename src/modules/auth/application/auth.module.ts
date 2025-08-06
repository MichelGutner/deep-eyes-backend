import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserService, UserModule } from '@/modules/user';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'defaultSecret',
      signOptions: { expiresIn: process.env.JWT_EXPIRATION || '1h' },
    }),
    UserModule,
  ],
  controllers: [AuthController],
  providers: [JwtStrategy, JwtAuthGuard, UserService],
  exports: [JwtModule, JwtAuthGuard],
})
export class AuthModule {}
