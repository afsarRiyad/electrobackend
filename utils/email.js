import nodemailer from "nodemailer";

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === "true", // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Send email verification email
export const sendVerificationEmail = async (email, verificationToken, username) => {
  try {
    const transporter = createTransporter();
    
    // Create verification URL (adjust frontend URL as needed)
    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'TechMart'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2563eb;">Verify Your Email Address</h2>
            <p>Hi ${username},</p>
            <p>Thank you for signing up for TechMart! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
            <p>This link will expire in 24 hours.</p>
            <p>If you didn't create an account, please ignore this email.</p>
            <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
              © ${new Date().getFullYear()} TechMart. All rights reserved.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error("Email verification error:", error);
    return false;
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    const transporter = createTransporter();
    
    // Create reset URL (adjust frontend URL as needed)
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'TechMart'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2c3e50;
              margin: 0;
            }
            .content {
              background-color: #ffffff;
              padding: 25px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              background-color: #3498db;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .button:hover {
              background-color: #2980b9;
            }
            .footer {
              text-align: center;
              color: #7f8c8d;
              font-size: 12px;
              margin-top: 20px;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${username}</strong>,</p>
              <p>We received a request to reset your password for your TechMart account.</p>
              <p>Click the button below to reset your password:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </p>
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #3498db;">${resetUrl}</p>
              <div class="warning">
                <p><strong>⚠️ Important:</strong></p>
                <ul>
                  <li>This link will expire in <strong>1 hour</strong></li>
                  <li>If you didn't request this, please ignore this email</li>
                  <li>Never share your password reset link with anyone</li>
                </ul>
              </div>
            </div>
            <div class="footer">
              <p>This is an automated email from TechMart. Please do not reply to this message.</p>
              <p>© ${new Date().getFullYear()} TechMart. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Password reset email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error.message };
  }
};

// Send welcome email
export const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || 'TechMart'}" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Welcome to TechMart!",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 8px;
              padding: 30px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2c3e50;
              margin: 0;
            }
            .content {
              background-color: #ffffff;
              padding: 25px;
              border-radius: 6px;
              margin-bottom: 20px;
            }
            .button {
              display: inline-block;
              background-color: #27ae60;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .button:hover {
              background-color: #219a52;
            }
            .footer {
              text-align: center;
              color: #7f8c8d;
              font-size: 12px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to TechMart!</h1>
            </div>
            <div class="content">
              <p>Hi <strong>${username}</strong>,</p>
              <p>Welcome to TechMart! We're excited to have you on board.</p>
              <p>Your account has been successfully created and you can now:</p>
              <ul>
                <li>🛒 Browse our wide range of electronics</li>
                <li>💳 Make secure purchases</li>
                <li>📋 Track your orders</li>
                <li>❤️ Save items to your wishlist</li>
              </ul>
              <p style="text-align: center;">
                <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop" class="button">Start Shopping</a>
              </p>
              <p>If you have any questions, feel free to reach out to our support team.</p>
            </div>
            <div class="footer">
              <p>This is an automated email from TechMart. Please do not reply to this message.</p>
              <p>© ${new Date().getFullYear()} TechMart. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Welcome email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return { success: false, error: error.message };
  }
};
