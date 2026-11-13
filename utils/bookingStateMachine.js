/**
 * Booking Lifecycle State Machine (Adv Req 6 - Issue #22)
 *
 * Enforces strict transitions across the 5 booking statuses:
 *   Pending -> Confirmed -> Active -> Completed (or Cancelled)
 *
 * Terminal states: Completed, Cancelled (cannot transition or regress)
 */

const BOOKING_STATUS = Object.freeze({
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
});

const VALID_STATUSES = Object.freeze(Object.values(BOOKING_STATUS));

const TERMINAL_STATUSES = Object.freeze([
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
]);

const ACTIVE_STATUSES = Object.freeze([
  BOOKING_STATUS.PENDING,
  BOOKING_STATUS.CONFIRMED,
  BOOKING_STATUS.ACTIVE,
]);

/**
 * Transition rules map:
 * Pending   -> Confirmed, Cancelled
 * Confirmed -> Active, Cancelled
 * Active    -> Completed, Cancelled
 * Completed -> [] (Terminal)
 * Cancelled -> [] (Terminal)
 */
const ALLOWED_STATUS_TRANSITIONS = Object.freeze({
  [BOOKING_STATUS.PENDING]: Object.freeze([
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.CANCELLED,
  ]),
  [BOOKING_STATUS.CONFIRMED]: Object.freeze([
    BOOKING_STATUS.ACTIVE,
    BOOKING_STATUS.CANCELLED,
  ]),
  [BOOKING_STATUS.ACTIVE]: Object.freeze([
    BOOKING_STATUS.COMPLETED,
    BOOKING_STATUS.CANCELLED,
  ]),
  [BOOKING_STATUS.COMPLETED]: Object.freeze([]),
  [BOOKING_STATUS.CANCELLED]: Object.freeze([]),
});

/**
 * Checks whether a given status is recognized by the system
 * @param {string} status
 * @returns {boolean}
 */
const isValidStatus = (status) => {
  return VALID_STATUSES.includes(status);
};

/**
 * Checks if status is a terminal state (Completed or Cancelled)
 * @param {string} status
 * @returns {boolean}
 */
const isTerminalStatus = (status) => {
  return TERMINAL_STATUSES.includes(status);
};

/**
 * Checks if status is considered active for quota tracking (Pending, Confirmed, Active)
 * @param {string} status
 * @returns {boolean}
 */
const isActiveStatus = (status) => {
  return ACTIVE_STATUSES.includes(status);
};

/**
 * Checks if transitioning from currentStatus to targetStatus is permitted
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
const isValidStatusTransition = (currentStatus, targetStatus) => {
  if (isTerminalStatus(currentStatus)) {
    return false;
  }
  if (currentStatus === targetStatus) {
    return true;
  }
  const allowed = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
};

/**
 * Validates transition and returns detailed verification result
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {{ isValid: boolean, error?: string }}
 */
const validateStatusTransition = (currentStatus, targetStatus) => {
  if (!isValidStatus(currentStatus)) {
    return {
      isValid: false,
      error: `'${currentStatus}' is not a valid booking status`,
    };
  }

  if (!isValidStatus(targetStatus)) {
    return {
      isValid: false,
      error: `'${targetStatus}' is not a valid booking status`,
    };
  }

  if (isTerminalStatus(currentStatus)) {
    return {
      isValid: false,
      error: `Cannot modify booking with terminal status of '${currentStatus}'`,
    };
  }

  if (currentStatus === targetStatus) {
    return { isValid: true };
  }

  if (!isValidStatusTransition(currentStatus, targetStatus)) {
    return {
      isValid: false,
      error: `Cannot transition booking status from '${currentStatus}' to '${targetStatus}'`,
    };
  }

  return { isValid: true };
};

module.exports = {
  BOOKING_STATUS,
  VALID_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  isValidStatus,
  isTerminalStatus,
  isActiveStatus,
  isValidStatusTransition,
  validateStatusTransition,
};
