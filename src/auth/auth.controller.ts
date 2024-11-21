import {
  Body,
  Req,
  Controller,
  HttpCode,
  Post,
  UseGuards,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpStatus,
  Res,
  HttpException,
  UseFilters,
  Param,
} from '@nestjs/common';
import { AuthenticationService } from './services/auth.service.js';
import { UsersService } from 'src/users/users.service';
// import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
// import { excludePrisma } from 'src/helpers/exclude.helper';
import { OAuthExceptionFilter } from 'src/exceptions/oauth.exception';
import { CustomUnauthorizedException } from 'src/exceptions/custom-unauthorized.exception';
import { LocalAuthenticationGuard } from './guards/localAuthentication.guard.ts.js';
import RequestWithUser from './types/requestWithUser.interface.js';
// import JwtAuthenticationGuard from './guards/jwt-authentication.guard.js';
// import JwtRefreshGuard from './guards/jwt-refreshtoken.guard.js';
// import { OauthUser } from './types/oauthUser.js';
// import { GoogleOAuthGuard } from './guards/google-oauth-guard.js';
import {
  FRONTEND_URL,
  // FRONTEND_URL,
  JWT_ACCESS_TOKEN_EXPIRATION_TIME,
  JWT_ACCESS_TOKEN_SECRET,
} from '../constants.js';
import { JwtService } from '@nestjs/jwt';
import { EmailsService } from '../emails/emails.service.js';
import {
  CompleteSignupDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailBody,
} from './dto/auth.dto.js';
import { TokenPayload } from './types/tokenPayload.interface.js';
import { PrismaService } from 'src/prisma.service';
import { GoogleAuthGuard } from './guards/google-oauth-guard.js';

@UseInterceptors(ClassSerializerInterceptor)
@Controller('auth')
export class AuthenticationController {
  constructor(
    private readonly authenticationService: AuthenticationService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('signup')
  async signup(@Body() dto: CreateUserDto) {
    const user = await this.authenticationService.signup(dto);
    return user;
  }

  @Post('complete-signup')
  async completeSignup(@Body() dto: CompleteSignupDto) {
    const user = await this.authenticationService.completeSignup(dto);
    return user;
  }

  @HttpCode(200)
  @UseGuards(LocalAuthenticationGuard)
  @Post('login')
  async login(@Req() request: RequestWithUser) {
    const { user } = request;

    const payload: TokenPayload = { userId: user.id };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME),
      secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
    });

    // TODO: Work on automatically excluding all user's credentials from database while fetching..
    return { ...user, accessToken };
  }

  // @UseGuards(JwtAuthenticationGuard)
  // @Post('logout')
  // @HttpCode(200)
  // async logOut(@Req() request: RequestWithUser) {
  //   const auth = await this.prisma.auth.findFirst({
  //     where: {
  //       userId: request.user.id,
  //     },
  //   });

  //   if (!auth) {
  //     return { message: 'User is logged out' };
  //   }

  //   return { message: 'Logout successful' };
  // }

  // @UseGuards(JwtAuthenticationGuard)
  // @Get()
  // authenticate(@Req() request: RequestWithUser) {
  //   const user = request.user;
  //   const rest = excludePrisma(user, [
  //     'password',
  //     'confirmToken',
  //     'refreshToken',
  //     'resetToken',
  //   ]);
  //   return rest;
  // }

  // @UseGuards(JwtRefreshGuard)
  // @Get('refresh')
  // refresh(@Req() request: RequestWithUser) {
  //   const accessTokenCookie =
  //     this.authenticationService.getCookieWithJwtAccessToken(request.user.id);

  //   request.res.setHeader('Set-Cookie', accessTokenCookie);
  //   const user = request.user;
  //   const rest = excludePrisma(user, [
  //     'password',
  //     'confirmToken',
  //     'refreshToken',
  //     'resetToken',
  //   ]);
  //   return rest;
  // }

  // @UseFilters(OAuthExceptionFilter)
  // @Get('/facebook')
  // @UseGuards(AuthGuard('facebook'))
  // async facebookLogin(@Res() res): Promise<any> {
  //   try {
  //     return res.status(HttpStatus.OK).send();
  //   } catch (error) {
  //     if (error instanceof CustomUnauthorizedException) {
  //       throw error; // This will be caught by the OAuthExceptionFilter
  //     } else {
  //       throw new HttpException(
  //         'An error occurred',
  //         HttpStatus.INTERNAL_SERVER_ERROR,
  //       );
  //     }
  //   }
  // }

  // @UseFilters(OAuthExceptionFilter)
  // @Get('/facebook/redirect')
  // @UseGuards(AuthGuard('facebook'))
  // async facebookLoginRedirect(
  //   @Req() request: RequestWithUser,
  //   @Res() response,
  // ): Promise<any> {
  //   try {
  //     const frontend_url = this.configService.get(FRONTEND_URL);
  //     const data: OauthUser = request.user;
  //     const { accessTokenCookie, refreshTokenCookie } =
  //       await this.authenticationService.facebookAuthentication(data);
  //     request.res.setHeader('Set-Cookie', [
  //       accessTokenCookie,
  //       refreshTokenCookie,
  //     ]);

  //     response.redirect(`${frontend_url}/oauth-success-redirect`);
  //   } catch (error) {
  //     if (error instanceof CustomUnauthorizedException) {
  //       throw error; // This will be caught by the OAuthExceptionFilter
  //     } else {
  //       throw new HttpException(
  //         'An error occurred',
  //         HttpStatus.INTERNAL_SERVER_ERROR,
  //       );
  //     }
  //   }
  // }

  @UseFilters(OAuthExceptionFilter)
  @Get('/google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Res() res): Promise<any> {
    try {
      return res.status(HttpStatus.OK).send();
    } catch (error) {
      if (error instanceof CustomUnauthorizedException) {
        throw error; // This will be caught by the OAuthExceptionFilter
      } else {
        throw new HttpException(
          'An error occurred',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('/google/redirect')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() request: RequestWithUser): Promise<any> {
    const frontendUrl = this.configService.get(FRONTEND_URL);
    try {
      const user = await this.authenticationService.googleAuthentication(
        request.user,
      );

      const payload: TokenPayload = { userId: user.id };
      const accessToken = this.jwtService.sign(payload, {
        secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
        expiresIn: this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME),
      });

      return request.res.redirect(
        `${frontendUrl}/oauth-success-redirect?accessToken=${accessToken}`,
      );
    } catch (error) {
      const errorMessage = error.message || 'An error occurred';
      return request.res.redirect(
        `${frontendUrl}/oauth-failed-redirect?errorMessage=${encodeURIComponent(errorMessage)}`,
      );
    }
  }

  // @UseFilters(OAuthExceptionFilter)
  // @Get('/google/redirect')
  // @UseGuards(GoogleAuthGuard)
  // async googleAuthRedirect(
  //   @Req() request: RequestWithUser,
  //   // @Res({ passthrough: true }) response: Response,
  // ): Promise<any> {
  //   try {
  //     const frontendUrl = this.configService.get(FRONTEND_URL);

  //     const user = await this.authenticationService.googleAuthentication(
  //       request.user,
  //     );

  //     const payload: TokenPayload = { userId: user.id };
  //     const accessToken = this.jwtService.sign(payload, {
  //       secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
  //       expiresIn: this.configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME),
  //     });

  //     // return {
  //     //   accessToken,
  //     // };
  //     request.res.redirect(
  //       `${frontendUrl}/oauth-success-redirect?accessToken=${accessToken}`,
  //     );
  //   } catch (error) {
  //     console.log(error);
  //     if (error instanceof CustomUnauthorizedException) {
  //       throw error; // This will be caught by the OAuthExceptionFilter
  //     } else {
  //       throw new HttpException(
  //         'An error occurred',
  //         HttpStatus.INTERNAL_SERVER_ERROR,
  //       );
  //     }
  //   }
  // }

  @Get('resend-verification-email/')
  async sendVerificationEmail(@Body('email') dto: VerifyEmailBody) {
    return this.authenticationService.sendVerificationEmail(dto.email);
  }

  @Get('confirm-email/:token')
  async confirmEmail(@Param('token') token: string) {
    return this.authenticationService.confirmEmail(token);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authenticationService.forgotPassword(dto.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authenticationService.resetPassword(dto);
  }
}

