// utils/response.js - Standardized API response utilities

const { HTTP_STATUS } = require('../constants');

/**
 * Standard API response format
 * @param {Object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {Object} data - Response data
 * @param {string} message - Response message
 * @param {Object} meta - Additional metadata (pagination, etc.)
 */
const sendResponse = (res, statusCode, data = null, message = null, meta = null) => {
  const response = {
    success: statusCode >= 200 && statusCode < 300,
    statusCode,
    message,
    data,
    timestamp: new Date().toISOString(),
  };

  if (meta) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

/**
 * Success response helpers
 */
const success = (res, data = null, message = 'Success') => {
  return sendResponse(res, HTTP_STATUS.OK, data, message);
};

const created = (res, data = null, message = 'Created successfully') => {
  return sendResponse(res, HTTP_STATUS.CREATED, data, message);
};

const noContent = (res, message = 'No content') => {
  return sendResponse(res, HTTP_STATUS.NO_CONTENT, null, message);
};

/**
 * Error response helpers
 */
const badRequest = (res, message = 'Bad request', errors = null) => {
  const data = errors ? { errors } : null;
  return sendResponse(res, HTTP_STATUS.BAD_REQUEST, data, message);
};

const unauthorized = (res, message = 'Unauthorized') => {
  return sendResponse(res, HTTP_STATUS.UNAUTHORIZED, null, message);
};

const forbidden = (res, message = 'Forbidden') => {
  return sendResponse(res, HTTP_STATUS.FORBIDDEN, null, message);
};

const notFound = (res, message = 'Resource not found') => {
  return sendResponse(res, HTTP_STATUS.NOT_FOUND, null, message);
};

const conflict = (res, message = 'Resource already exists') => {
  return sendResponse(res, HTTP_STATUS.CONFLICT, null, message);
};

const unprocessableEntity = (res, message = 'Validation failed', errors = null) => {
  const data = errors ? { errors } : null;
  return sendResponse(res, HTTP_STATUS.UNPROCESSABLE_ENTITY, data, message);
};

const tooManyRequests = (res, message = 'Rate limit exceeded') => {
  return sendResponse(res, HTTP_STATUS.TOO_MANY_REQUESTS, null, message);
};

const internalError = (res, message = 'Internal server error') => {
  return sendResponse(res, HTTP_STATUS.INTERNAL_SERVER_ERROR, null, message);
};

const serviceUnavailable = (res, message = 'Service unavailable') => {
  return sendResponse(res, HTTP_STATUS.SERVICE_UNAVAILABLE, null, message);
};

/**
 * Paginated response helper
 */
const paginated = (res, data, pagination, message = 'Success') => {
  const meta = {
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: Math.ceil(pagination.total / pagination.limit),
      hasNext: pagination.page * pagination.limit < pagination.total,
      hasPrev: pagination.page > 1,
    },
  };
  
  return sendResponse(res, HTTP_STATUS.OK, data, message, meta);
};

/**
 * Error handler for async routes
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error formatter
 */
const formatValidationErrors = (errors) => {
  return errors.array().map(error => ({
    field: error.param,
    message: error.msg,
    value: error.value,
  }));
};

module.exports = {
  sendResponse,
  success,
  created,
  noContent,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  unprocessableEntity,
  tooManyRequests,
  internalError,
  serviceUnavailable,
  paginated,
  asyncHandler,
  formatValidationErrors,
};
