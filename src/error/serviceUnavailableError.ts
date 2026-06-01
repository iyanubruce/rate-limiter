import HttpStatus from "http-status-codes";

import ErrorHandler from "./errorHandler";

export default class ServiceUnavailableError extends ErrorHandler {
  protected override error_name = "service_unavailable";

  protected override httpCode = HttpStatus.SERVICE_UNAVAILABLE;

  public constructor(
    message: string = "Service currently unavailable",
    error: Error | undefined = undefined,
    data: any = null,
  ) {
    super(message, error, data);
    Error.captureStackTrace(this, this.constructor);
  }
}
