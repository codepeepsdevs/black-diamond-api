import { Controller, Get, Param } from '@nestjs/common';
import { EmailsService } from './emails.service';

@Controller('emails')
export class EmailsController {
  constructor(private readonly emailService: EmailsService) {}

  @Get(':email')
  async sendEmail(@Param('email') email: string) {
    return await this.emailService.sendDynamic(
      email,
      {},
      'site_visit/siteVisitDetailsEdited.ejs',
      'siteVisitDetailsEdited (BlackDiamond)',
    );
  }
}

