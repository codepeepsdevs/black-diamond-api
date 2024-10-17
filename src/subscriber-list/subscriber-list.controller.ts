import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { SubscriberListService } from './subscriber-list.service';
import {
  AddOneSubscriberToListDto,
  AddSubscriberByDetailsDto,
  ChangeSubscriberListNameDto,
  CreateSubscriberListDto,
  UpdateSubscribersListDto,
} from './dto/subscriber-list.dto';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerCSVOptions } from 'src/cloudinary/multer.config';

@Controller('subscriber-list')
export class SubscriberListController {
  constructor(private readonly subscriberListService: SubscriberListService) {}

  @Post()
  create(@Body() dto: CreateSubscriberListDto) {
    return this.subscriberListService.create(dto);
  }

  @Get()
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.subscriberListService.findAll(paginationQuery);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.subscriberListService.findOne(id);
  }

  @Patch(':listId')
  changeName(
    @Param('listId') listId: string,
    @Body() updateSubscriberListDto: ChangeSubscriberListNameDto,
  ) {
    return this.subscriberListService.changeName(
      listId,
      updateSubscriberListDto,
    );
  }

  @Post('add-subscribers/:listId')
  addSubscribers(
    @Param('listId') listId: string,
    @Body() dto: UpdateSubscribersListDto,
  ) {
    return this.subscriberListService.addSubscribers(listId, dto);
  }

  @Post('add-subscriber-details/:listId')
  addSubscriber(
    @Param('listId') listId: string,
    @Body() dto: AddOneSubscriberToListDto,
  ) {
    return this.subscriberListService.addSubscriber(listId, dto);
  }

  @Post('add-subscribers-details/:listId')
  addSubscribersByDetails(
    @Param('listId') listId: string,
    @Body() dto: AddSubscriberByDetailsDto,
  ) {
    return this.subscriberListService.addSubscribersByDetails(listId, dto);
  }

  @Post('remove-subscribers/:listId')
  removeSubscribers(
    @Param('listId') listId: string,
    @Body() dto: UpdateSubscribersListDto,
  ) {
    return this.subscriberListService.removeSubscribers(listId, dto);
  }

  @Post('add-from-csv/:listId')
  @UseInterceptors(FileInterceptor('csvFile', multerCSVOptions))
  addSubscriberFromCSV(
    @UploadedFile()
    csvFile: Express.Multer.File,
    @Param('listId') listId: string,
  ) {
    return this.subscriberListService.addSubscribersFromCSV(csvFile, listId);
  }

  // @Delete(':id')
  // remove(@Param('id') id: string) {
  //   return this.subscriberListService.remove(+id);
  // }
}
