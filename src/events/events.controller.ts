import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { Roles } from 'src/auth/guards/roles.decorator';
import {
  CopyEventDto,
  CreateEventAddonDto,
  CreateEventDetailsDto,
  CreateEventPromoCode,
  CreateEventTicketTypeDto,
  GetPromocodeDto,
  RemoveImageDto,
  UpdateEventDto,
  UpdatePromocodeDto,
  UpdatEventTicketTypeDto,
} from './dto/events.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { EventStatusPaginationQueryDto as EventsPaginationQueryDto } from './dto/events.dto';
import JwtAuthenticationGuard from 'src/auth/guards/jwt-authentication.guard';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';
import { multerOptions } from 'src/cloudinary/multer.config';
import { UserRole } from '@prisma/client';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Post('create-event-details')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'coverImage',
          maxCount: 1,
        },
        {
          name: 'images',
          maxCount: 10,
        },
      ],
      multerOptions,
    ),
  )
  async createEvent(
    @UploadedFiles()
    files: {
      coverImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Body() dto: CreateEventDetailsDto,
  ) {
    return this.eventsService.createEventDetails(
      dto,
      files.coverImage,
      files.images,
    );
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Post('create-event-ticket-type')
  async createEventTicketType(@Body() dto: CreateEventTicketTypeDto) {
    return this.eventsService.createEventTicketType(dto);
  }

  @UseGuards(JwtAuthenticationGuard)
  @Roles('admin')
  @Post('create-event-promocode/:eventId')
  async createEventPromoCode(
    @Param('eventId') eventId: string,
    @Body() dto: CreateEventPromoCode,
  ) {
    return this.eventsService.createEventPromoCode(eventId, dto);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Post('create-event-addon')
  @UseInterceptors(FileInterceptor('image', multerOptions))
  async createEventAddon(
    @UploadedFile()
    image: Express.Multer.File,
    @Body() dto: CreateEventAddonDto,
  ) {
    return this.eventsService.createEventAddon(dto, image);
  }

  @Get('get-event/:eventId')
  async getEvent(@Param('eventId') eventId: string) {
    return this.eventsService.getEvent(eventId);
  }

  @Get('admin-get-event/:eventId')
  async adminGetEvent(@Param('eventId') eventId: string) {
    return this.eventsService.adminGetEvent(eventId);
  }

  @Post('apply-promocode/')
  async getPromocode(@Body() dto: GetPromocodeDto) {
    return this.eventsService.getPromocode(dto);
  }

  @Get('get-events')
  async getEvents(@Query() paginationQuery: EventsPaginationQueryDto) {
    return this.eventsService.getEvents(paginationQuery);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('admin-get-events')
  async adminGetEvents(@Query() paginationQuery: EventsPaginationQueryDto) {
    return this.eventsService.adminGetEvents(paginationQuery);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get(':eventId/get-ticket-types')
  async getEventTicketTypes(@Param('eventId') eventId: string) {
    return this.eventsService.getEventTicketTypes(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get(':eventId/get-promocodes')
  async getEventPromocodes(@Param('eventId') eventId: string) {
    return this.eventsService.getEventPromocodes(eventId);
  }

  @Get(':eventId/get-addons')
  async getAddons(@Param('eventId') eventId: string) {
    return this.eventsService.getAddons(eventId);
  }

  @Get('upcoming-events')
  async getUpcomingEvents(@Query() paginationQuery: PaginationQueryDto) {
    return this.eventsService.getUpcomingEvents(paginationQuery);
  }

  @Get('past-events')
  async getPastEvents(@Query() paginationQuery: PaginationQueryDto) {
    return this.eventsService.getPastEvents(paginationQuery);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Post('copy-event/:eventId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'coverImage',
          maxCount: 1,
        },
        {
          name: 'images',
          maxCount: 10,
        },
      ],
      multerOptions,
    ),
  )
  async copyEvent(
    @Param('eventId') eventId: string,
    @Body() dto: CopyEventDto,
  ) {
    return this.eventsService.copyEvent(eventId, dto);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Put('update-event/:eventId')
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        {
          name: 'coverImage',
          maxCount: 1,
        },
        {
          name: 'images',
          maxCount: 10,
        },
      ],
      multerOptions,
    ),
  )
  async updateEvent(
    @UploadedFiles()
    files: {
      coverImage?: Express.Multer.File[];
      images?: Express.Multer.File[];
    },
    @Param('eventId') eventId: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventsService.updateEvent(
      eventId,
      dto,
      files.coverImage,
      files.images,
    );
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Put('ticket-type/:ticketTypeId')
  async updateTicketType(
    @Param('ticketTypeId') ticketTypeId: string,
    @Body() dto: UpdatEventTicketTypeDto,
  ) {
    return this.eventsService.updateTicketType(ticketTypeId, dto);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Put('promocode/:promocodeId')
  async updatePromocode(
    @Param('promocodeId') promocodeId: string,
    @Body() dto: UpdatePromocodeDto,
  ) {
    return this.eventsService.updatePromocode(promocodeId, dto);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('get-revenue/:eventId')
  async getRevenue(@Param('eventId') eventId: string) {
    return this.eventsService.getRevenue(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('inc-pageview/:eventId')
  async incPageView(@Param('eventId') eventId: string) {
    return this.eventsService.incPageView({ eventId });
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('view-count/:eventId')
  async viewCount(@Param('eventId') eventId: string) {
    return this.eventsService.viewCount({ eventId });
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Put('publish-event/:eventId')
  async publishEvent(@Param('eventId') eventId: string) {
    return this.eventsService.publishEvent(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Put('unpublish-event/:eventId')
  async unpublishEvent(@Param('eventId') eventId: string) {
    return this.eventsService.unpublishEvent(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Delete('remove-image/:eventId')
  async removeImageFromSlide(
    @Param('eventId') eventId: string,
    @Body() dto: RemoveImageDto,
  ) {
    return this.eventsService.removeImageFromSlide(eventId, dto.image);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Delete('delete-event/:eventId')
  async deleteEvent(@Param('eventId') eventId: string) {
    return this.eventsService.deleteEvent(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Delete('ticket-type/:ticketTypeId')
  async deleteTicketType(@Param('ticketTypeId') ticketTypeId: string) {
    return this.eventsService.deleteTicketType(ticketTypeId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles('admin')
  @Delete('promocode/:promocodeId')
  async deletePromocode(@Param('promocodeId') promocodeId: string) {
    return this.eventsService.deletePromocode(promocodeId);
  }
}
