const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  text: {
    type: String,
    required: true
  },
  // Optional: attached file metadata
  fileData: {
    type: Object,
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
