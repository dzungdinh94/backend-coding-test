/* eslint-disable no-multi-assign */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-param-reassign */
const qs = require('qs');
const url = require('url');
const assign = require('lodash.assign');
const clone = require('lodash.clone');
const isObject = require('lodash.isobject');

exports = module.exports;

exports.href = function href(req) {
  return function (prev, params) {
    let query = clone(req.query);

    if (typeof prev === 'object') {
      params = prev;
      prev = false;
    } else {
      prev = typeof prev === 'boolean' ? prev : false;
      query.page = parseInt(query.page, 10);
      query.page = prev ? (query.page -= 1) : (query.page += 1);
      query.page = query.page < 1 ? 1 : query.page;
    }

    // allow overriding querystring params
    // (useful for sorting and filtering)
    // another alias for `_.assign` is `_.extend`
    if (isObject(params)) query = assign(query, params);

    return `${url.parse(req.originalUrl).pathname}?${qs.stringify(query)}`;
  };
};

exports.hasNextPages = function hasNextPages(req) {
  return function (pageCount) {
    if (typeof pageCount !== 'number' || pageCount < 0) {
      throw new Error('express-paginate: `pageCount` is not a number >= 0');
    }
    return req.query.page < pageCount;
  };
};

exports.getArrayPages = function (req) {
  return (limit, pageCount, currentPage) => {
    limit = limit || 3;

    if (typeof limit !== 'number' || limit < 0) {
      throw new Error('express-paginate: `limit` is not a number >= 0');
    }

    if (typeof pageCount !== 'number' || pageCount < 0) {
      throw new Error('express-paginate: `pageCount` is not a number >= 0');
    }

    currentPage = parseInt(currentPage, 10);
    if (Number.isNaN(currentPage) || currentPage < 0) {
      throw new Error('express-paginate: `currentPage` is not a number >= 0');
    }

    if (limit > 0) {
      const end = Math.min(
        Math.max(currentPage + Math.floor(limit / 2), limit),
        pageCount,
      );
      const start = Math.max(1, currentPage < limit - 1 ? 1 : end - limit + 1);

      const pages = [];
      for (let i = start; i <= end; i++) {
        pages.push({
          number: i,
          url: exports
            .href(req)()
            .replace(`page=${currentPage + 1}`, `page=${i}`),
        });
      }

      return pages;
    }
  };
};

exports.middleware = function middleware(limit, maxLimit) {
  const _limit = typeof limit === 'number' ? parseInt(limit, 10) : 10;

  const _maxLimit = typeof maxLimit === 'number' ? parseInt(maxLimit, 10) : 50;

  return function _middleware(req, res, next) {
    req.query.page = typeof req.query.page === 'string'
      ? parseInt(req.query.page, 10) || 1
      : 1;

    req.query.limit = typeof req.query.limit === 'string'
      ? parseInt(req.query.limit, 10) || 0
      : _limit;

    if (req.query.limit > _maxLimit) req.query.limit = _maxLimit;

    if (req.query.page < 1) req.query.page = 1;

    if (req.query.limit < 0) req.query.limit = 0;

    req.skip = req.offset = req.query.page * req.query.limit - req.query.limit;

    res.locals.paginate = {};
    res.locals.paginate.page = req.query.page;
    res.locals.paginate.limit = req.query.limit;
    res.locals.paginate.href = exports.href(req);
    res.locals.paginate.hasPreviousPages = req.query.page > 1;
    res.locals.paginate.hasNextPages = exports.hasNextPages(req);
    res.locals.paginate.getArrayPages = exports.getArrayPages(req);

    next();
  };
};
