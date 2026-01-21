// src/models/messageModel.js
import mongoose from "mongoose";

// ---------- Attachment Sub-schema ----------
const attachmentSchema = new mongoose.Schema({
  url: {
    type: String,
    required: true,
    trim: true,
  },
  publicId: {
    type: String,
    required: true, // critical for deletion
    trim: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ["image", "video", "file"],
    required: true,
  },
});

// ---------- Main Message Schema ----------
const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user", // assuming your user model is named "user"
      required: true,
      index: true,
    },

    content: {
      type: String,
      trim: true,
      default: "",
    },

    attachments: {
      type: [attachmentSchema],
      default: [],
    },

    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
      index: true,
    },

    readBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "user",
      default: [],
      index: true,
    },

    deletedBy: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "user",
      default: [],
    },

    edited: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound index for fast conversation message fetching
messageSchema.index({ conversationId: 1, createdAt: 1 });

// Optional: Auto-clean Cloudinary files when message is hard-deleted
messageSchema.pre("findOneAndDelete", async function (next) {
  try {
    const message = await this.model.findOne(this.getFilter());
    if (message && message.attachments?.length > 0) {
      for (const att of message.attachments) {
        if (att.publicId) {
          try {
            const { deleteFromCloudinary } = await import("../middleware/uploadMiddleware.js");
            await deleteFromCloudinary(att.publicId);
          } catch (err) {
            console.error(`Failed to delete Cloudinary file ${att.publicId}:`, err);
          }
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;