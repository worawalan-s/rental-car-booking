const mongoose = require('mongoose');
const {
  createSafeSession,
  safeAbort,
  safeCommit,
  safeEnd,
} = require('../utils/transaction');

describe('Transaction Helper Utility (ACID & Standalone Fallback)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createSafeSession', () => {
    it('returns null when connection topology type is Single (standalone local MongoDB)', async () => {
      const originalClient = mongoose.connection.client;
      mongoose.connection.client = {
        topology: {
          description: {
            type: 'Single',
          },
        },
      };

      const session = await createSafeSession();
      expect(session).toBeNull();

      mongoose.connection.client = originalClient;
    });

    it('starts and returns a transaction session when topology supports transactions', async () => {
      const mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
        inTransaction: jest.fn().mockReturnValue(true),
      };
      jest.spyOn(mongoose, 'startSession').mockResolvedValue(mockSession);

      const session = await createSafeSession();
      expect(session).toBe(mockSession);
      expect(mockSession.startTransaction).toHaveBeenCalled();
    });

    it('returns null gracefully when startSession throws an error', async () => {
      jest.spyOn(mongoose, 'startSession').mockRejectedValue(new Error('Topology does not support sessions'));

      const session = await createSafeSession();
      expect(session).toBeNull();
    });
  });

  describe('safeAbort', () => {
    it('aborts transaction when session is in an active transaction', async () => {
      const mockSession = {
        abortTransaction: jest.fn().mockResolvedValue(),
        inTransaction: jest.fn().mockReturnValue(true),
      };

      await safeAbort(mockSession);
      expect(mockSession.abortTransaction).toHaveBeenCalled();
    });

    it('handles null, undefined, or sessions without inTransaction gracefully', async () => {
      await expect(safeAbort(null)).resolves.not.toThrow();
      await expect(safeAbort(undefined)).resolves.not.toThrow();

      const mockSession = {
        abortTransaction: jest.fn().mockRejectedValue(new Error('Cannot abort')),
        inTransaction: jest.fn().mockReturnValue(true),
      };
      await expect(safeAbort(mockSession)).resolves.not.toThrow();
    });
  });

  describe('safeCommit', () => {
    it('commits transaction when session is in an active transaction', async () => {
      const mockSession = {
        commitTransaction: jest.fn().mockResolvedValue(),
        inTransaction: jest.fn().mockReturnValue(true),
      };

      await safeCommit(mockSession);
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    it('handles null, undefined, or sessions without throwing', async () => {
      await expect(safeCommit(null)).resolves.not.toThrow();
      await expect(safeCommit(undefined)).resolves.not.toThrow();
    });
  });

  describe('safeEnd', () => {
    it('ends session safely when session has endSession function', () => {
      const mockSession = {
        endSession: jest.fn(),
      };

      safeEnd(mockSession);
      expect(mockSession.endSession).toHaveBeenCalled();
    });

    it('handles null or undefined session gracefully', () => {
      expect(() => safeEnd(null)).not.toThrow();
      expect(() => safeEnd(undefined)).not.toThrow();
    });
  });
});
