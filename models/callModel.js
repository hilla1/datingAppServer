import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },

    callType: {
      type: String,
      enum: ["audio", "video"],
      required: true,
    },

    status: {
      type: String,
      enum: ["missed", "answered", "rejected", "ended"],
      default: "missed",
    },

    startedAt: Date,
    endedAt: Date,

    duration: {
      type: Number, // seconds
      default: 0,
    },
  },
  { timestamps: true }
);

const callModel =
  mongoose.models.call || mongoose.model("call", callSchema);

export default callModel;
