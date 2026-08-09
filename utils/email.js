import { generateOTP } from "./otp.js";

// Brevo API configuration
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// Send OTP verification email
export const sendOTPEmail = async (email, otp, username) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.error("Brevo API key not configured. Missing BREVO_API_KEY.");
      return false;
    }

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM || 'noreply@brevo.com',
          name: process.env.EMAIL_FROM_NAME || 'Electro'
        },
        to: [{ email: email }],
        subject: "Verify Your Email - OTP Code",
        htmlContent: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification OTP</title>
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #2563eb;">Verify Your Email Address</h2>
              <p>Hi ${username},</p>
              <p>Thank you for signing up for Electro! Please use the following OTP code to verify your email address:</p>
              <div style="text-align: center; margin: 30px 0; background-color: #f3f4f6; padding: 20px; border-radius: 8px;">
                <span style="font-size: 32px; font-weight: bold; color: #2563eb; letter-spacing: 5px;">${otp}</span>
              </div>
              <p>This OTP code will expire in 10 minutes.</p>
              <p>If you didn't create an account, please ignore this email.</p>
              <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                © ${new Date().getFullYear()} Electro. All rights reserved.
              </p>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await response.json();
    console.log("OTP email sent successfully:", data);
    return true;
  } catch (error) {
    console.error("OTP email error:", error);
    return false;
  }
};

// Send password reset email
export const sendPasswordResetEmail = async (email, resetToken, username) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.error("Brevo API key not configured. Missing BREVO_API_KEY.");
      return { success: false, error: "Email service not configured" };
    }

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM || 'noreply@brevo.com',
          name: process.env.EMAIL_FROM_NAME || 'Electro'
        },
        to: [{ email: email }],
        subject: "Password Reset Request",
        htmlContent: `
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
                <p>We received a request to reset your password for your Electro account.</p>
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
                <p>This is an automated email from Electro. Please do not reply to this message.</p>
                <p>© ${new Date().getFullYear()} Electro. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await response.json();
    console.log("Password reset email sent successfully:", data);
    return { success: true, messageId: data.messageId };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: error.message };
  }
};

// Send welcome email with coupon
export const sendWelcomeEmail = async (email, username, couponCode = null) => {
  try {
    if (!process.env.BREVO_API_KEY) {
      console.error("Brevo API key not configured. Missing BREVO_API_KEY.");
      return false;
    }

    const response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          email: process.env.EMAIL_FROM || 'noreply@brevo.com',
          name: process.env.EMAIL_FROM_NAME || 'Electro'
        },
        to: [{ email: email }],
        subject: "Welcome to Electro! 🎉 Your 40% OFF Coupon Inside",
        htmlContent: `
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
              .coupon-box {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 10px;
                text-align: center;
                margin: 25px 0;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
              }
              .coupon-code {
                font-size: 36px;
                font-weight: bold;
                letter-spacing: 3px;
                margin: 15px 0;
                font-family: 'Courier New', monospace;
                background: rgba(255,255,255,0.2);
                padding: 15px;
                border-radius: 5px;
                border: 2px dashed rgba(255,255,255,0.5);
              }
              .discount-text {
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 10px;
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
                <h1>🎉 Welcome to Electro!</h1>
              </div>
              <div class="content">
                <p>Hi <strong>${username}</strong>,</p>
                <p>Welcome to Electro! We're excited to have you on board.</p>
                <p>As a special welcome gift, we've prepared an exclusive offer just for you:</p>
                
                ${couponCode ? `
                <div class="coupon-box">
                  <div class="discount-text">🎁 40% OFF Your First Order!</div>
                  <div class="coupon-code">${couponCode}</div>
                  <p style="margin-top: 15px; font-size: 14px;">Use this code at checkout</p>
                  <p style="font-size: 12px; opacity: 0.9;">Valid for 1 month • Single use only</p>
                </div>
                ` : ''}
                
                <p>Your account has been successfully created and you can now:</p>
                <ul>
                  <li>🛒 Browse our wide range of electronics</li>
                  <li>💳 Make secure purchases</li>
                  <li>📋 Track your orders</li>
                  <li>❤️ Save items to your wishlist</li>
                </ul>
                <p style="text-align: center;">
                  <a href="${process.env.CLIENT_URL || 'http://localhost:5173'}/shop" class="button">Start Shopping</a>
                </p>
                <p>If you have any questions, feel free to reach out to our support team.</p>
              </div>
              <div class="footer">
                <p>This is an automated email from Electro. Please do not reply to this message.</p>
                <p>© ${new Date().getFullYear()} Electro. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      }),
    });

    const data = await response.json();
    console.log("Welcome email sent successfully:", data);
    return true;
  } catch (error) {
    console.error("Error sending welcome email:", {
      error: error.message,
      email: email,
      couponCode: couponCode,
      hasApiKey: !!process.env.BREVO_API_KEY
    });
    return false;
  }
};
