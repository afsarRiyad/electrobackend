// Quick script to check user verification status
import { User } from "../utils/models.js";
import mongoose from "mongoose";

const checkUser = async (email) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log("User not found");
      process.exit(1);
    }
    
    console.log("User Status:");
    console.log("Email:", user.email);
    console.log("Username:", user.username);
    console.log("Is Verified:", user.isVerified);
    console.log("Email Verified At:", user.emailVerifiedAt);
    console.log("OTP:", user.otp ? "Exists" : "None");
    console.log("OTP Expires:", user.otpExpires);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

const email = process.argv[2];
if (!email) {
  console.log("Usage: node checkUserVerification.js <email>");
  process.exit(1);
}

checkUser(email);
