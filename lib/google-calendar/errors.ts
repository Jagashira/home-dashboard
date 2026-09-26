export class GoogleSyncTokenExpiredError extends Error {
  constructor(message = "Google Calendar sync token has expired") {
    super(message);
    this.name = "GoogleSyncTokenExpiredError";
  }
}
