import express from "express";
import userAuth from "../middleware/userAuth.js";
import { changePassword, getEmailByRole, getUserData, updateProfile } from "../controllers/userController.js";

const userRouter = express.Router();

userRouter.get('/data', userAuth, getUserData);
userRouter.get('/emails-by-role', userAuth, getEmailByRole);
userRouter.patch('/update-profile', userAuth, updateProfile);
userRouter.patch('/change-password', userAuth, changePassword);   
export default userRouter;