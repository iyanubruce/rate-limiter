import HttpStatus from 'http-status-codes';
import ErrorHandler from './errorHandler';

export default class UnprocessableEntityError extends ErrorHandler {
  protected error_name = 'unprocessable_entity';

  protected httpCode = HttpStatus.UNPROCESSABLE_ENTITY;

  public constructor(message: string = 'Unprocessable entity', error: Error | undefined = undefined, data: any = null) {
    super(message, error, data);
    Error.captureStackTrace(this, this.constructor);
  }
}
