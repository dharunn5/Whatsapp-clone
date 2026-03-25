/**
 * routes/games.js
 * REST API routes for game session management and leaderboard.
 * Real-time game moves go through Socket.IO (in server.js).
 */
const express = require('express');
const router = express.Router();
const { createGame, joinGame, findActiveSession, getLeaderboard } = require('../services/gameService');
const { getFileHistory } = require('../services/fileService');

// POST /api/games/start — Create a new game session
router.post('/start', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const result = await createGame(userId);
    if (result.alreadyInGame) return res.status(409).json({ error: 'You are already in a game', session: result.session });
    if (result.alreadyWaiting) return res.status(409).json({ error: 'You already have a waiting game', session: result.session });
    res.status(201).json({ session: result.session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games/join — Join the waiting game
router.post('/join', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  try {
    const result = await joinGame(userId);
    if (result.error === 'already_in_game') return res.status(409).json({ error: 'You are already in a game' });
    if (result.error === 'no_waiting_session') return res.status(404).json({ error: 'No waiting game found. Ask someone to start one first.' });
    res.json({ session: result.session, player1Id: result.player1Id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/active/:userId — Check if user is in an active game
router.get('/active/:userId', async (req, res) => {
  try {
    const session = await findActiveSession(req.params.userId);
    res.json({ session: session || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/leaderboard — Top players
router.get('/leaderboard', async (req, res) => {
  try {
    const top = await getLeaderboard(10);
    res.json({ leaderboard: top });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/files/:userId — File history for a user
router.get('/files/:userId', async (req, res) => {
  try {
    const history = await getFileHistory(req.params.userId);
    res.json({ files: history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
