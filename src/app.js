const express = require('express');

const app = express();

const bodyParser = require('body-parser');

const jsonParser = bodyParser.json();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./resources/swagger.json');
const { errorHandler } = require('./handler/error/handler');
const paginate = require('./utils/pagination');
const RideRepository = require('./repository/RideRepository');
const RideController = require('./controller/RideController');
const RideEntity = require('./entity/RideEntity');
const { selectQuery, insertQuery } = require('./utils/databaseQuery');

module.exports = (db) => {
  const repository = new RideRepository(
    db,
    RideEntity,
    selectQuery,
    insertQuery,
  );
  const controller = new RideController(repository);
  app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(paginate.middleware(10, 50));
  app.get('/health', (req, res) => res.send('Healthy'));

  app.post('/rides', jsonParser, (req, res, next) => {
    controller.postRide(req, res, next);
  });
  app.get('/rides', (req, res, next) => {
    controller.getRides(req, res, next);
  });
  app.get('/rides/:id', (req, res, next) => {
    controller.getRide(req, res, next);
  });
  app.use(errorHandler);

  return app;
};
