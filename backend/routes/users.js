const express = require('express');
const router = express.Router();
const User = require('../models/User');
const redisClient = require('../config/redis');

// POST /api/users - Login/Register User
router.post('/', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username is required' });

    let user = await User.findOne({ username });
    if (!user) {
      user = new User({ username });
      await user.save();
      await redisClient.del('users:all');
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/users - Get all users
router.get('/', async (req, res) => {
  try {
    const cachedUsers = await redisClient.get('users:all');
    if (cachedUsers) return res.json(JSON.parse(cachedUsers));
    const users = await User.find().sort({ username: 1 });
    await redisClient.set('users:all', JSON.stringify(users), 'EX', 120);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/users/leaderboard - Top players by wins
router.get('/leaderboard', async (req, res) => {
  try {
    const top = await User.find().sort({ wins: -1 }).limit(10)
      .select('username wins losses draws games_played');
    res.json({ leaderboard: top });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/users/:id/profile - Full profile with stats
router.get('/:id/profile', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username wins losses draws games_played last_seen online_status file_history activity_log');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PATCH /api/users/:id/setname - Update username
router.patch('/:id/setname', async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || username.trim().length < 2 || username.trim().length > 20)
      return res.status(400).json({ error: 'Name must be 2–20 characters' });

    const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.params.id } });
    if (taken) return res.status(409).json({ error: 'Username already taken' });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { username: username.trim() },
      { new: true }
    );
    await redisClient.del('users:all');
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/users/:id/reset-stats - Reset game stats
router.post('/:id/reset-stats', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { wins: 0, losses: 0, draws: 0, games_played: 0 },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Stats reset', user });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
