/**
 * services/fileService.js
 * Handles media/file metadata storage per user.
 * Stores metadata in the User document's file_history array.
 */
const User = require('../models/User');

/**
 * Save file metadata to a user's file_history.
 * fileData: { type, url, filename, size }
 */
const saveFileMetadata = async (userId, fileData) => {
  const record = {
    ...fileData,
    savedAt: new Date().toISOString(),
  };

  const user = await User.findById(userId);
  if (!user) return null;

  // Prepend and keep last 20
  user.file_history = [record, ...user.file_history].slice(0, 20);
  await user.save();
  return record;
};

/**
 * Get file history for a user.
 */
const getFileHistory = async (userId) => {
  const user = await User.findById(userId).select('file_history');
  return user ? user.file_history : [];
};

module.exports = { saveFileMetadata, getFileHistory };
