import { IsString } from 'class-validator';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';

export class CheckInByQRCodeDto {
  @IsString()
  checkinCode: string;
}

export class CheckInByIdDto {
  @IsString()
  ticketId: string;
}

export class SearchTicketsDto extends PaginationQueryDto {}

export class CheckInStatsDto {
  totalTickets: number;
  checkedInTickets: number;
  notCheckedInTickets: number;
  checkInRate: number;
}

export class TicketCheckInInfo {
  id: string;
  checkinCode: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  checkedIn: boolean;
  checkedInAt: Date | null;
  ticketType: {
    name: string;
  };
  order: {
    id: string;
    status: string;
    paymentStatus: string;
  };
}

export class CheckInByCodeParamDto {
  @IsString()
  checkinCode: string;
}

//
