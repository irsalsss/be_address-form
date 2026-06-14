export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(opts: {
    statusCode: number;
    code: string;
    message: string;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = this.constructor.name;
    this.statusCode = opts.statusCode;
    this.code = opts.code;
    this.details = opts.details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "bad request", details?: unknown) {
    super({ statusCode: 400, code: "BAD_REQUEST", message, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "unauthorized") {
    super({ statusCode: 401, code: "UNAUTHORIZED", message });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "forbidden") {
    super({ statusCode: 403, code: "FORBIDDEN", message });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "not found") {
    super({ statusCode: 404, code: "NOT_FOUND", message });
  }
}

export class ConflictError extends AppError {
  constructor(message = "conflict") {
    super({ statusCode: 409, code: "CONFLICT", message });
  }
}

export class InternalError extends AppError {
  constructor(message = "internal error") {
    super({ statusCode: 500, code: "INTERNAL", message });
  }
}
