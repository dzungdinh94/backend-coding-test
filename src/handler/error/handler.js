const logger = require('../logger');

const errorHandler = (error, response) => {
  logger.error(`Error . ${error}`);

  return response.status(500).send({
    error_code: 'SERVER_ERROR',
    message: 'Internal Server Error',
  });
};

module.exports = {
  errorHandler,
};
