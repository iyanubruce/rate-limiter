import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) =>
          typeof message === "string"
            ? `${timestamp} ${level}: ${message}`
            : `${timestamp} ${level}: ${JSON.stringify(message)}`,
        ),
      ),
    }),
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      silent: process.env.NODE_ENV === "test",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
      silent: process.env.NODE_ENV === "test",
    }),
  ],
});

export default logger;
