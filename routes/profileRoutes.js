import express from "express";
import { profileController } from "../controllers/profileController.js";
import userAuth from "../middleware/userAuth.js"; 

const profileRouter = express.Router();

// CRUD Operations
profileRouter.post("/", userAuth, profileController.createProfile);
profileRouter.get("/", userAuth, profileController.getAllProfiles); 
profileRouter.get("/:id", userAuth, profileController.getProfileById);
profileRouter.put("/:id", userAuth, profileController.updateProfile); 
profileRouter.patch("/:id", userAuth, profileController.patchProfile);
profileRouter.delete("/:id", userAuth, profileController.deleteProfile);

// User-specific route
profileRouter.post("/user", userAuth, profileController.getProfileByUserId); 
profileRouter.post("/avatar", userAuth, profileController.updateAvatar);

// Special operations
profileRouter.patch("/:id/location", userAuth, profileController.updateProfileLocation);
profileRouter.post("/photos", userAuth, profileController.updateProfilePhotos); 
profileRouter.delete("/:id/photos", userAuth, profileController.removeProfilePhoto); 

export default profileRouter;
