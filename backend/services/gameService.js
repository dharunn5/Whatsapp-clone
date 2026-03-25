/**
 * services/gameService.js
 * Core Rock Paper Scissors game logic.
 * Uses MongoDB GameSession model + directly updates User stats via mongoose.
 */
const GameSession = require('../models/GameSession');
const User = require('../models/User');

const WINS_AGAINST = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const EMOJI = { rock: '🪨', paper: '📄', scissors: '✂️' };

// ─── Session Lookup ──────────────────────────────────────────────────────────

/** Find a game session where this user is a player and status is in_progress */
const findActiveSession = async (userId) => {
  return GameSession.findOne({
    status: 'in_progress',
    $or: [{ player1: userId }, { player2: userId }]
  });
};

/** Find the single waiting session (not created by userId) */
const findWaitingSession = async (userId) => {
  return GameSession.findOne({ status: 'waiting', player1: { $ne: userId } });
};

// ─── Game Commands ───────────────────────────────────────────────────────────

/**
 * Create a new game session for userId.
 * Returns { session, message }
 */
const createGame = async (userId) => {
  // Block if already in a game
  const existing = await findActiveSession(userId);
  if (existing) return { session: existing, message: null, alreadyInGame: true };

  // Block if they already have a waiting session
  const myWaiting = await GameSession.findOne({ status: 'waiting', player1: userId });
  if (myWaiting) return { session: myWaiting, message: null, alreadyWaiting: true };

  const session = new GameSession({
    player1: userId,
    scores: { [userId]: 0 },
  });
  await session.save();
  return { session };
};

/**
 * Join an existing waiting session.
 * Returns { session, player1Id } so the caller can notify both players.
 */
const joinGame = async (userId) => {
  const existing = await findActiveSession(userId);
  if (existing) return { error: 'already_in_game' };

  const session = await findWaitingSession(userId);
  if (!session) return { error: 'no_waiting_session' };

  session.player2 = userId;
  session.status = 'in_progress';
  session.scores.set(userId.toString(), 0);
  await session.save();

  return { session, player1Id: session.player1.toString() };
};

/**
 * Submit a move for userId.
 * Returns { result, session, opponentId } where result is a rich object.
 */
const submitMove = async (userId, move) => {
  if (!['rock', 'paper', 'scissors'].includes(move)) {
    return { error: 'invalid_move' };
  }

  const session = await findActiveSession(userId);
  if (!session) return { error: 'not_in_game' };

  const userIdStr = userId.toString();
  const opponentId = session.player1.toString() === userIdStr
    ? session.player2.toString()
    : session.player1.toString();

  // Prevent duplicate move
  if (session.moves.get(userIdStr)) return { error: 'already_moved' };

  session.moves.set(userIdStr, move);

  // If opponent hasn't moved yet, wait
  if (!session.moves.get(opponentId)) {
    await session.save();
    return { waiting: true, session };
  }

  // Both have moved — resolve
  return resolveRound(session, userIdStr, opponentId);
};

// ─── Round Resolution ────────────────────────────────────────────────────────
const resolveRound = async (session, userId, opponentId) => {
  const myMove = session.moves.get(userId);
  const opMove = session.moves.get(opponentId);

  let roundWinner = null; // null = draw
  if (myMove !== opMove) {
    roundWinner = WINS_AGAINST[myMove] === opMove ? userId : opponentId;
  }

  // Update scores
  if (roundWinner) {
    const current = session.scores.get(roundWinner) || 0;
    session.scores.set(roundWinner, current + 1);
  }

  // Clear moves for next round
  session.moves = new Map();
  session.round += 1;

  const myScore = session.scores.get(userId) || 0;
  const opScore = session.scores.get(opponentId) || 0;

  // Check for match winner (first to 2)
  const target = 2;
  let matchOver = false;
  let matchWinner = null;

  if (myScore >= target || opScore >= target) {
    matchOver = true;
    matchWinner = myScore >= target ? userId : opponentId;
    session.status = 'finished';
    session.winner = matchWinner;

    // Update MongoDB user stats
    const loserId = matchWinner === userId ? opponentId : userId;
    await User.findByIdAndUpdate(matchWinner, { $inc: { wins: 1, games_played: 1 } });
    await User.findByIdAndUpdate(loserId,     { $inc: { losses: 1, games_played: 1 } });
  } else if (myScore === 1 && opScore === 1 && session.round > 2) {
    // Could be a draw if somehow both reach 1-1 after all rounds — handled by target logic
  }

  await session.save();

  return {
    session,
    roundResult: {
      myMove, opMove,
      myMoveEmoji: EMOJI[myMove],
      opMoveEmoji: EMOJI[opMove],
      roundWinner,        // userId string or null
      myScore, opScore,
      matchOver,
      matchWinner,        // userId string or null
      round: session.round - 1,
    },
    opponentId,
  };
};

/** Get top N users by wins */
const getLeaderboard = async (n = 5) => {
  return User.find().sort({ wins: -1 }).limit(n).select('username wins losses draws games_played');
};

/**
 * Abandon any active or waiting session for userId.
 * Returns { opponentId } if an opponent was found, else {}.
 */
const abandonGame = async (userId) => {
  const session = await GameSession.findOne({
    status: { $in: ['waiting', 'in_progress'] },
    $or: [{ player1: userId }, { player2: userId }],
  });
  if (!session) return {};

  session.status = 'abandoned';
  await session.save();

  // Determine opponent (may not exist for waiting sessions)
  let opponentId = null;
  if (session.player1 && session.player1.toString() !== userId.toString()) {
    opponentId = session.player1.toString();
  } else if (session.player2 && session.player2.toString() !== userId.toString()) {
    opponentId = session.player2.toString();
  }
  return { opponentId };
};

module.exports = { createGame, joinGame, submitMove, findActiveSession, getLeaderboard, abandonGame };
