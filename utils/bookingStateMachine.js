/**
 * Booking Lifecycle State Machine (Adv Req 6 - Issue #22)
 *
 * Enforces strict transitions across the 5 booking statuses:
 *   Pending -> Confirmed -> Active -> Completed (or Cancelled)
 *
 * Terminal states: Completed, Cancelled (cannot transition or regress)
 * Supports payment gateway webhook event mapping and rental timeline progression.
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

const WEBHOOK_EVENT_TYPES = Object.freeze({
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
});

const WEBHOOK_STATUS_MAP = Object.freeze({
  [WEBHOOK_EVENT_TYPES.PAYMENT_SUCCEEDED]: Object.freeze({
    targetStatus: BOOKING_STATUS.CONFIRMED,
    paymentStatus: 'Paid',
  }),
  [WEBHOOK_EVENT_TYPES.PAYMENT_FAILED]: Object.freeze({
    targetStatus: BOOKING_STATUS.CANCELLED,
    paymentStatus: 'Failed',
  }),
});

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

/**
 * Resolves a payment gateway webhook eventType into its target booking status and paymentStatus.
 * @param {string} eventType
 * @returns {{ isValid: boolean, targetStatus?: string, paymentStatus?: string, error?: string }}
 */
const resolveWebhookTargetStatus = (eventType) => {
  const mapping = WEBHOOK_STATUS_MAP[eventType];
  if (!mapping) {
    return {
      isValid: false,
      error:
        "Invalid or unsupported webhook eventType. Allowed values: 'payment.succeeded', 'payment.failed'",
    };
  }
  return {
    isValid: true,
    targetStatus: mapping.targetStatus,
    paymentStatus: mapping.paymentStatus,
  };
};

/**
 * Deterministically evaluates whether a booking should automatically transition
 * based on rental start/end timelines relative to referenceDate.
 * - Confirmed -> Active when startDate <= referenceDate
 * - Active -> Completed when endDate <= referenceDate
 *
 * @param {Object} booking - Booking object containing { status, startDate, endDate }
 * @param {Date|string|number} [referenceDate=new Date()]
 * @returns {{ shouldTransition: boolean, targetStatus: string|null, reason?: string }}
 */
const evaluateTimelineTransition = (booking, referenceDate = new Date()) => {
  if (!booking || !booking.status || isTerminalStatus(booking.status)) {
    return { shouldTransition: false, targetStatus: null };
  }

  const refDate = new Date(referenceDate);
  const refTime = refDate.getTime();
  if (Number.isNaN(refTime)) {
    return { shouldTransition: false, targetStatus: null };
  }

  if (booking.status === BOOKING_STATUS.CONFIRMED && booking.startDate) {
    const startTime = new Date(booking.startDate).getTime();
    if (!Number.isNaN(startTime) && startTime <= refTime) {
      return {
        shouldTransition: true,
        targetStatus: BOOKING_STATUS.ACTIVE,
        reason: 'Rental startDate reached',
      };
    }
  }

  if (booking.status === BOOKING_STATUS.ACTIVE && booking.endDate) {
    const endTime = new Date(booking.endDate).getTime();
    if (!Number.isNaN(endTime) && endTime <= refTime) {
      return {
        shouldTransition: true,
        targetStatus: BOOKING_STATUS.COMPLETED,
        reason: 'Rental endDate reached',
      };
    }
  }

  return { shouldTransition: false, targetStatus: null };
};

module.exports = {
  BOOKING_STATUS,
  VALID_STATUSES,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  WEBHOOK_EVENT_TYPES,
  WEBHOOK_STATUS_MAP,
  ALLOWED_STATUS_TRANSITIONS,
  isValidStatus,
  isTerminalStatus,
  isActiveStatus,
  isValidStatusTransition,
  validateStatusTransition,
  resolveWebhookTargetStatus,
  evaluateTimelineTransition,
};
