import HttpStatus from 'http-status-codes';
import ErrorHandler from './errorHandler';

export default class TooManyRequestsError extends ErrorHandler {
  protected error_name = 'too_many_requests';
  protected httpCode = HttpStatus.TOO_MANY_REQUESTS;

  constructor(message = 'Too many requests. Please try again later.', error: Error | undefined = undefined, data: any = null) {
    super(message, error, data);
    Error.captureStackTrace(this, this.constructor);
  }
}
