"use strict";

const request = require("supertest");
const assert = require("assert");

const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database(":memory:");

const app = require("../src/app")(db);
const buildSchemas = require("../src/schemas");

const faker = require("faker");

let rideEntities = [];

const getRandomNumber = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomRideEntity = () => {
  return {
    start_lat: getRandomNumber(-90, 90),
    start_long: getRandomNumber(-180, 180),
    end_lat: getRandomNumber(-90, 90),
    end_long: getRandomNumber(-180, 180),
    rider_name: faker.name.findName(),
    driver_name: faker.name.findName(),
    driver_vehicle: faker.vehicle.type(),
  };
};

const generateRandomRideEntities = (numberOfRides = 1) => {
  return new Array(numberOfRides)
    .fill("")
    .map((e) => generateRandomRideEntity());
};

const assertRideEntities = (dummyRides, actualRides) => {
  dummyRides.forEach((dummyRide, index) => {
    assertRideEntity(dummyRide, actualRides[index]);
  });
};

const assertRideEntity = (dummyRide, actualRide) => {
  assert.strictEqual(actualRide.riderName, dummyRide.rider_name);
  assert.strictEqual(actualRide.driverName, dummyRide.driver_name);
  assert.strictEqual(actualRide.driverVehicle, dummyRide.driver_vehicle);
  assert.strictEqual(actualRide.endLat, dummyRide.end_lat);
  assert.strictEqual(actualRide.startLat, dummyRide.start_lat);
  assert.strictEqual(actualRide.endLong, dummyRide.end_long);
  assert.strictEqual(actualRide.startLong, dummyRide.start_long);
};

const assertRideValidationError = (
  propertiesToOverride,
  validationError,
  done
) => {
  const body = { ...rideEntities[2], ...propertiesToOverride };
  request(app)
    .post("/rides")
    .send(body)
    .expect("Content-Type", /json/)
    .expect(400)
    .expect(validationError)
    .end(done);
};

describe("API tests", () => {
  before((done) => {
    db.serialize((err) => {
      if (err) {
        return done(err);
      }

      buildSchemas(db);

      done();
    });
  });

  describe("GET /health", () => {
    it("should return health", (done) => {
      request(app)
        .get("/health")
        .expect("Content-Type", /text/)
        .expect(200, done);
    });
  });

  describe("Ride endpoints", () => {
    // Size of generated ride entities
    const size = 15;

    beforeEach((done) => {
      db.parallelize((err) => {
        if (err) {
          return done(err);
        }
        db.run("DELETE FROM Rides");

        const placeholder = "(?, ?, ?, ?, ?, ?, ?)";
        const placeholders = new Array(size).fill(placeholder).join(", ");
        const insertQuery = `
          INSERT INTO Rides(startLat, startLong, endLat, endLong, riderName, driverName, driverVehicle) 
          VALUES ${placeholders};
        `;

        rideEntities = generateRandomRideEntities(size);
        const placeHolderValues = rideEntities.map((riderEntity) =>
          Object.values(riderEntity)
        );
        const flattenedPlaceholderValues = [].concat(...placeHolderValues);
        db.run(insertQuery, flattenedPlaceholderValues, () => {
          db.run(
            "UPDATE SQLITE_SEQUENCE SET SEQ=0 WHERE" + " NAME='Rides';\n",
            () => {
              done();
            }
          );
        });
      });
    });

    describe("GET /rides", () => {
      it("should return a response with pre-set headers from helmet", (done) => {
        request(app)
          .get("/rides")
          .expect("Content-Type", /json/)
          .expect(200)
          .expect("X-XSS-Protection", "0")
          .expect("X-DNS-Prefetch-Control", "off")
          .expect("X-Content-Type-Options", "nosniff")
          .expect("Expect-CT", "max-age=0")
          .expect("X-Download-Options", "noopen")
          .expect(
            "Content-Security-Policy",
            "default-src 'self';base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests"
          )
          .end(done);
      });
      it("should return exactly 10 rides given no limit query parameter", (done) => {
        const limit = 10;
        request(app)
          .get("/rides")
          .expect("Content-Type", /json/)
          .expect(200)
          .expect((response) => {
            assert.strictEqual(response.body.results.length, limit);
            assert.strictEqual(response.body.pages.length, 2);
            assert.strictEqual(response.body.has_more, true);
            assert.strictEqual(response.body.itemCount, size);
            assert.strictEqual(response.body.pageCount, 2);
            assertRideEntities(
              rideEntities.slice(0, limit),
              response.body.results
            );
          })
          .end(done);
      });

      it("should return exactly 2 rides given limit query parameter of 2", (done) => {
        const limit = 2;
        request(app)
          .get("/rides")
          .query({ limit })
          .expect("Content-Type", /json/)
          .expect(200)
          .expect((response) => {
            assert.strictEqual(response.body.results.length, limit);
            assert.strictEqual(response.body.pages.length, 2);
            assert.strictEqual(response.body.has_more, true);
            assert.strictEqual(response.body.itemCount, size);
            assert.strictEqual(response.body.pageCount, 8);
            assertRideEntities(
              rideEntities.slice(0, limit),
              response.body.results
            );
          })
          .end(done);
      });

      // Generated entities are 15, so page 3 should only contain 3
      it(
        "should return exactly 3 rides given limit query parameter of 6," +
          " and page query parameter of 3",
        (done) => {
          const limit = 6;
          const page = 3;
          request(app)
            .get("/rides")
            .query({ limit, page })
            .expect("Content-Type", /json/)
            .expect(200)
            .expect((response) => {
              assert.strictEqual(response.body.results.length, 3);
              assert.strictEqual(response.body.has_more, false);
              assert.strictEqual(response.body.pages.length, 3);
              assert.strictEqual(
                response.body.pages.filter((item) => item.number === 2)[0].url,
                "/rides?limit=6&page=2"
              );
              assert.strictEqual(response.body.itemCount, size);
              assertRideEntities(
                rideEntities.slice(12, size),
                response.body.results
              );
            })
            .end(done);
        }
      );
    });

    describe("GET /rides/${id}", () => {
      it("should return a response with pre-set headers from helmet", (done) => {
        request(app)
          .get("/rides/2")
          .expect("Content-Type", /json/)
          .expect(200)
          .expect("X-DNS-Prefetch-Control", "off")
          .expect("Expect-CT", "max-age=0")
          .expect("X-Download-Options", "noopen")
          .expect("X-Content-Type-Options", "nosniff")
          .expect("X-XSS-Protection", "0")
          .expect(
            "Content-Security-Policy",
            "default-src 'self';base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
            done
          );
      });
      it("should return ride id of 2", (done) => {
        request(app)
          .get("/rides/2")
          .expect("Content-Type", /json/)
          .expect(200)
          .expect((response) => {
            const [actualRideTwo] = response.body;
            assertRideEntity(rideEntities[1], actualRideTwo);
          })
          .end(done);
      });
    });

    describe("POST /rides", () => {
      it("should return a response with pre-set headers from helmet", (done) => {
        const body = rideEntities[2];
        request(app)
          .post("/rides")
          .send(body)
          .expect("Content-Type", /json/)
          .expect(200)
          .expect("X-DNS-Prefetch-Control", "off")
          .expect("Expect-CT", "max-age=0")
          .expect("X-Download-Options", "noopen")
          .expect("X-Content-Type-Options", "nosniff")
          .expect("X-XSS-Protection", "0")
          .expect(
            "Content-Security-Policy",
            "default-src 'self';base-uri 'self';block-all-mixed-content;font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline';upgrade-insecure-requests",
            done
          );
      });

      it("should create a new ride", (done) => {
        const body = rideEntities[2];
        request(app)
          .post("/rides")
          .send(body)
          .expect("Content-Type", /json/)
          .expect(200)
          .expect((response) => {
            const [actualRide] = response.body;
            assertRideEntity(body, actualRide);
          })
          .end(done);
      });

      describe("validation errors for start latitude", () => {
        it(
          "should give validation error for start latitude greater" +
            " than 90",
          (done) => {
            const propertyWithError = { start_lat: 91 };
            assertRideValidationError(
              propertyWithError,
              {
                message:
                  "ModelError: startLat should be not be greater than 90 or less than -90",
              },
              done
            );
          }
        );

        it("should give validation error for start latitude lower than -90", (done) => {
          const propertyWithError = { start_lat: -91 };
          assertRideValidationError(
            propertyWithError,
            {
              message:
                "ModelError: startLat should be not be greater than 90 or less than -90",
            },
            done
          );
        });
      });

      describe("validation errors for start longitude", () => {
        it("should give validation error for start longitude greater than 180", (done) => {
          const propertyWithError = { start_long: 181 };
          assertRideValidationError(
            propertyWithError,
            {
              message:
                "ModelError: startLong should be not be greater than 180" +
                " or less than -180",
            },
            done
          );
        });

        it("should give validation error for start longitude lower than -180", (done) => {
          const propertyWithError = { start_long: -181 };
          assertRideValidationError(
            propertyWithError,
            {
              message:
                "ModelError: startLong should be not be greater than 180" +
                " or less than -180",
            },
            done
          );
        });
      });

      describe("validation errors for rider name", () => {
        it("should give validation error for empty string rider name", (done) => {
          const validationError = {
            message: "rider_name must be a non-empty string",
          };
          const propertyWithError = { rider_name: "" };
          assertRideValidationError(propertyWithError, validationError, done);
        });
      });

      describe("validation errors for driver name", () => {
        it("should give validation error for empty string driver name", (done) => {
          const validationError = {
            message: "driver_name must be a non-empty string",
          };
          const propertyWithError = { driver_name: "" };
          assertRideValidationError(propertyWithError, validationError, done);
        });
      });

      describe("validation errors for driver vehicle", () => {
        it("should give validation error for empty string driver vehicle", (done) => {
          const validationError = {
            message: "driver_vehicle must be a non-empty string",
          };
          const propertyWithError = { driver_vehicle: "" };
          assertRideValidationError(propertyWithError, validationError, done);
        });
      });
    });
  });
});
