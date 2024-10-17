import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from 'src/auth/guards/roles.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUserInfoDto } from './dto/update.user.dto';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import JwtAuthenticationGuard from 'src/auth/guards/jwt-authentication.guard';
import RequestWithUser from 'src/auth/types/requestWithUser.interface';
import { GetUsersStatsDto } from './dto/users.dto';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';

@UseGuards(JwtAuthenticationGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles()
  @Get('get-user')
  async getUser(@Request() req: RequestWithUser) {
    return this.usersService.getUser(req.user.id);
  }

  @Roles('admin')
  @Get('get-users')
  async getUsers(@Query() paginationQuery: PaginationQueryDto) {
    return this.usersService.getUsers(paginationQuery);
  }

  @Roles('admin')
  @Get('users-stats')
  async usersStats(@Query() query: GetUsersStatsDto) {
    return this.usersService.usersStats(query);
  }

  @Roles()
  @Put('update-info')
  async updateUserInfo(
    @Req() req: any,
    @Body() updateUserInfoDto: UpdateUserInfoDto,
  ) {
    const userId = req.user.id; // Extract user ID from the request object
    return this.usersService.updateUserInfo(userId, updateUserInfoDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  // @Put(':id/change-email')
  // changeEmail(@Param('id') id: string, @Body('email') email: string) {
  //   return this.usersService.changeEmail(id, email);
  // }

  @Roles()
  @Post('change-password')
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(req.user.id, dto);
  }
}
