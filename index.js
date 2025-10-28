require('dotenv').config();
console.log(process.env.SMTP_USER);
const express = require('express');
const multer  = require('multer');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const mime = require('mime-types');
const cors = require("cors");
const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

const allowedHeaders = ["https://ahsan662-cell.github.io/CredttApplication/"]

app.use(cors({
    origin: function(origin, callback){
        if(!origin) return callback(null, true);

        if(allowedHeaders.includes(origin)){
            callback(null, true);
        } else {
            callback(new Error("CORS Error: Origin not allowed"));
        }
    },
}));
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);


const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fieldSize: 25 * 1024 * 1024,
  },
});

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

app.get('/', (req, res) => res.send('✅ Gmail backend is running'));

app.post('/submit-form', upload.fields([
  { name: 'formPdf', maxCount: 1 },
  { name: 'files', maxCount: 3 }
]), async (req, res) => {
  try {
    const pdfFile = req.files?.formPdf?.[0];
    console.log(pdfFile);
    const extraFiles = req.files?.files || [];
    if (!pdfFile) return res.status(400).json({ ok: false, error: "Missing PDF file" });

    const formFields = req.body || {};
    let htmlBody = `<h2>📄 New Form Submission</h2><ul>`;
    for (const [k, v] of Object.entries(formFields)) {
      htmlBody += `<li><b>${k}:</b> ${v}</li>`;
    }
    htmlBody += `</ul><p>Attached is the submitted PDF and ${extraFiles.length} file(s).</p>`;

    const attachments = [
      { filename: pdfFile.originalname, path: pdfFile.path, contentType: mime.lookup(pdfFile.path) },
      ...extraFiles.map(f => ({
        filename: f.originalname,
        path: f.path,
        contentType: mime.lookup(f.path)
      }))
    ];

    const info = await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: process.env.ADMIN_EMAIL,
      subject: `New Form Submission - ${formFields.name || 'User'}`,
      html: htmlBody,
      attachments
    });

    [pdfFile, ...extraFiles].forEach(f => fs.existsSync(f.path) && fs.unlinkSync(f.path));

    res.json({ ok: true, message: "Email sent successfully!", response: info.response });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(process.env.PORT || 3000, () =>
  console.log(`🚀 Server running on http://localhost:${process.env.PORT || 3000}`)
);
