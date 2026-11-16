const mongoose = require('mongoose');

/**
 * Safely initializes a Mongoose transaction session if supported by the deployment topology
 * (ReplicaSet or Sharded Cluster, like MongoDB Atlas). On standalone local instances (Single),
 * returns null so operations succeed without throwing error code 20 IllegalOperation.
 *
 * @returns {Promise<import('mongoose').ClientSession|null>}
 */
const createSafeSession = async () => {
  try {
    const topologyType =
      mongoose.connection?.client?.topology?.description?.type;
    if (topologyType === 'Single') {
      return null;
    }
    const session = await mongoose.startSession();
    if (session && typeof session.startTransaction === 'function') {
      session.startTransaction();
    }
    return session;
  } catch (err) {
    return null;
  }
};

/**
 * Safely aborts an active transaction session without throwing unhandled rejections.
 *
 * @param {import('mongoose').ClientSession|null} session
 */
const safeAbort = async (session) => {
  if (session && typeof session.abortTransaction === 'function') {
    try {
      const isInTx =
        typeof session.inTransaction === 'function'
          ? session.inTransaction()
          : true;
      if (isInTx) {
        await session.abortTransaction();
      }
    } catch (_) {}
  }
};

/**
 * Safely commits an active transaction session without throwing unhandled rejections.
 *
 * @param {import('mongoose').ClientSession|null} session
 */
const safeCommit = async (session) => {
  if (session && typeof session.commitTransaction === 'function') {
    try {
      const isInTx =
        typeof session.inTransaction === 'function'
          ? session.inTransaction()
          : true;
      if (isInTx) {
        await session.commitTransaction();
      }
    } catch (_) {}
  }
};

/**
 * Safely ends a session without throwing.
 *
 * @param {import('mongoose').ClientSession|null} session
 */
const safeEnd = (session) => {
  if (session && typeof session.endSession === 'function') {
    try {
      session.endSession();
    } catch (_) {}
  }
};

module.exports = {
  createSafeSession,
  safeAbort,
  safeCommit,
  safeEnd,
};
