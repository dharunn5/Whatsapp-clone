const express = require('express');
const router = express.Router();
const User = require('../models/User');
const redisClient = require('../config/redis');

const bcrypt = require('bcryptjs');
const { sendOTP } = require('../utils/mailer');

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/users/register - Initial step, send OTP
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields are required' });

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      if (existingUser.email === email) return res.status(400).json({ error: 'Email already registered' });
      if (existingUser.username === username) return res.status(400).json({ error: 'Username already taken' });
    }

    const otp = generateOTP();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Store in Redis (10 minutes)
    const pendingData = { username, email, password: hashedPassword, otp };
    await redisClient.set(`otp:${email}`, JSON.stringify(pendingData), 'EX', 600);

    await sendOTP(email, otp);

    res.json({ message: 'OTP sent successfully to email' });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/users/verify-otp - Verify code & create user
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const rawData = await redisClient.get(`otp:${email}`);
    if (!rawData) return res.status(400).json({ error: 'OTP expired or invalid' });

    const pendingData = JSON.parse(rawData);
    if (pendingData.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });

    if (await User.findOne({ email })) return res.status(400).json({ error: 'Email already registered' });

    const user = new User({
      username: pendingData.username,
      email: pendingData.email,
      password: pendingData.password
    });
    await user.save();
    
    await redisClient.del(`otp:${email}`);
    await redisClient.del('users:all');
    
    const userObj = user.toJSON();
    delete userObj.password;

    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/users/login - Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid email or password' });

    const userObj = user.toJSON();
    delete userObj.password;

    res.json(userObj);
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

// PATCH /api/users/:id/profile-update - Update profile (name, bio, photo)
router.patch('/:id/profile-update', async (req, res) => {
  try {
    const { username, bio, profilePhoto } = req.body;
    let updates = {};

    if (username !== undefined) {
      if (username.trim().length < 2 || username.trim().length > 20) {
        return res.status(400).json({ error: 'Name must be 2–20 characters' });
      }
      const taken = await User.findOne({ username: username.trim(), _id: { $ne: req.params.id } });
      if (taken) return res.status(409).json({ error: 'Username already taken' });
      updates.username = username.trim();
    }
    if (bio !== undefined) updates.bio = bio.trim();
    if (profilePhoto !== undefined) updates.profilePhoto = profilePhoto;

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await redisClient.del('users:all');
    
    const userObj = user.toJSON();
    delete userObj.password;
    res.json(userObj);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
