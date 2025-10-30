import multer from "multer";
import nodemailer from "nodemailer";
import mime from "mime-types";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

// Temporary directory
const UPLOAD_DIR = "/uploads";
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const safeName = `${Date.now()}-${file.originalname.replace(/\s+/g, "_")}`;
    cb(null, safeName);
  },
});

const upload = multer({ storage }).fields([
  { name: "formPdf", maxCount: 1 },
  { name: "files", maxCount: 3 },
]);

export const config = {
  api: {
    bodyParser: false, 
  },
};

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  upload(req, res, async (err) => {
    if (err) return res.status(500).json({ ok: false, error: err.message });

    try {
      const pdfFile = req.files?.formPdf?.[0];
      const extraFiles = req.files?.files || [];
      if (!pdfFile)
        return res.status(400).json({ ok: false, error: "Missing PDF file" });

      const formFields = req.body || {};
      let htmlBody = `<h2>📄 New Form Submission</h2><ul>`;
      for (const [k, v] of Object.entries(formFields)) {
        htmlBody += `<li><b>${k}:</b> ${v}</li>`;
      }
      htmlBody += `</ul><p>Attached is the submitted PDF and ${extraFiles.length} file(s).</p>`;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

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
        subject: `New Form Submission - ${formFields.name || "User"}`,
        html: htmlBody,
        attachments,
      });

      // Clean up
      [pdfFile, ...extraFiles].forEach(
        (f) => fs.existsSync(f.path) && fs.unlinkSync(f.path)
      );

      res.json({ ok: true, message: "Email sent successfully!", response: info.response });
    } catch (e) {
      console.error(e);
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}
