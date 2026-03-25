const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Game stats
  wins:        { type: Number, default: 0 },
  losses:      { type: Number, default: 0 },
  draws:       { type: Number, default: 0 },
  games_played:{ type: Number, default: 0 },
  // Presence
  last_seen:   { type: Date, default: null },
  online_status: { type: String, enum: ['online', 'offline'], default: 'offline' },
  // File history — keeps last 20 file metadata objects
  file_history: { type: Array, default: [] },
  // Activity log — last 10 entries
  activity_log: { type: Array, default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
