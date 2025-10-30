require('dotenv').config();
console.log('SMTP User:', process.env.SMTP_USER);

const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fieldSize: 25 * 1024 * 1024,
    fileSize: 25 * 1024 * 1024
  }
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

transporter.verify((err, success) => {
  if (err) console.error('❌ Email Error:', err);
  else console.log('✅ Email service ready');
});

app.get('/', (req, res) => {
  res.send('<h1>✅ Credit Form Backend is Running</h1>');
});

app.post('/submit-form', upload.fields([
  { name: 'formPdf', maxCount: 1 },
  { name: 'files', maxCount: 3 }
]), async (req, res) => {
  try {
    const pdfFile = req.files?.formPdf?.[0];
    const extraFiles = req.files?.files || [];

    console.log('📥 Files received:', { pdf: !!pdfFile, extras: extraFiles.length });

    if (!pdfFile) {
      return res.status(400).json({
        success: false,
        message: 'Missing PDF file'
      });
    }
    const formFields = req.body || {};
    let htmlBody =` <h2>📄 New Form Submission</h2><ul>;
    for (const [${k}, ${v}] of Object.entries(formFields)) {
      htmlBody += <li><b>${k}:</b> ${v}</li>;
    }
    htmlBody += </ul><p>Attached is the submitted PDF and ${extraFiles.length} file(s).</p>`;

    const attachments = [
      { filename: pdfFile.originalname, path: pdfFile.path, contentType: mime.lookup(pdfFile.path) },
      ...extraFiles.map(f => ({
        filename: f.originalname,
        path: f.path,
        contentType: mime.lookup(f.path)
      }))
    ];


    console.log('📧 Sending email to admin:', process.env.ADMIN_EMAIL);
    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `New Credit Application `,
      html: htmlBody,
      attachments: attachments
    });

    console.log('✅ Admin email sent');

    return res.json({
      success: true,
      message: 'Application submitted! Check your email for confirmation. You can download the PDF from the email.'
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error: ' + err.message
    });
  }
});

module.exports = app;