const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");

const ffmpegPath = require("ffmpeg-static");

// ASAR içindeki çalıştırılabilir dosyalar doğrudan çalıştırılamaz.
// Executable files cannot be launched directly from inside ASAR.
// electron-builder bunları app.asar.unpacked klasörüne çıkarır.
// electron-builder extracts them into the app.asar.unpacked directory.
const ffmpegExecutablePath =
  ffmpegPath &&
  ffmpegPath.includes("app.asar")
    ? ffmpegPath.replace(
        "app.asar",
        "app.asar.unpacked"
      )
    : ffmpegPath;
const sharp = require("sharp");
const PDFDocument = require("pdfkit");
const { parse } = require("csv-parse/sync");
const { PDFParse } = require("pdf-parse");
const archiver = require("archiver");

const app = express();
const PORT = 3000;

const sofficePath =
  "C:\\Program Files\\LibreOffice\\program\\soffice.com";

const dataDirectory =
  process.env.CONVERTER_DATA_DIR || __dirname;

// Geçici yükleme ve çıktı dosyaları uygulama klasörüne değil,
// Temporary uploads and converted files are stored outside the app folder,
// kullanıcının yazma izni olan veri klasörüne alınır.
// inside a user-writable data directory.
const uploads = path.join(
  dataDirectory,
  "uploads"
);

const outputs = path.join(
  dataDirectory,
  "outputs"
);

fs.mkdirSync(uploads, { recursive: true });
fs.mkdirSync(outputs, { recursive: true });

function deleteFile(filePath) {
  // Dönüşüm tamamlandığında geçici dosyaları güvenli şekilde temizler.
  // Safely removes temporary files after conversion completes.
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Dosya silinemedi:", error.message);
  }
}

function cleanFolder(folder) {
  // Uygulama açılırken yarım kalmış eski dönüşümleri temizler.
  // Removes leftover files from interrupted conversions on startup.
  for (const item of fs.readdirSync(folder)) {
    const itemPath = path.join(folder, item);

    if (fs.statSync(itemPath).isFile()) {
      deleteFile(itemPath);
    }
  }
}

cleanFolder(uploads);
cleanFolder(outputs);

const allowedExtensions = new Set([
  ".mp4",
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".ogg",
  ".aac",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".docx",
  ".pptx",
  ".xlsx",
  ".odt",
  ".odp",
  ".ods",
  ".txt",
  ".csv",
  ".rtf",
  ".html",
  ".htm",
  ".pdf"
]);

const imageExtensions = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

const audioExtensions = new Set([
  ".mp3",
  ".wav",
  ".m4a",
  ".flac",
  ".ogg",
  ".aac"
]);

const videoExtensions = new Set([
  ".mp4"
]);

const documentExtensions = new Set([
  ".docx",
  ".pptx",
  ".xlsx",
  ".odt",
  ".odp",
  ".ods",
  ".txt",
  ".csv",
  ".rtf",
  ".html",
  ".htm",
  ".pdf"
]);

const audioFormats = new Set([
  "mp3",
  "wav",
  "m4a",
  "flac",
  "ogg"
]);

const imageTargetFormats = new Set([
  "jpg",
  "png",
  "webp",
  "pdf"
]);

const pdfTargetFormats = new Set([
  "txt",
  "docx",
  "png",
  "jpg"
]);

const upload = multer({
  dest: uploads,
  limits: {
    fileSize: 500 * 1024 * 1024
  },
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return callback(
        new Error("Bu dosya türü henüz desteklenmiyor.")
      );
    }

    callback(null, true);
  }
});

app.use(express.static(path.join(__dirname, "public")));

function sendConvertedFile(res, outputPath, downloadName) {
  res.download(outputPath, downloadName, (error) => {
    deleteFile(outputPath);

    if (error) {
      console.error("İndirme hatası:", error.message);
    }
  });
}

app.post("/convert", (req, res) => {
  upload.single("file")(req, res, async (uploadError) => {
    if (uploadError) {
      if (uploadError.code === "LIMIT_FILE_SIZE") {
        return res
          .status(413)
          .send("Dosya boyutu 500 MB'dan büyük olamaz.");
      }

      return res.status(400).send(
        uploadError.message || "Dosya yüklenemedi."
      );
    }

    if (!req.file) {
      return res.status(400).send("Lütfen bir dosya seç.");
    }

    const inputExtension = path
      .extname(req.file.originalname)
      .toLowerCase();

    const targetFormat = String(
      req.body.targetFormat || ""
    ).toLowerCase();

    const isVideo = videoExtensions.has(inputExtension);
    const isAudio = audioExtensions.has(inputExtension);
    const isImage = imageExtensions.has(inputExtension);
    const isDocument = documentExtensions.has(inputExtension);
    const isPdf = inputExtension === ".pdf";

    // Dönüşüm kontrolleri
    if ((isVideo || isAudio) && !audioFormats.has(targetFormat)) {
      deleteFile(req.file.path);

      return res.status(400).send(
        "Ses ve video dosyaları sadece ses formatlarına dönüştürülebilir."
      );
    }

    if (isImage && !imageTargetFormats.has(targetFormat)) {
      deleteFile(req.file.path);

      return res.status(400).send(
        "Bu görsel dönüşümü desteklenmiyor."
      );
    }

    if (isPdf && !pdfTargetFormats.has(targetFormat)) {
      deleteFile(req.file.path);

      return res.status(400).send(
        "PDF dosyaları TXT, DOCX, PNG veya JPG formatına dönüştürülebilir."
      );
    }

    if (isDocument && !isPdf && targetFormat !== "pdf") {
      deleteFile(req.file.path);

      return res.status(400).send(
        "Bu dosya türü şimdilik sadece PDF'e dönüştürülebilir."
      );
    }

    if (!isVideo && !isAudio && !isImage && !isDocument) {
      deleteFile(req.file.path);

      return res.status(400).send(
        "Bu dosya türü henüz desteklenmiyor."
      );
    }

    // PDF -> PNG / JPG
    if (
      isPdf &&
      ["png", "jpg"].includes(targetFormat)
    ) {
      let parser;

      try {
        parser = new PDFParse({
          data: fs.readFileSync(req.file.path)
        });

        const result = await parser.getScreenshot({
          scale: 1.5,
          imageBuffer: true
        });

        await parser.destroy();
        parser = null;

        const pages = result.pages;

        if (!pages || pages.length === 0) {
          throw new Error("PDF sayfası bulunamadı.");
        }

        if (pages.length === 1) {
          const outputPath = path.join(
            outputs,
            `converted.${targetFormat}`
          );

          let imageBuffer = Buffer.from(pages[0].data);

          if (targetFormat === "jpg") {
            imageBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 90 })
              .toBuffer();
          }

          fs.writeFileSync(outputPath, imageBuffer);
          deleteFile(req.file.path);

          return sendConvertedFile(
            res,
            outputPath,
            `converted.${targetFormat}`
          );
        }

        const zipPath = path.join(
          outputs,
          "converted-pages.zip"
        );

        const zipStream = fs.createWriteStream(zipPath);
        const archive = archiver("zip", {
          zlib: { level: 9 }
        });

        const zipFinished = new Promise((resolve, reject) => {
          zipStream.once("close", resolve);
          zipStream.once("error", reject);
          archive.once("error", reject);
        });

        archive.pipe(zipStream);

        for (let i = 0; i < pages.length; i++) {
          let imageBuffer = Buffer.from(pages[i].data);
          let extension = "png";

          if (targetFormat === "jpg") {
            imageBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 90 })
              .toBuffer();

            extension = "jpg";
          }

          archive.append(imageBuffer, {
            name: `page-${i + 1}.${extension}`
          });
        }

        await archive.finalize();
        await zipFinished;

        deleteFile(req.file.path);

        return sendConvertedFile(
          res,
          zipPath,
          "converted-pages.zip"
        );
      } catch (error) {
        console.error(error);

        if (parser) {
          await parser.destroy().catch(() => {});
        }

        deleteFile(req.file.path);

        return res.status(500).send(
          "PDF görsele dönüştürülemedi."
        );
      }
    }

    // PDF -> TXT
    if (isPdf && targetFormat === "txt") {
      const outputPath = path.join(
        outputs,
        `${req.file.filename}.txt`
      );

      let parser;

      try {
        parser = new PDFParse({
          data: fs.readFileSync(req.file.path)
        });

        const result = await parser.getText();

        const cleanedText = result.text
          .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();

        fs.writeFileSync(
          outputPath,
          cleanedText,
          "utf8"
        );

        deleteFile(req.file.path);

        return sendConvertedFile(
          res,
          outputPath,
          "converted.txt"
        );
      } catch (error) {
        console.error(error);

        deleteFile(req.file.path);
        deleteFile(outputPath);

        return res.status(500).send(
          "PDF metni çıkarılamadı."
        );
      } finally {
        if (parser) {
          await parser.destroy().catch(() => {});
        }
      }
    }

    // PDF -> DOCX
    if (isPdf && targetFormat === "docx") {
      const pdfInputPath = path.join(
        uploads,
        `${req.file.filename}.pdf`
      );

      const outputPath = path.join(
        outputs,
        `${req.file.filename}.docx`
      );

      try {
        fs.renameSync(req.file.path, pdfInputPath);
      } catch (error) {
        deleteFile(req.file.path);

        return res.status(500).send(
          "PDF hazırlanamadı."
        );
      }

 const helperPath =
  process.resourcesPath &&
  fs.existsSync(
    path.join(
      process.resourcesPath,
      "pdf_to_docx.exe"
    )
  )
    ? path.join(
        process.resourcesPath,
        "pdf_to_docx.exe"
      )
    : path.join(
        __dirname,
        "build",
        "pdf_to_docx.exe"
      );

const python = spawn(helperPath, [
  pdfInputPath,
  outputPath
]);

      let pythonError = "";
      let finished = false;

      const fail = (message) => {
        if (finished) return;

        finished = true;
        deleteFile(pdfInputPath);
        deleteFile(outputPath);

        res.status(500).send(message);
      };

      python.stderr.on("data", (data) => {
        pythonError += data.toString();
      });

      python.on("error", () => {
        fail("Python veya pdf2docx bulunamadı.");
      });

      python.on("close", (code) => {
        if (finished) return;

        deleteFile(pdfInputPath);

        if (code !== 0 || !fs.existsSync(outputPath)) {
          console.error(pythonError);
          return fail("PDF DOCX'e dönüştürülemedi.");
        }

        finished = true;

        sendConvertedFile(
          res,
          outputPath,
          "converted.docx"
        );
      });

      return;
    }

    // Görsel -> PDF
    if (isImage && targetFormat === "pdf") {
      const outputPath = path.join(
        outputs,
        `${req.file.filename}.pdf`
      );

      try {
        const imageBuffer = await sharp(req.file.path)
          .png()
          .toBuffer();

        const pdf = new PDFDocument({
          size: "A4",
          margin: 40
        });

        const outputStream = fs.createWriteStream(outputPath);

        pdf.pipe(outputStream);

        pdf.image(imageBuffer, 40, 40, {
          fit: [515, 760],
          align: "center",
          valign: "center"
        });

        pdf.end();

        outputStream.on("finish", () => {
          deleteFile(req.file.path);

          sendConvertedFile(
            res,
            outputPath,
            "converted.pdf"
          );
        });

        outputStream.on("error", () => {
          deleteFile(req.file.path);
          deleteFile(outputPath);

          res.status(500).send(
            "Görsel PDF'e dönüştürülemedi."
          );
        });
      } catch (error) {
        deleteFile(req.file.path);
        deleteFile(outputPath);

        res.status(500).send(
          "Görsel PDF'e dönüştürülemedi."
        );
      }

      return;
    }

    // Görsel -> Görsel
    if (isImage) {
      const outputPath = path.join(
        outputs,
        `${req.file.filename}.${targetFormat}`
      );

      try {
        await sharp(req.file.path)
          .toFormat(targetFormat)
          .toFile(outputPath);

        deleteFile(req.file.path);

        return sendConvertedFile(
          res,
          outputPath,
          `converted.${targetFormat}`
        );
      } catch (error) {
        console.error(error);

        deleteFile(req.file.path);
        deleteFile(outputPath);

        return res.status(500).send(
          "Görsel dönüştürülemedi."
        );
      }
    }

    // CSV -> PDF
    if (inputExtension === ".csv") {
      const outputPath = path.join(
        outputs,
        `${req.file.filename}.pdf`
      );

      try {
        const csvContent = fs
          .readFileSync(req.file.path, "utf8")
          .replace(/^\uFEFF/, "");

        const rows = parse(csvContent, {
          skip_empty_lines: true,
          relax_column_count: true
        });

        if (!rows.length) {
          throw new Error("CSV dosyası boş.");
        }

        const doc = new PDFDocument({
          size: "A4",
          margin: 40
        });

        const outputStream = fs.createWriteStream(outputPath);

        doc.pipe(outputStream);

        const columnCount = Math.max(
          ...rows.map((row) => row.length)
        );

        const pageWidth =
          doc.page.width -
          doc.page.margins.left -
          doc.page.margins.right;

        const rawWidths = Array.from(
          { length: columnCount },
          (_, columnIndex) => {
            const longestValue = Math.max(
              ...rows.map((row) =>
                String(row[columnIndex] || "").length
              )
            );

            return Math.min(
              160,
              Math.max(70, longestValue * 6 + 20)
            );
          }
        );

        const totalWidth = rawWidths.reduce(
          (sum, width) => sum + width,
          0
        );

        const scale = Math.min(
          1,
          pageWidth / totalWidth
        );

        const columnWidths = rawWidths.map(
          (width) => width * scale
        );

        let y = 40;
        const rowHeight = 24;

        rows.forEach((row, rowIndex) => {
          if (y + rowHeight > 780) {
            doc.addPage();
            y = 40;
          }

          let x = 40;

          for (
            let columnIndex = 0;
            columnIndex < columnCount;
            columnIndex++
          ) {
            const width = columnWidths[columnIndex];
            const value = String(
              row[columnIndex] || ""
            );

            doc
              .rect(x, y, width, rowHeight)
              .fillAndStroke(
                rowIndex === 0
                  ? "#e5e7eb"
                  : "#ffffff",
                "#9ca3af"
              );

            doc
              .fillColor("#111827")
              .font(
                rowIndex === 0
                  ? "Helvetica-Bold"
                  : "Helvetica"
              )
              .fontSize(10)
              .text(value, x + 6, y + 7, {
                width: width - 12,
                height: 12,
                ellipsis: true
              });

            x += width;
          }

          y += rowHeight;
        });

        doc.end();

        outputStream.on("finish", () => {
          deleteFile(req.file.path);

          sendConvertedFile(
            res,
            outputPath,
            "converted.pdf"
          );
        });

        outputStream.on("error", () => {
          deleteFile(req.file.path);
          deleteFile(outputPath);

          res.status(500).send(
            "CSV PDF'e dönüştürülemedi."
          );
        });
      } catch (error) {
        console.error(error);

        deleteFile(req.file.path);
        deleteFile(outputPath);

        res.status(500).send(
          "CSV dosyası okunamadı."
        );
      }

      return;
    }

    // Office / metin -> PDF
    if (isDocument) {
      if (!fs.existsSync(sofficePath)) {
        deleteFile(req.file.path);

        return res.status(500).send(
          "LibreOffice bulunamadı."
        );
      }

      const officeInputPath = path.join(
        uploads,
        `${req.file.filename}${inputExtension}`
      );

      const outputPath = path.join(
        outputs,
        `${req.file.filename}.pdf`
      );

      const profileDir = fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "converter-libreoffice-"
        )
      );

      const profileUrl = pathToFileURL(profileDir).href;

      let finished = false;

      const cleanup = () => {
        deleteFile(officeInputPath);
        deleteFile(req.file.path);

        fs.rmSync(profileDir, {
          recursive: true,
          force: true
        });
      };

      const fail = (message) => {
        if (finished) return;

        finished = true;
        cleanup();
        deleteFile(outputPath);

        res.status(500).send(message);
      };

      try {
        fs.renameSync(
          req.file.path,
          officeInputPath
        );
      } catch (error) {
        cleanup();

        return res.status(500).send(
          "Dosya hazırlanamadı."
        );
      }

      const soffice = spawn(sofficePath, [
        `-env:UserInstallation=${profileUrl}`,
        "--headless",
        "--nologo",
        "--nodefault",
        "--nofirststartwizard",
        "--nolockcheck",
        "--convert-to",
        "pdf",
        "--outdir",
        outputs,
        officeInputPath
      ]);

      let officeError = "";

      soffice.stderr.on("data", (data) => {
        officeError += data.toString();
      });

      soffice.on("error", () => {
        fail("LibreOffice çalıştırılamadı.");
      });

      soffice.on("close", (code) => {
        if (finished) return;

        if (
          code !== 0 ||
          !fs.existsSync(outputPath)
        ) {
          console.error(officeError);
          return fail("Dosya PDF'e dönüştürülemedi.");
        }

        finished = true;
        cleanup();

        sendConvertedFile(
          res,
          outputPath,
          "converted.pdf"
        );
      });

      return;
    }

    // Video / ses -> ses
    if (isVideo || isAudio) {
      if (!ffmpegExecutablePath) {
        deleteFile(req.file.path);

        return res.status(500).send(
          "FFmpeg bulunamadı."
        );
      }

      const codecSettings = {
        mp3: [
          "-c:a",
          "libmp3lame",
          "-q:a",
          "2"
        ],
        wav: [
          "-c:a",
          "pcm_s16le"
        ],
        m4a: [
          "-c:a",
          "aac",
          "-b:a",
          "192k"
        ],
        flac: [
          "-c:a",
          "flac"
        ],
        ogg: [
          "-c:a",
          "libvorbis",
          "-q:a",
          "5"
        ]
      };

      const outputPath = path.join(
        outputs,
        `${req.file.filename}.${targetFormat}`
      );

      const ffmpeg = spawn(ffmpegExecutablePath, [
        "-y",
        "-i",
        req.file.path,
        "-vn",
        ...codecSettings[targetFormat],
        outputPath
      ]);

      let ffmpegError = "";
      let finished = false;

      const fail = (message) => {
        if (finished) return;

        finished = true;
        deleteFile(req.file.path);
        deleteFile(outputPath);

        res.status(500).send(message);
      };

      ffmpeg.stderr.on("data", (data) => {
        ffmpegError += data.toString();
      });

      ffmpeg.on("error", () => {
        fail("FFmpeg çalıştırılamadı.");
      });

      ffmpeg.on("close", (code) => {
        if (finished) return;

        deleteFile(req.file.path);

        if (
          code !== 0 ||
          !fs.existsSync(outputPath)
        ) {
          console.error(ffmpegError);
          return fail("Ses/video dönüştürülemedi.");
        }

        finished = true;

        sendConvertedFile(
          res,
          outputPath,
          `converted.${targetFormat}`
        );
      });

      return;
    }

    deleteFile(req.file.path);

    return res.status(400).send(
      "Bu dönüşüm desteklenmiyor."
    );
  });
});

function startServer() {
  return app.listen(PORT, () => {
    console.log(
      `Converter çalışıyor: http://localhost:${PORT}`
    );
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  PORT
};
