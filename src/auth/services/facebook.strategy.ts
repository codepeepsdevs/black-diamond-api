import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-facebook';
import {
  FACEBOOK_APP_ID,
  FACEBOOK_APP_REDIRECT_URL,
  FACEBOOK_APP_SECRET,
} from 'src/constants';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get(FACEBOOK_APP_ID),
      clientSecret: configService.get(FACEBOOK_APP_SECRET),
      callbackURL: configService.get(FACEBOOK_APP_REDIRECT_URL),
      scope: 'email',
      profileFields: ['emails', 'name'],
    });
  }

  async validate(
    profile: Profile,
    done: (err: any, user: any, info?: any) => void,
  ): Promise<any> {
    const { name, emails } = profile;
    const user = {
      email: emails[0].value,
      firstname: name.givenName,
      lastname: name.familyName,
    };

    done(null, user);
  }
}
