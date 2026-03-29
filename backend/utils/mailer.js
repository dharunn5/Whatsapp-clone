const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_EMAIL || '',
    pass: process.env.SMTP_PASSWORD || ''
  }
});

const sendOTP = async (toEmail, otp) => {
  if (!process.env.SMTP_EMAIL || !process.env.SMTP_PASSWORD) {
    console.log(`\n\n--------------------------------------------`);
    console.log(`[DEV MODE] 🔔 OTP for ${toEmail} is: ${otp}`);
    console.log(`--------------------------------------------\n\n`);
    return true; // Simulate success if no credentials
  }

  const mailOptions = {
    from: process.env.SMTP_EMAIL,
    to: toEmail,
    subject: 'WhatsApp Web Clone - Verify your email',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-top: 5px solid #25D366; border-radius: 8px;">
        <h2 style="color: #111b21;">Welcome to WhatsApp Web Clone!</h2>
        <p style="color: #444; line-height: 1.6;">Thank you for registering. Please use the verification code below to complete your account creation:</p>
        <div style="background-color: #f0f2f5; padding: 15px; text-align: center; border-radius: 5px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #128C7E;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 13px;">This code will expire in 10 minutes. If you did not request this code, you can safely ignore this email.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP };
