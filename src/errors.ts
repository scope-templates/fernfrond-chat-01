export class DomainError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly code: string = 'DOMAIN_ERROR',
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(what: string) {
    super(`${what} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}
