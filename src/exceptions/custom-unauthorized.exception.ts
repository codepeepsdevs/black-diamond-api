import { HttpException, HttpStatus } from '@nestjs/common';

export class CustomUnauthorizedException extends HttpException {
  constructor(service: string) {
    const message = `User is not registered with ${service}. Please use a registered account or sign up using ${service}.`;
    const statusCode = HttpStatus.UNAUTHORIZED;
    super({ message, statusCode }, statusCode);
  }
}
