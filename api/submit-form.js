require('dotenv').config();
console.log('SMTP User:', process.env.SMTP_USER);
const express = require('express');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const allowedOrigins = ["http://127.0.0.1:5500","https://ahsan662-cell.github.io"]
app.use(cors({
  origin: function(origin, callback){
    if(!origin) return callback(null, true);
    if(allowedOrigins.includes(origin)){
        callback(null, true);
    } else {
        callback(new Error("CORS Error: Origin not allowed"));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fieldSize: 50 * 1024 * 1024,
    fileSize: 50 * 1024 * 1024
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
  if (err) console.error('Email Error:', err);
  else console.log('Email service ready');
});

app.get('/', (req, res) => {
  res.send('<h1> Credit Form Backend is Running</h1>');
});

app.post('/submit-form', upload.fields([
  { name: 'formPdf', maxCount: 1 },
  { name: 'files', maxCount: 3 }
]), async (req, res) => {
  try {
    const {email} = req.body;
    const pdfFile = req.files?.formPdf?.[0];
    const extraFiles = req.files?.files || [];

    console.log('Files received:', { pdf: !!pdfFile, extras: extraFiles.length });

    if (!pdfFile) {
      return res.status(400).json({
        success: false,
        message: 'Missing PDF file'
      });
    }

    const formFields = req.body || {};
    const attachments = [
      {
        filename: 'credit_application.pdf',
        content: pdfFile.buffer, 
        contentType: 'application/pdf'
      },
      ...extraFiles.map(f => ({
        filename: f.originalname,
        content: f.buffer, 
        contentType: f.mimetype || 'application/octet-stream'
      }))
    ];

    let htmlBody = `<h2>📄 New Form Submission</h2><br/>
    <p>Attached is the submitted PDF and ${extraFiles.length} file(s).</p>`;

    console.log('📧 Sending email to admin:', process.env.ADMIN_EMAIL);
    await transporter.sendMail({
      from: email,
      to: [
        process.env.ADMIN_EMAIL1,
        process.env.ADMIN_EMAIL2, 
        process.env.ADMIN_EMAIL3
      ].filter(Boolean), 
      subject: `New Credit Application`,
      html: htmlBody,
      attachments: attachments
    });



    return res.json({
      success: true,
      message: 'Application submitted! Check your email for confirmation. You can download the PDF from the email.'
    });

  } catch (err) {
    console.error('Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Error: ' + err.message
    });
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Server error: ' + err.message
  });
});

module.exports = app;