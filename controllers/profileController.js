import Profile from "../models/profileModel.js";
import { ApiFeatures } from "../utils/apiFeatures.js";

/* --------------- CREATE PROFILE --------------- */
const createProfile = async (req, res, next) => {
  try {
    const existingProfile = await Profile.findOne({ user: req.userId });
    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Profile already exists for this user",
      });
    }

    const { avatar, ...rest } = req.body;

    const profileData = {
      user: req.userId,
      ...rest,
      avatar: avatar
        ? typeof avatar === "string"
          ? { url: avatar }
          : avatar
        : undefined,
    };

    const profile = await Profile.create(profileData);

    res.status(201).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- GET PROFILE BY ID ---------------- */
const getProfileById = async (req, res, next) => {
  try {
    const profile = await Profile.findById(req.params.id).populate("user");
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- GET PROFILE BY USER ID ---------------- */
const getProfileByUserId = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.userId });
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- GET ALL PROFILES (excluding current user) ---------------- */
const getAllProfiles = async (req, res, next) => {
  try {
    // Build base query — exclude the current user's profile
    let query = Profile.find({ user: { $ne: req.userId } });

    const totalProfiles = await Profile.countDocuments({ user: { $ne: req.userId } });

    const apiFeatures = new ApiFeatures(query, req.query)
      .search()
      .filter()
      .sort()
      .paginate();

    const profiles = await apiFeatures.query;

    res.status(200).json({
      success: true,
      total: totalProfiles,
      count: profiles.length,
      data: profiles,
    });
  } catch (error) {
    next(error);
  }
};

/* ---------------- UPDATE PROFILE ---------------- */
const updateProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- PATCH PROFILE ---------------- */
const patchProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    Object.keys(req.body).forEach(
      (key) => (profile[key] = req.body[key])
    );

    await profile.save();

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- UPDATE PROFILE LOCATION ---------------- */
const updateProfileLocation = async (req, res, next) => {
  try {
    const profile = await Profile.findByIdAndUpdate(
      req.params.id,
      { location: req.body },
      { new: true, runValidators: true }
    );

    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
};

/* ---------------- UPDATE AVATAR ---------------- */
const updateAvatar = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.userId });
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    const { avatar } = req.body;

    profile.avatar =
      typeof avatar === "string"
        ? { url: avatar }
        : avatar;

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile.avatar,
    });
  } catch (error) {
    next(error);
  }
};

/* ---------------- UPDATE PROFILE PHOTOS ---------------- */
const updateProfilePhotos = async (req, res, next) => {
  try {
    const profile = await Profile.findOne({ user: req.userId });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    const { photos } = req.body;

    if (!Array.isArray(photos)) {
      return res.status(400).json({
        success: false,
        message: "Photos must be an array",
      });
    }

    if (photos.length > 6) {
      return res.status(400).json({
        success: false,
        message: "Maximum 6 photos allowed",
      });
    }

    for (const photo of photos) {
      if (!photo.url || !photo.publicId) {
        return res.status(400).json({
          success: false,
          message: "Each photo must include url and publicId",
        });
      }
    }

    profile.photos = photos;
    await profile.save();

    res.status(200).json({
      success: true,
      data: profile.photos,
    });
  } catch (error) {
    next(error);
  }
};

/* ---------------- REMOVE PROFILE PHOTO ---------------- */
const removeProfilePhoto = async (req, res, next) => {
  try {
    const profile = await Profile.findById(req.params.id);
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    profile.photos = profile.photos.filter(
      (p) => p.publicId !== req.body.publicId
    );

    await profile.save();

    res.status(200).json({
      success: true,
      data: profile.photos,
    });
  } catch (error) {
    next(error);
  }
};

/* ---------------- DELETE PROFILE ---------------- */
const deleteProfile = async (req, res, next) => {
  try {
    const profile = await Profile.findByIdAndDelete(req.params.id);
    if (!profile)
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });

    res.status(200).json({
      success: true,
      message: "Profile deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const profileController = {
  createProfile,
  getProfileById,
  getProfileByUserId,
  getAllProfiles,
  updateProfile,
  patchProfile,
  updateProfileLocation,
  updateAvatar,
  updateProfilePhotos,
  removeProfilePhoto,
  deleteProfile,
};