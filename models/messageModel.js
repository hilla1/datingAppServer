import mongoose from "mongoose";

// ---------- Attachment Sub-schema ----------
const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  type: { type: String, enum: ["image", "video", "file"], required: true },
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
      ref: "user",
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

// Compound index for fast conversation fetch
messageSchema.index({ conversationId: 1, createdAt: 1 });

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

export default Message;
