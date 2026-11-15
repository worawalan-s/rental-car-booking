const { EventEmitter } = require('events');
const crypto = require('crypto');
const amqp = require('amqplib');
const logger = require('./logger');

const EXCHANGE_NAME = 'booking.events';
const QUEUE_NAME = 'booking_state_transitions';
const PUBLISH_SLA_MS = 50;
const MAX_HISTORY_SIZE = 500;

/**
 * Maps a target booking status to its canonical domain event routing key.
 * @param {string} status
 * @returns {string} e.g. 'booking:confirmed', 'booking:active', 'booking:completed', 'booking:cancelled'
 */
const getDomainEventName = (status) => {
  if (!status || typeof status !== 'string') {
    return 'booking:updated';
  }
  return `booking:${status.toLowerCase()}`;
};

class MessageBrokerService extends EventEmitter {
  constructor() {
    super();
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.hasWarnedOffline = false;
    this.publishedEvents = [];
    this.exchange = EXCHANGE_NAME;
    this.queue = QUEUE_NAME;

    // Connect asynchronously outside of test environment when RABBITMQ_URL is configured
    if (process.env.NODE_ENV !== 'test' && process.env.RABBITMQ_URL) {
      this.connect().catch(() => {
        // Handled gracefully via fallback
      });
    }
  }

  /**
   * Establishes connection and topic exchange with RabbitMQ broker.
   * Gracefully falls back to in-memory event bus if broker is unreachable.
   */
  async connect(url = process.env.RABBITMQ_URL || 'amqp://127.0.0.1:5672') {
    try {
      this.connection = await amqp.connect(url, { timeout: 2000 });
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });
      await this.channel.assertQueue(this.queue, { durable: true });
      await this.channel.bindQueue(this.queue, this.exchange, 'booking:*');

      this.isConnected = true;
      this.hasWarnedOffline = false;
      logger.info(`RabbitMQ Connected: exchange=${this.exchange}`);

      this.connection.on('error', (err) => {
        this.isConnected = false;
        if (!this.hasWarnedOffline) {
          logger.warn(
            `RabbitMQ connection error: ${err.message}. Operating in in-memory broker fallback mode.`
          );
          this.hasWarnedOffline = true;
        }
      });

      this.connection.on('close', () => {
        this.isConnected = false;
      });

      return true;
    } catch (err) {
      this.isConnected = false;
      if (!this.hasWarnedOffline) {
        logger.warn(
          `RabbitMQ not reachable (${err.message}). Gracefully operating in in-memory broker fallback mode.`
        );
        this.hasWarnedOffline = true;
      }
      return false;
    }
  }

  /**
   * Publishes a booking state transition domain event to RabbitMQ (and local event bus)
   * within the mandatory 50ms SLA threshold (Adv Req 6).
   *
   * @param {Object} params
   * @param {string|Object} params.bookingId
   * @param {string} params.previousStatus
   * @param {string} params.newStatus
   * @param {string} [params.triggeredBy='system']
   * @param {Object} [params.metadata={}]
   * @returns {Promise<{ published: boolean, event: Object, latencyMs: number, withinSla: boolean, broker: string }>}
   */
  async publishBookingEvent({
    bookingId,
    previousStatus,
    newStatus,
    triggeredBy = 'system',
    metadata = {},
  }) {
    const startNs = process.hrtime.bigint();

    const eventType = getDomainEventName(newStatus);
    const event = {
      eventId: `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
      eventType,
      bookingId: String(bookingId),
      previousStatus,
      newStatus,
      triggeredBy,
      timestamp: new Date().toISOString(),
      metadata,
    };

    let broker = 'in-memory-fallback';

    if (this.isConnected && this.channel) {
      try {
        const payloadBuffer = Buffer.from(JSON.stringify(event));
        this.channel.publish(this.exchange, eventType, payloadBuffer, {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          timestamp: Date.now(),
        });
        broker = 'rabbitmq';
      } catch (err) {
        logger.warn(
          `RabbitMQ publish fallback triggered for ${eventType}: ${err.message}`
        );
      }
    }

    // Record in bounded in-memory outbox & notify subscribers synchronously (<1ms)
    this.publishedEvents.push(event);
    if (this.publishedEvents.length > MAX_HISTORY_SIZE) {
      this.publishedEvents.shift();
    }

    this.emit(eventType, event);
    this.emit('booking:*', event);

    const elapsedNs = process.hrtime.bigint() - startNs;
    const latencyMs = Number(elapsedNs) / 1e6;
    const withinSla = latencyMs <= PUBLISH_SLA_MS;
    event.latencyMs = latencyMs;

    logger.info(
      `Domain event published: ${eventType} for booking ${bookingId} (${previousStatus} -> ${newStatus}) via ${broker} in ${latencyMs.toFixed(3)}ms [SLA <= ${PUBLISH_SLA_MS}ms: ${withinSla ? 'PASS' : 'EXCEEDED'}]`
    );

    return {
      published: true,
      event,
      latencyMs,
      withinSla,
      broker,
    };
  }

  /**
   * Returns a shallow copy of recently published domain events (useful for verification & diagnostics).
   */
  getPublishedEvents() {
    return [...this.publishedEvents];
  }

  /**
   * Clears in-memory published events history (used in tests).
   */
  clearPublishedEvents() {
    this.publishedEvents = [];
  }

  /**
   * Gracefully closes RabbitMQ channel and connection.
   */
  async disconnect() {
    this.clearPublishedEvents();
    this.removeAllListeners();
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (_) {
      // Ignore close errors during shutdown
    } finally {
      this.channel = null;
      this.connection = null;
      this.isConnected = false;
    }
  }
}

const messageBroker = new MessageBrokerService();
messageBroker.MessageBrokerService = MessageBrokerService;
messageBroker.getDomainEventName = getDomainEventName;
messageBroker.EXCHANGE_NAME = EXCHANGE_NAME;
messageBroker.QUEUE_NAME = QUEUE_NAME;
messageBroker.PUBLISH_SLA_MS = PUBLISH_SLA_MS;

module.exports = messageBroker;
