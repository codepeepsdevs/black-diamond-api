// Check-in API Type Definitions

// Request Types
export type CheckInByQRCodeRequest = {
  checkinCode: string;
};

export type CheckInByIdRequest = {
  ticketId: string;
};

export type SearchTicketsRequest = {
  page?: number;
  limit?: number;
  search?: string;
};

export type GetCheckInStatsRequest = {
  eventId: string;
};

export type UndoCheckInRequest = {
  ticketId: string;
};

// Response Types
export type CheckInResponse = {
  message: string;
};

export type CheckInByQRCodeResponse = CheckInResponse;

export type CheckInByIdResponse = CheckInResponse;

export type TicketCheckInInfo = {
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
};

export type GetTicketsForEventResponse = {
  tickets: TicketCheckInInfo[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type CheckInStatsResponse = {
  totalTickets: number;
  checkedInTickets: number;
  notCheckedInTickets: number;
  checkInRate: number;
};

export type UndoCheckInResponse = {
  success: boolean;
  message: string;
  ticket: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    ticketType: string;
    eventName: string;
    checkedIn: boolean;
  };
};

// New: Response type for GET /checkin/ticket/code/:checkinCode
export type GetTicketByCheckinCodeResponse = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  checkedIn: boolean;
  ticketType: {
    name: string;
  };
  order: {
    status: string;
  };
};

// Error Response Type
export type CheckInErrorResponse = {
  statusCode: number;
  message: string;
  error: string;
};
