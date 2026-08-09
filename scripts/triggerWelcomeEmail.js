// Manually trigger welcome email for testing
import { User } from "../utils/models.js";
import { createWelcomeCouponForUser } from "../utils/couponGenerator.js";
import { sendWelcomeEmail } from "../utils/email.js";
import mongoose from "mongoose";

const triggerWelcome = async (email) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    
    if (!user) {
      console.log("User not found");
      process.exit(1);
    }
    
    console.log("Creating welcome coupon for:", user.email);
    const coupon = await createWelcomeCouponForUser(user.email);
    console.log("Coupon created:", coupon.code);
    
    console.log("Sending welcome email...");
    const sent = await sendWelcomeEmail(user.email, user.username, coupon.code);
    console.log("Email sent:", sent);
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

const email = process.argv[2];
if (!email) {
  console.log("Usage: node triggerWelcomeEmail.js <email>");
  process.exit(1);
}

triggerWelcome(email);
