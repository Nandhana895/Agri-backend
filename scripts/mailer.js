const nodemailer = require('nodemailer');
const config = require('../config/config');

let cachedTransporter = null;

async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (config.SMTP_USER && config.SMTP_PASS) {
    cachedTransporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass }
    });
  }
  return cachedTransporter;
}

async function sendMail({ to, subject, html, text }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({
    from: config.MAIL_FROM,
    to,
    subject,
    text,
    html
  });
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log('📧 Preview URL:', previewUrl);
  }
  return info;
}

module.exports = { sendMail };


