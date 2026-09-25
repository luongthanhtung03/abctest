/**
 * Classifies failures for the backend's retry decision (docs/05):
 * retryable = temporary (may succeed next attempt); non-retryable = same input fails again.
 */
export class JobError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
