// src/utils/updateLastActive.js
import User from "../models/userModel.js";

export const updateLastActive = async (userId) => {
  if (!userId) return;

  // Optional: normalize to string if you ever receive ObjectId
  const id = String(userId);

  try {
    const result = await User.findByIdAndUpdate(
      id,
      { $set: { lastActive: new Date() } }, // $set is more explicit
      { 
        timestamps: false,
        // Optional: only update if document exists (slightly safer)
        upsert: false 
      }
    );

    if (!result) {
      // Document didn't exist — rare but possible after user deletion
      console.debug(`No user found for lastActive update: ${id}`);
    }
  } catch (err) {
    // Distinguish between different kinds of errors if you want
    if (err.name === 'CastError') {
      console.warn(`Invalid userId format for lastActive: ${id}`);
    } else {
      console.warn(`Failed to update lastActive for user ${id}:`, err.message);
    }
  }
};