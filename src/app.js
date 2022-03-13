const express = require('express');

const app = express();

const bodyParser = require('body-parser');

const jsonParser = bodyParser.json();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./resources/swagger.json');
const { errorHandler } = require('./handler/error/handler');
const paginate = require('./utils/pagination');

module.exports = (db) => {
  app.use('/v1/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use(paginate.middleware(10, 50));
  app.get('/health', (req, res) => res.send('Healthy'));

  app.post('/rides', jsonParser, (req, res) => {
    const startLatitude = Number(req.body.start_lat);
    const startLongitude = Number(req.body.start_long);
    const endLatitude = Number(req.body.end_lat);
    const endLongitude = Number(req.body.end_long);
    const riderName = req.body.rider_name;
    const driverName = req.body.driver_name;
    const driverVehicle = req.body.driver_vehicle;

    if (
      startLatitude < -90
      || startLatitude > 90
      || startLongitude < -180
      || startLongitude > 180
    ) {
      return res.send({
        error_code: 'VALIDATION_ERROR',
        message:
          'Start latitude and longitude must be between -90 - 90 and -180 to 180 degrees respectively',
      });
    }

    if (
      endLatitude < -90
      || endLatitude > 90
      || endLongitude < -180
      || endLongitude > 180
    ) {
      return res.send({
        error_code: 'VALIDATION_ERROR',
        message:
          'End latitude and longitude must be between -90 - 90 and -180 to 180 degrees respectively',
      });
    }

    if (typeof riderName !== 'string' || riderName.length < 1) {
      return res.send({
        error_code: 'VALIDATION_ERROR',
        message: 'Rider name must be a non empty string',
      });
    }

    if (typeof driverName !== 'string' || driverName.length < 1) {
      return res.send({
        error_code: 'VALIDATION_ERROR',
        message: 'Rider name must be a non empty string',
      });
    }

    if (typeof driverVehicle !== 'string' || driverVehicle.length < 1) {
      return res.send({
        error_code: 'VALIDATION_ERROR',
        message: 'Rider name must be a non empty string',
      });
    }

    const values = [
      req.body.start_lat,
      req.body.start_long,
      req.body.end_lat,
      req.body.end_long,
      req.body.rider_name,
      req.body.driver_name,
      req.body.driver_vehicle,
    ];

    db.run(
      'INSERT INTO Rides(startLat, startLong, endLat, endLong, riderName, driverName, driverVehicle) VALUES (?, ?, ?, ?, ?, ?, ?)',
      values,
      (err) => {
        if (err) {
          return res.send({
            error_code: 'SERVER_ERROR',
            message: 'Unknown error',
          });
        }

        db.all(
          'SELECT * FROM Rides WHERE rideID = ?',
          this.lastID,
          (errInner, rows) => {
            if (errInner) {
              return res.send({
                error_code: 'SERVER_ERROR',
                message: 'Unknown error',
              });
            }

            res.send(rows);
          },
        );
      },
    );
  });

  app.get('/rides', (req, res, next) => {
    const start = (req.query.page - 1) * req.query.limit;
    const end = req.query.page * req.query.limit;
    db.all('SELECT * FROM Rides LIMIT ?,?', [start, end], (err, results) => {
      if (err) {
        return res.send({
          error_code: 'SERVER_ERROR',
          message: 'Unknown error',
        });
      }

      if (results.length === 0) {
        return res.send({
          error_code: 'RIDES_NOT_FOUND_ERROR',
          message: 'Could not find any rides',
        });
      }
      db.all('SELECT COUNT(*) as count FROM Rides', (countError, rows) => {
        if (countError) {
          return next(countError);
        }

        const totalCount = rows[0].count;
        console.log(totalCount)
        const pageCount = Math.ceil(totalCount / req.query.limit);
        const response = {
          results,
          pageCount,
          has_more: paginate.hasNextPages(req)(pageCount),
          itemCount: totalCount,
          pages: paginate.getArrayPages(req)(
            req.query.limit,
            pageCount,
            req.query.page,
          ),
        };
        res.send(response);
      });
    });
  });

  app.get('/rides/:id', (req, res) => {
    db.all(
      `SELECT * FROM Rides WHERE rideID='${req.params.id}'`,
      (err, rows) => {
        if (err) {
          return res.send({
            error_code: 'SERVER_ERROR',
            message: 'Unknown error',
          });
        }

        if (rows.length === 0) {
          return res.send({
            error_code: 'RIDES_NOT_FOUND_ERROR',
            message: 'Could not find any rides',
          });
        }

        res.send(rows);
      },
    );
  });
  app.use(errorHandler);

  return app;
};
