import mongoose from "mongoose";

const locationSchema = new mongoose.Schema(
  {
    country: { type: String },
    city: { type: String },
    area: { type: String },
    coordinates: {
      lat: Number,
      lng: Number,
    },
  },
  { _id: false }
);

/* -------- IMAGE SCHEMA -------- */
const imageSchema = new mongoose.Schema(
  {
    url: { type: String },
    publicId: { type: String },
  },
  { _id: false }
);

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      unique: true,
    },

    name: { type: String },

    age: { type: Number },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    maritalStatus: {
      type: String,
      enum: ["single", "divorced", "widowed"],
    },

    height: Number,
    weight: Number,

    skinTone: {
      type: String,
      enum: [
        "black",
        "dark-brown",
        "brown",
        "light-brown",
        "olive",
        "fair",
        "very-fair",
        "white",
        "any",
      ],
    },

    preferredSkinTone: {
      type: String,
      enum: [
        "black",
        "dark-brown",
        "brown",
        "light-brown",
        "olive",
        "fair",
        "very-fair",
        "white",
        "any",
      ],
    },

    profession: String,
    education: String,

    bio: { type: String, maxlength: 500 },

    relationshipGoal: {
      type: String,
      enum: ["casual", "serious", "marriage"],
    },

    lookingForGender: {
      type: String,
      enum: ["male", "female", "any"],
    },

    minAge: Number,
    maxAge: Number,

    lifestyle: {
      type: String,
      enum: ["smoker", "non-smoker"],
    },

    location: locationSchema,

    /* -------- IMAGES -------- */
    avatar: imageSchema,

    photos: {
      type: [imageSchema],
      validate: [(arr) => arr.length <= 6, "Maximum 6 photos allowed"],
    },
  },
  { timestamps: true }
);

const profileModel =
  mongoose.models.profile || mongoose.model("profile", profileSchema);

export default profileModel;
