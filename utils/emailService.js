import nodemailer from 'nodemailer';

/**
 * Create email transporter using Brevo (Sendinblue)
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: process.env.BREVO_SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_FROM || process.env.BREVO_API_KEY,
      pass: process.env.BREVO_API_KEY,
    },
  });
};

/**
 * Send OTP email
 */
export const sendOTPEmail = async (email, otp, purpose = 'signup') => {
  try {
    const transporter = createTransporter();
    
    const subject = purpose === 'signup' 
      ? 'Verify Your Email Address' 
      : purpose === 'forgot-password'
      ? 'Reset Your Password'
      : 'Your Verification Code';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification</title>
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
            text-align: center;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 20px;
          }
          .otp-code {
            font-size: 36px;
            font-weight: bold;
            color: #0066cc;
            letter-spacing: 8px;
            margin: 30px 0;
            padding: 20px;
            background-color: #fff;
            border: 2px dashed #0066cc;
            border-radius: 8px;
          }
          .message {
            margin-bottom: 20px;
            color: #666;
          }
          .warning {
            color: #ff6600;
            font-size: 14px;
            margin-top: 20px;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">TechMart</div>
          <h2>${subject}</h2>
          <p class="message">
            ${purpose === 'signup' 
              ? 'Thank you for signing up! Please use the verification code below to complete your registration:' 
              : purpose === 'forgot-password'
              ? 'Please use the verification code below to reset your password:'
              : 'Please use the verification code below to complete your request:'}
          </p>
          <div class="otp-code">${otp}</div>
          <p class="message">
            This code will expire in 10 minutes.
          </p>
          <p class="warning">
            If you didn't request this code, please ignore this email.
          </p>
          <div class="footer">
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'TechMart'} <${process.env.EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || 'noreply@techmart.com'}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending error:', error);
    throw new Error('Failed to send email');
  }
};

/**
 * Send welcome email after successful signup
 */
export const sendWelcomeEmail = async (email, username) => {
  try {
    const transporter = createTransporter();
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to TechMart</title>
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
            text-align: center;
          }
          .logo {
            font-size: 24px;
            font-weight: bold;
            color: #0066cc;
            margin-bottom: 20px;
          }
          .welcome-text {
            font-size: 18px;
            margin-bottom: 20px;
          }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background-color: #0066cc;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            font-size: 12px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">TechMart</div>
          <h1>Welcome, ${username}!</h1>
          <p class="welcome-text">
            Thank you for joining TechMart. Your account has been successfully verified.
          </p>
          <a href="${process.env.CLIENT_URL || 'https://techmart.com'}/account" class="button">
            Go to Your Account
          </a>
          <div class="footer">
            <p>This is an automated message. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const mailOptions = {
      from: `${process.env.EMAIL_FROM_NAME || 'TechMart'} <${process.env.EMAIL_FROM || process.env.BREVO_SENDER_EMAIL || 'noreply@techmart.com'}>`,
      to: email,
      subject: 'Welcome to TechMart!',
      html: htmlContent,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Welcome email error:', error);
    // Don't throw error for welcome email - it's not critical
    return { success: false };
  }
};
