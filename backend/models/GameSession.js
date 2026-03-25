/**
 * GameSession.js
 * MongoDB model for a 2-player RPS game session.
 */
const mongoose = require('mongoose');

const gameSessionSchema = new mongoose.Schema({
  player1:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  player2:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  status:   { type: String, enum: ['waiting', 'in_progress', 'finished'], default: 'waiting' },
  // Current round moves — keyed by userId string
  moves:    { type: Map, of: String, default: {} },
  // Best-of-3 scores — keyed by userId string
  scores:   { type: Map, of: Number, default: {} },
  round:    { type: Number, default: 1 },
  winner:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = mongoose.model('GameSession', gameSessionSchema);
