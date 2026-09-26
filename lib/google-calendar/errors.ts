export class GoogleSyncTokenExpiredError extends Error {
  constructor(message = "Google Calendar sync token has expired") {
    super(message);
    this.name = "GoogleSyncTokenExpiredError";
  }
}

export class GoogleOutboundNotFoundError extends Error {
  constructor(message = "Google Calendar event was not found") {
    super(message);
    this.name = "GoogleOutboundNotFoundError";
  }
}

export class GoogleOutboundConflictError extends Error {
  constructor(message = "Google Calendar event changed after it was read") {
    super(message);
    this.name = "GoogleOutboundConflictError";
  }
}

export class GoogleOutboundAlreadyExistsError extends Error {
  constructor(message = "Google Calendar event already exists") {
    super(message);
    this.name = "GoogleOutboundAlreadyExistsError";
  }
}
