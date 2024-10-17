import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ContactusService } from './contactus.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { multerOptions } from 'src/cloudinary/multer.config';

@Controller('contactus')
export class ContactusController {
  constructor(private readonly contactusService: ContactusService) {}

  @Post()
  @UseInterceptors(FileInterceptor('attachment', multerOptions))
  create(
    @Body() createContactDto: CreateContactDto,
    @UploadedFile()
    attachment?: Express.Multer.File,
  ) {
    return this.contactusService.create(createContactDto, attachment);
  }

  @Get()
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.contactusService.findAll(paginationQuery);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.contactusService.findOne(id);
  }
}
