import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GOOGLE_APP_REDIRECT_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from 'src/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly user: UsersService,
  ) {
    super({
      clientID: configService.get(GOOGLE_CLIENT_ID),
      clientSecret: configService.get(GOOGLE_CLIENT_SECRET),
      callbackURL: configService.get(GOOGLE_APP_REDIRECT_URL),
      scope: ['email', 'profile'],
    });
  }
  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails } = profile;
    const user = {
      email: emails[0].value,
      firstname: name.givenName,
      lastname: name.familyName,
    };

    // const userExists = await this.user.findOneByEmail(user.email);
    // if (!userExists) {
    //   try {
    //     const createdUser = await this.prisma.user.create({
    //       data: {
    //         firstname: user.firstname,
    //         lastname: user.lastname,
    //         email: user.email,
    //         password: 'DEFAULT_PASSWORD',
    //         emailConfirmed: true,
    //         authMethod: 'GOOGLE',
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

    //     done(null, { createdUser, accessToken });
    //   } catch (e) {
    //     console.log(e);
    //     throw new InternalServerErrorException(
    //       'Error occurred while creating account..',
    //     );
    //   }
    // } else {
    //   if (userExists.authMethod !== 'GOOGLE') {
    //     throw new UnauthorizedException('User not authenticated using google');
    //   }
    // }
    done(null, user);
  }
}
