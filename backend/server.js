require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/users',    require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/games',    require('./routes/games'));

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// ── Socket.io + Redis Adapter ─────────────────────────────────────────────────
const { createAdapter } = require('@socket.io/redis-adapter');
const redisClient = require('./config/redis');

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  adapter: createAdapter(redisClient, redisClient.duplicate())
});

// ── Services (used by socket handlers) ───────────────────────────────────────
const { submitMove, findActiveSession, abandonGame } = require('./services/gameService');
const { saveFileMetadata } = require('./services/fileService');
const { initiateCall, acceptCall, rejectCall } = require('./services/callService');
const User = require('./models/User');
const Message = require('./models/Message');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: get socket ID for a userId from Redis
const getSocketId = (userId) => redisClient.hget('online_users', userId);

// Helper: emit to a user by their DB userId (via Redis online_users hash)
const emitToUser = async (userId, event, data) => {
  const socketId = await getSocketId(userId.toString());
  if (socketId) io.to(socketId).emit(event, data);
};

// ─────────────────────────────────────────────────────────────────────────────
io.on('connection', async (socket) => {
  console.log('User connected:', socket.id);

  // Send current online users to newly connected client
  const onlineMap = await redisClient.hgetall('online_users') || {};
  socket.emit('online_users', Object.keys(onlineMap));

  // ── join ─────────────────────────────────────────────────────────────────
  socket.on('join', async (userId) => {
    socket.userId = userId;
    await redisClient.hset('online_users', userId, socket.id);

    // Mark online in MongoDB
    await User.findByIdAndUpdate(userId, { online_status: 'online' }).catch(() => {});

    const updatedMap = await redisClient.hgetall('online_users') || {};
    io.emit('online_users', Object.keys(updatedMap));
    console.log(`User ${userId} joined`);
  });

  // ── send_message ──────────────────────────────────────────────────────────
  socket.on('send_message', async (data) => {
    try {
      const { sender, receiver, text } = data;
      const message = new Message({ sender, receiver, text });
      await message.save();
      await message.populate('sender receiver', 'username');

      const pair = [sender, receiver].sort().join('_');
      await redisClient.del(`messages:${pair}`);

      const messageObj = message.toJSON();

      const receiverSocketId = await getSocketId(receiver);
      if (receiverSocketId) io.to(receiverSocketId).emit('receive_message', messageObj);
      socket.emit('receive_message', messageObj);
    } catch (err) {
      console.error('Error in send_message:', err);
    }
  });

  // ── file_upload ───────────────────────────────────────────────────────────
  // data: { userId, receiverId, file: { type, url, filename, size } }
  socket.on('file_upload', async (data) => {
    try {
      const { userId, receiverId, file } = data;
      const record = await saveFileMetadata(userId, file);

      // Save as a message with type 'file'
      const message = new Message({
        sender: userId,
        receiver: receiverId,
        text: `📎 File: ${file.filename}`,
        fileData: record,
      });
      await message.save();
      await message.populate('sender receiver', 'username');

      const pair = [userId, receiverId].sort().join('_');
      await redisClient.del(`messages:${pair}`);

      const msgObj = message.toJSON();
      const receiverSocketId = await getSocketId(receiverId);
      if (receiverSocketId) io.to(receiverSocketId).emit('receive_message', msgObj);
      socket.emit('receive_message', msgObj);
      socket.emit('file_received', { success: true, record });
    } catch (err) {
      console.error('Error in file_upload:', err);
      socket.emit('file_received', { success: false, error: err.message });
    }
  });

  // ── game_start ────────────────────────────────────────────────────────────
  socket.on('game_start', async ({ userId }) => {
    try {
      const { createGame } = require('./services/gameService');
      const result = await createGame(userId);
      if (result.alreadyInGame) return socket.emit('game_error', 'You are already in a game!');
      if (result.alreadyWaiting) return socket.emit('game_error', 'You already have a waiting game. Share the link!');
      socket.emit('game_created', { session: result.session });
    } catch (err) {
      socket.emit('game_error', err.message);
    }
  });

  // ── game_join ─────────────────────────────────────────────────────────────
  socket.on('game_join', async ({ userId }) => {
    try {
      const { joinGame } = require('./services/gameService');
      const result = await joinGame(userId);
      if (result.error === 'already_in_game') return socket.emit('game_error', 'You are already in a game!');
      if (result.error === 'no_waiting_session') return socket.emit('game_error', 'No waiting game. Ask someone to start one first!');

      const { session, player1Id } = result;
      const player2 = await User.findById(userId).select('username');
      const player1 = await User.findById(player1Id).select('username');

      const gameState = {
        sessionId: session._id,
        player1: { id: player1Id, username: player1?.username },
        player2: { id: userId, username: player2?.username },
        round: 1, scores: { [player1Id]: 0, [userId]: 0 },
        status: 'in_progress',
      };

      // Notify both players
      socket.emit('game_started', gameState);
      await emitToUser(player1Id, 'game_started', gameState);
    } catch (err) {
      socket.emit('game_error', err.message);
    }
  });

  // ── game_move ─────────────────────────────────────────────────────────────
  // data: { userId, move: 'rock'|'paper'|'scissors' }
  socket.on('game_move', async ({ userId, move }) => {
    try {
      const result = await submitMove(userId, move);

      if (result.error === 'not_in_game') return socket.emit('game_error', 'You are not in a game!');
      if (result.error === 'invalid_move') return socket.emit('game_error', 'Invalid move. Choose rock, paper, or scissors.');
      if (result.error === 'already_moved') return socket.emit('game_error', 'You already made your move! Waiting for opponent...');

      if (result.waiting) {
        socket.emit('game_waiting', { message: `${move} noted! Waiting for opponent...` });
        return;
      }

      // Round resolved — send update to BOTH players
      const { roundResult, opponentId } = result;
      const update = { roundResult, session: result.session };

      socket.emit('game_update', update);
      await emitToUser(opponentId, 'game_update', update);
    } catch (err) {
      socket.emit('game_error', err.message);
    }
  });

  // ── game_abandon ───────────────────────────────────────────────────────────
  // Fires when a player closes the chat window mid-game
  socket.on('game_abandon', async ({ userId }) => {
    try {
      const { opponentId } = await abandonGame(userId);
      if (opponentId) {
        await emitToUser(opponentId, 'game_ended', { reason: 'opponent_left' });
      }
    } catch (err) {
      console.error('Error in game_abandon:', err);
    }
  });

  // ── call_initiate ─────────────────────────────────────────────────────────
  // data: { callerId, calleeId, type: 'audio'|'video' }
  socket.on('call_initiate', async ({ callerId, calleeId, type }) => {
    try {
      const result = await initiateCall(callerId, calleeId, type);
      if (result.error === 'callee_busy') {
        return socket.emit('call_error', 'User is already on a call.');
      }
      const caller = await User.findById(callerId).select('username');
      socket.emit('call_ringing', { calleeId, type });
      await emitToUser(calleeId, 'call_incoming', {
        callerId, callerName: caller?.username, type
      });
    } catch (err) {
      socket.emit('call_error', err.message);
    }
  });

  // ── call_respond ──────────────────────────────────────────────────────────
  // data: { calleeId, response: 'accept'|'reject' }
  socket.on('call_respond', async ({ calleeId, response }) => {
    try {
      const callInfo = response === 'accept'
        ? await acceptCall(calleeId)
        : await rejectCall(calleeId);

      if (!callInfo) return socket.emit('call_error', 'No incoming call found.');

      const callee = await User.findById(calleeId).select('username');
      const payload = { calleeId, calleeName: callee?.username, response };

      socket.emit('call_response_sent', payload);
      await emitToUser(callInfo.caller, 'call_response', payload);
    } catch (err) {
      socket.emit('call_error', err.message);
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    let userIdToRemove = socket.userId;

    if (!userIdToRemove) {
      const allUsers = await redisClient.hgetall('online_users') || {};
      for (const [key, val] of Object.entries(allUsers)) {
        if (val === socket.id) { userIdToRemove = key; break; }
      }
    }

    if (userIdToRemove) {
      const currentSocketId = await redisClient.hget('online_users', userIdToRemove);
      if (currentSocketId === socket.id) {
        await redisClient.hdel('online_users', userIdToRemove);
        // Update MongoDB last_seen + online_status
        await User.findByIdAndUpdate(userIdToRemove, {
          online_status: 'offline',
          last_seen: new Date(),
        }).catch(() => {});
        // Bust user list cache so next fetch returns fresh last_seen
        await redisClient.del('users:all');

        const updatedMap = await redisClient.hgetall('online_users') || {};
        io.emit('online_users', Object.keys(updatedMap));
      }
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
