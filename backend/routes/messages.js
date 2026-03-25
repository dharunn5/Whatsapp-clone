const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const redisClient = require('../config/redis');

// POST /api/messages - Send a message
router.post('/', async (req, res) => {
  try {
    const { sender, receiver, text } = req.body;
    if (!sender || !receiver || !text) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const message = new Message({ sender, receiver, text });
    await message.save();

    await message.populate('sender receiver', 'username');

    // Invalidate conversation cache
    const pair = [sender, receiver].sort().join('_');
    await redisClient.del(`messages:${pair}`);

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/messages/:userId/:receiverId - Get conversation
router.get('/:userId/:receiverId', async (req, res) => {
  try {
    const { userId, receiverId } = req.params;
    
    const pair = [userId, receiverId].sort().join('_');
    const cachedMessages = await redisClient.get(`messages:${pair}`);
    if (cachedMessages) {
      return res.json(JSON.parse(cachedMessages));
    }

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: receiverId },
        { sender: receiverId, receiver: userId }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('sender receiver', 'username');

    // Cache the messages for 60 seconds
    await redisClient.set(`messages:${pair}`, JSON.stringify(messages), 'EX', 60);

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
