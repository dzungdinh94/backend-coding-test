const path = require('path');
const { createLogger, format, transports } = require('winston');

const LOGGING_LEVEL = 'error';
const logger = createLogger({
  level: LOGGING_LEVEL,
  format: format.combine(
    format.label({
      label: path.basename(process.main.filename),
    }),
    format.timestamp({
      format: 'YYYY-MM-DD hh:mm:ss',
    }),
  ),
  transports: [
    new transports.File({
      filename: 'rider-api.logs',
      handleExceptions: true,
      format: format.combine(
        format.colorize(),
        format.printf(
          (info) => `${info.timestamp} ${LOGGING_LEVEL} [${info.label}]: ${info.message}`,
        ),
      ),
    }),
  ],
});

module.exports = logger;
