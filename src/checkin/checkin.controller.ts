import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CheckinService } from './checkin.service';
import {
  CheckInByQRCodeDto,
  CheckInByIdDto,
  SearchTicketsDto,
  CheckInByCodeParamDto,
} from './dto/checkin.dto';
import { Roles } from 'src/auth/guards/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import JwtAuthenticationGuard from 'src/auth/guards/jwt-authentication.guard';
import { UserRole } from '@prisma/client';

@Controller('checkin')
@UseGuards(JwtAuthenticationGuard, RolesGuard)
@Roles(UserRole.admin)
export class CheckinController {
  constructor(private readonly checkinService: CheckinService) {}

  @Get('ticket/code/:checkinCode')
  async getTicketByCheckinCode(@Param() params: CheckInByCodeParamDto) {
    return this.checkinService.getTicketByCheckinCode(params.checkinCode);
  }

  @Post('qr-code')
  async checkInByQRCode(@Body() dto: CheckInByQRCodeDto) {
    return this.checkinService.checkInByQRCode(dto);
  }

  @Post('ticket/:ticketId')
  async checkInById(@Param() dto: CheckInByIdDto) {
    return this.checkinService.checkInById(dto);
  }

  @Get('event/:eventId/tickets')
  async getTicketsForEvent(
    @Param('eventId') eventId: string,
    @Query() searchQuery: SearchTicketsDto,
  ) {
    return this.checkinService.getTicketsForEvent(eventId, searchQuery);
  }

  @Get('event/:eventId/stats')
  async getCheckInStats(@Param('eventId') eventId: string) {
    return this.checkinService.getCheckInStats(eventId);
  }

  @Post('undo/:ticketId')
  async undoCheckIn(@Param('ticketId') ticketId: string) {
    return this.checkinService.undoCheckIn(ticketId);
  }
}
