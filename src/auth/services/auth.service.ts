import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma.service';

import { UsersService } from 'src/users/users.service';
import {
  CompleeteSignupPayload,
  TokenPayload,
} from '../types/tokenPayload.interface';
import { CreateUserDto } from 'src/users/dto/create-user.dto';

import { excludePrisma } from 'src/helpers/exclude.helper';
import { CompleteSignupDto, ResetPasswordDto } from '../dto/auth.dto';
import { EmailsService } from 'src/emails/emails.service';
import {
  EMAIL_EXPIRY_TIME,
  FRONTEND_URL,
  JWT_ACCESS_TOKEN_SECRET,
  JWT_EMAIL_SECRET,
} from 'src/constants';
import { CustomUnauthorizedException } from 'src/exceptions/custom-unauthorized.exception';
import { OauthUser } from '../types/oauthUser';

@Injectable()
export class AuthenticationService {
  constructor(
    private prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly emailsService: EmailsService,
  ) {}

  public async signup(dto: CreateUserDto) {
    const user = await this.usersService.findOneByEmail(dto.email);

    if (user) {
      throw new HttpException(
        'User with that email already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firstname: dto.firstname,
          lastname: dto.lastname,
          password: hashedPassword,
          authMethod: 'EMAIL',
          // Create related Address and BillingInfo with just their IDs
          address: {
            create: {},
          },
          billingInfo: {
            create: {},
          },
        },
        include: {
          address: true,
          billingInfo: true,
        },
      });

      this.sendVerificationEmail(user.email);
      user.password = undefined;
      return user;
    } catch (error) {
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async completeSignup(dto: CompleteSignupDto) {
    let payload: CompleeteSignupPayload = null;
    try {
      payload = await this.jwtService.verifyAsync<CompleeteSignupPayload>(
        dto.token,
        {
          secret: this.configService.get(JWT_EMAIL_SECRET),
        },
      );
    } catch (e) {
      throw new BadRequestException(
        'The link is invalid or has expired, please login to request for a new link',
      );
    }
    const userExists = await this.usersService.findOneByEmail(payload.email);

    if (!userExists) {
      throw new HttpException(
        'User with that email does not exist',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    if (userExists.emailConfirmed) {
      throw new ForbiddenException(
        'Password for the user has already been set',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.update({
        where: {
          email: payload.email,
        },
        data: {
          email: payload.email,
          firstname: dto.firstname,
          lastname: dto.lastname,
          password: hashedPassword,
          authMethod: 'EMAIL',
          emailConfirmed: true,
          // Create related Address and BillingInfo with just their IDs
          address: {
            create: {},
          },
          billingInfo: {
            create: {},
          },
        },
        include: {
          address: true,
          billingInfo: true,
        },
      });

      // the client should call the email verification endpoint seperately
      // this.sendVerificationEmail(user.id);
      user.password = undefined;
      return user;
    } catch (error) {
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  public async login(email: string, plainTextPassword: string) {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isDefaultPassword = await bcrypt.compare(
      'DEFAULT_PASSWORD',
      user.password,
    );
    // if a user account was created from placing an order and password has not been set
    // i.e emailConfirmed is false and authentication method is email and the password is default_password,
    // then tell the user to set their password using the email previously sent or send another
    if (
      !user.emailConfirmed &&
      user.authMethod === 'EMAIL' &&
      isDefaultPassword
    ) {
      await this.sendCompleteSignupLink(user.email);
      throw new ForbiddenException('complete signup');
    }

    try {
      await this.verifyPassword(plainTextPassword, user.password);
    } catch (error) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }

    // If a user account was created normally, i.e not from placing an order and email has not been confirmed, send confirmation email
    if (!user.emailConfirmed) {
      this.sendVerificationEmail(email);

      throw new HttpException('email not verified', HttpStatus.FORBIDDEN);
    }

    if (user.authMethod !== 'EMAIL') {
      throw new UnauthorizedException('Invalid login method');
    }
    try {
      await this.verifyPassword(plainTextPassword, user.password);

      const rest = excludePrisma(user, [
        'password',
        'authMethod',
        'resetToken',
        'resetTokenExpiry',
        'refreshToken',
        'confirmToken',
      ]);
      return { ...rest };
    } catch (error) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // async facebookAuthentication(userData: OauthUser) {
  //   const { email } = userData;

  //   const user = await this.usersService.findOneByEmail(email);

  //   if (user) {
  //     if (!(user.authMethod === 'FACEBOOK')) {
  //       throw new CustomUnauthorizedException('Facebook');
  //     }
  //     return this.handleRegisteredUser(user);
  //   } else {
  //     const user = await this.createWithFacebook(userData);
  //     return this.handleRegisteredUser(user);
  //   }
  // }

  async googleAuthentication(userData: OauthUser) {
    const { email } = userData;

    const user = await this.usersService.findOneByEmail(email);

    if (user) {
      if (!(user.authMethod === 'GOOGLE')) {
        throw new CustomUnauthorizedException('Google');
      }
      return user;
    } else {
      const user = await this.createWithGoogle(userData);
      return user;
    }
  }

  async createWithGoogle(userData: OauthUser) {
    const { firstname, lastname, email } = userData;
    try {
      const createdUser = await this.prisma.user.create({
        data: {
          firstname,
          lastname,
          email,
          password: 'DEFAULT_PASSWORD',
          emailConfirmed: true,
          authMethod: 'GOOGLE',
        },
        select: {
          id: true,
          firstname: true,
          lastname: true,
          email: true,
          role: true,
          emailConfirmed: true,
        },
      });

      return createdUser;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // async createWithFacebook(userData: OauthUser) {
  //   const { firstname, lastname, email } = userData;
  //   try {
  //     const createdUser = await this.prisma.user.create({
  //       data: {
  //         firstname,
  //         lastname,
  //         email,
  //         password: 'DEFAULT_PASSWORD',
  //         emailConfirmed: true,
  //         authMethod: 'FACEBOOK',
  //       },
  //       select: {
  //         id: true,
  //         firstname: true,
  //         lastname: true,
  //         email: true,
  //         role: true,
  //         emailConfirmed: true,
  //       },
  //     });

  //     return createdUser;
  //   } catch (error) {
  //     console.log(error);
  //     throw new HttpException(
  //       'Something went wrong',
  //       HttpStatus.INTERNAL_SERVER_ERROR,
  //     );
  //   }
  // }

  // async handleRegisteredUser(user: Partial<User>) {
  //   const accessTokenCookie = this.getCookieWithJwtAccessToken(user.id);

  //   const { cookie: refreshTokenCookie, token: refreshToken } =
  //     this.getCookieWithJwtRefreshToken(user.id);

  //   await this.usersService.setCurrentRefreshToken(refreshToken, user.id);

  //   return {
  //     user,
  //     accessTokenCookie,
  //     refreshTokenCookie,
  //   };
  // }

  private async verifyPassword(
    plainTextPassword: string,
    hashedPassword: string,
  ) {
    const isPasswordMatching = await bcrypt.compare(
      plainTextPassword,
      hashedPassword,
    );
    if (!isPasswordMatching) {
      throw new HttpException(
        'Wrong credentials provided',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  // public getCookieWithJwtToken(userId: User['id']) {
  //   const payload: TokenPayload = { userId };
  //   const token = this.jwtService.sign(payload);
  //   return `Authentication=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME)}`;
  // }

  // public getCookieForLogOut() {
  //   return `Authentication=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
  // }

  // public getCookieWithJwtAccessToken(userId: User['id']) {
  //   const payload: TokenPayload = { userId };
  //   const token = this.jwtService.sign(payload, {
  //     secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
  //     expiresIn: `${this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME)}s`,
  //   });
  //   return `Authentication=${token}; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=${this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME)}`;
  // }

  // public getCookieWithJwtRefreshToken(userId: User['id']) {
  //   const payload: TokenPayload = { userId };
  //   const token = this.jwtService.sign(payload, {
  //     secret: this.configService.get(JWT_REFRESH_TOKEN_SECRET),
  //     expiresIn: `${this.configService.get(JWT_REFRESH_TOKEN_EXPIRATION_TIME)}s`,
  //   });
  //   const cookie = `Refresh=${token}; HttpOnly; Path=/; Secure; SameSite=None; Max-Age=${this.configService.get(JWT_REFRESH_TOKEN_EXPIRATION_TIME)}`;
  //   return {
  //     cookie,
  //     token,
  //   };
  // }

  // async usersId(@Req() req: Request): Promise<User['id']> {
  //   const token = req.cookies['Authentication'];

  //   const data = await this.jwtService.verifyAsync<TokenPayload>(token, {
  //     secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
  //   });

  //   return data['userId'];
  // }

  // public getCookiesForLogOut() {
  //   return [
  //     'Authentication=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
  //     'Refresh=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0',
  //   ];
  // }

  async confirmEmail(token: string) {
    let data: TokenPayload;
    try {
      data = await this.jwtService.verifyAsync<TokenPayload>(token, {
        secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
      });
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        throw new HttpException(
          'Email verification link has expired, please resend',
          HttpStatus.FORBIDDEN,
        );
      } else {
        throw e;
      }
    }
    const user = await this.usersService.findOneById(data.userId);
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: {
        id: data.userId,
      },
      data: {
        emailConfirmed: true,
      },
    });

    return { message: 'Email successfully confirmed' };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email },
    });

    if (!user) {
      throw new BadRequestException('User with this email does not exist');
    }

    // Generate a unique reset token
    const resetToken = this.jwtService.sign(
      { email: user.email },

      {
        expiresIn: this.configService.get(EMAIL_EXPIRY_TIME), // Token expires in 15 minutes
        secret: this.configService.get<string>(JWT_ACCESS_TOKEN_SECRET),
      },
    );

    // Store the token and its expiry in the user record
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: resetToken,
        resetTokenExpiry: new Date(Date.now() + 600000), // Token expires in 10 minutes (600,000 ms)
      },
    });

    // console.log({ resetToken });

    const link = `${this.configService.get<string>('FRONTEND_URL')}/change-password/${resetToken}`;

    // Here you would send the token to the user via email
    // e.g., sendEmail(user.email, resetToken);

    await this.emailsService.sendResetLink(user, user.email, link);
    // this.emailsService.sendDynamic(
    //   user.email,
    //   {
    //     title: 'Forgot Password Request BlackDiamond',
    //     firstName: user.firstname,
    //     resetLink: link,
    //   },
    //   'auth/forgotPassword.ejs',
    //   `BlackDiamond Otp!`,
    // );

    return { message: 'Password reset link sent to your email' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Decode the reset token to get the email
    let email: string;
    try {
      const decoded = this.jwtService.verify(dto.resetToken, {
        secret: this.configService.get<string>(JWT_ACCESS_TOKEN_SECRET),
      }) as {
        email: string;
      };
      email = decoded.email;
    } catch (error) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.prisma.user.findUnique({
      where: { email: email },
    });

    if (
      !user ||
      user.resetToken !== dto.resetToken ||
      user.resetTokenExpiry < new Date()
    ) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { email: email },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password successfully reset' };
  }

  async sendVerificationEmail(email: string) {
    const user = await this.usersService.findOneByEmail(email);

    if (!user) {
      throw new NotFoundException('User to verify not found');
    }

    if (user.authMethod !== 'EMAIL') {
      throw new HttpException(
        'This action is not allowed for this user',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.emailConfirmed) {
      const payload: TokenPayload = { userId: user.id };
      const token = this.jwtService.sign(payload, {
        expiresIn: this.configService.get<string>(EMAIL_EXPIRY_TIME), // 10 minutes = 60s * 10
        secret: this.configService.get<string>(JWT_ACCESS_TOKEN_SECRET),
      });

      await this.emailsService.sendVerificationEmail(user, token);

      // const link = `${this.configService.get<string>('FRONTEND_URL')}/verify-email/${token}`;

      // // the client should call the email verification endpoint seperately
      // this.emailsService.sendDynamic(
      //   user.email,
      //   {
      //     title: 'Verify your Email Address on BlackDiamond',
      //     firstName: user.firstname,
      //     link,
      //   },
      //   'auth/otpSent.ejs',
      //   `BlackDiamond Otp!`,
      // );
      return { message: 'Verification email sent successfully' };
    }

    return;
  }

  async sendCompleteSignupLink(email: string) {
    const payload: CompleeteSignupPayload = {
      email: email,
    };
    const emailToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get(JWT_EMAIL_SECRET),
      expiresIn: '2h', // Complete signup link expires in 2 hours
    });
    const completeSignupLink = `${this.configService.get(FRONTEND_URL)}/complete-signup?token=${emailToken}`;
    await this.emailsService.sendCompleteSignup(email, completeSignupLink);
  }

  // generate otp
  async generateOTP(length: number): Promise<string> {
    const characters = '0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters.charAt(randomIndex);
    }

    return result;
  }
}
