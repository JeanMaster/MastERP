import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  /**
   * Validates a user's credentials.
   * @param username The username of the user.
   * @param pass The plain text password.
   * @returns The user record (excluding password) if valid, null otherwise.
   */
  async validateUser(username: string, pass: string): Promise<any> {
    const user = await this.usersService.findByUsername(username);
    // Add safe check if user is not found or inactive
    if (user && user.isActive) {
      const isMatch = await bcrypt.compare(pass, user.password);
      if (isMatch) {
        const { password, ...result } = user;
        return result;
      }
    }
    return null;
  }

  /**
   * Generates a JWT token for a validated user.
   * @param user The validated user object.
   * @returns The access token and user basic info.
   */
  async login(user: any) {
    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      permissions: user.permissions,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    };
  }
}

