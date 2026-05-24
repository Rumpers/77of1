import Redis from 'ioredis';

// ADR-011: revocation events travel on Redis pub/sub so workers cancel within 60s SLA.
// Channel per creator so subscribers can pattern-subscribe and filter by creatorId.
const channelFor = (creatorId: string) => `consent.revoked.${creatorId}`;

export type RevocationHandler = (creatorId: string) => Promise<void>;

export interface RevocationBus {
  publish(creatorId: string): Promise<void>;
  // Returns an unsubscribe function.
  subscribe(handler: RevocationHandler): Promise<() => Promise<void>>;
}

export function createRevocationBus(redisUrl: string): RevocationBus {
  return {
    async publish(creatorId: string): Promise<void> {
      const pub = new Redis(redisUrl);
      try {
        await pub.publish(channelFor(creatorId), creatorId);
      } finally {
        pub.disconnect();
      }
    },

    async subscribe(handler: RevocationHandler): Promise<() => Promise<void>> {
      const sub = new Redis(redisUrl);

      // Pattern subscribe catches all creators in a single connection.
      await sub.psubscribe('consent.revoked.*');

      sub.on('pmessage', (_pattern: string, _channel: string, message: string) => {
        // message is the creatorId published above
        const creatorId = message;
        handler(creatorId).catch((err: Error) => {
          console.error(`[revocation-bus] handler error creator=${creatorId}: ${err.message}`);
        });
      });

      return async () => {
        await sub.punsubscribe('consent.revoked.*');
        sub.disconnect();
      };
    },
  };
}
