import mongoose from "mongoose";

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
    },

    lastRead: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
      },
    ],
  },
  { timestamps: true }
);

// Keep only this compound index
conversationSchema.index({ participants: 1 });

const Conversation =
  mongoose.models.Conversation ||
  mongoose.model("Conversation", conversationSchema);

export default Conversation;
