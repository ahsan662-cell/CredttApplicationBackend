require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const mime = require('mime-types');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

const allowedOrigins = [
  "https://ahsan662-cell.github.io",
  "https://ahsan662-cell.github.io/CredttApplication/",
  "http://localhost:3000"
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("CORS Error: Origin not allowed"));
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.FROM_EMAIL,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((err) => {
  if (err) console.error(" Email connection failed:", err);
  else console.log("Email service ready");
});

app.get("/", (req, res) => {
  res.send("<h2> Credit Application Backend is Running</h2>");
});

app.post(
  "/submit-form",
  upload.fields([
    { name: "formPdf", maxCount: 1 },
    { name: "files", maxCount: 3 },
  ]),
  async (req, res) => {
    try {
      const pdfFile = req.files?.formPdf?.[0];
      const extraFiles = req.files?.files || [];
      const formFields = req.body || {};

      if (!pdfFile) {
        return res.status(400).json({ ok: false, message: "Missing PDF file" });
      }

      const htmlBody = `
        <h2>📄 New Credit Application Received</h2>
        <p>Attached is the submitted PDF and ${extraFiles.length} additional file(s).</p>
      `;

      const attachments = [
        {
          filename: pdfFile.originalname,
          path: pdfFile.path,
          contentType: mime.lookup(pdfFile.path),
        },
        ...extraFiles.map((f) => ({
          filename: f.originalname,
          path: f.path,
          contentType: mime.lookup(f.path),
        })),
      ];

      const info = await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: process.env.ADMIN_EMAIL,
        subject: `New Form Submission`,
        html: htmlBody,
        attachments,
      });

      [pdfFile, ...extraFiles].forEach((f) => {
        if (f && fs.existsSync(f.path)) fs.unlinkSync(f.path);
      });

      console.log("Email sent:", info.response);

      res.json({
        ok: true,
        message: "Email sent successfully!",
        response: info.response,
      });
    } catch (err) {
      console.error("Error:", err);
      res.status(500).json({ ok: false, error: err.message });
    }
  }
);

module.exports = app;
