import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class OAuthExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception.getResponse() as {
      message: string;
      statusCode: number;
    };

    response.status(status).render('error', {
      message: exceptionResponse.message || 'An error occurred',
      statusCode: exceptionResponse.statusCode || status,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
