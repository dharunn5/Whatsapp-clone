/**
 * services/callService.js
 * Simulated audio/video call tracking using Redis.
 * Stores pending calls as: Redis key `call:<calleeId>` → JSON {caller, type, ts}
 */
const redisClient = require('../config/redis');

const CALL_TTL_SECONDS = 30; // auto-expire if not accepted/rejected
const KEY = (calleeId) => `call:${calleeId}`;

/**
 * Start a call from callerId to calleeId.
 * type: 'audio' | 'video'
 */
const initiateCall = async (callerId, calleeId, type = 'audio') => {
  // Check if callee already has a pending call
  const existing = await redisClient.get(KEY(calleeId));
  if (existing) return { error: 'callee_busy' };

  const payload = JSON.stringify({ caller: callerId, type, ts: Date.now() });
  await redisClient.set(KEY(calleeId), payload, 'EX', CALL_TTL_SECONDS);
  return { success: true };
};

/**
 * Accept a call. Returns caller info or null if no pending call.
 */
const acceptCall = async (calleeId) => {
  const raw = await redisClient.get(KEY(calleeId));
  if (!raw) return null;
  await redisClient.del(KEY(calleeId));
  return JSON.parse(raw);
};

/**
 * Reject a call. Returns caller info or null if no pending call.
 */
const rejectCall = async (calleeId) => {
  const raw = await redisClient.get(KEY(calleeId));
  if (!raw) return null;
  await redisClient.del(KEY(calleeId));
  return JSON.parse(raw);
};

/**
 * Check if a user has an incoming call.
 */
const getPendingCall = async (calleeId) => {
  const raw = await redisClient.get(KEY(calleeId));
  return raw ? JSON.parse(raw) : null;
};

module.exports = { initiateCall, acceptCall, rejectCall, getPendingCall };
