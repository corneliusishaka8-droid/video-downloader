import express from "express";
import path from "path";
import fs from "fs";    
import {v4 as uuidv4} from "uuid";
import { fileURLToPath } from "url";
import ytDlpPackage from "yt-dlp-exec";

const app = express();
const PORT = 3000;
const YTDLP_MAX_BUFFER = 16 * 1024 * 1024;
const PROJECT_DIR = path.dirname(fileURLToPath(import.meta.url));
const YTDLP_BINARY = path.join(
  PROJECT_DIR,
  "node_modules",
  "yt-dlp-exec",
  "bin",
  process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp_linux",
);
const ytDlp = ytDlpPackage.create(YTDLP_BINARY);
// Vercel's filesystem is read-only except for /tmp. Local development keeps
// using the project's downloads folder so the same routes work in both modes.
const DOWNLOADS_DIR = process.env.VERCEL ? "/tmp/clipforge-downloads" : path.join(PROJECT_DIR, "downloads");
const PUBLIC_DIR = path.join(PROJECT_DIR, "public");

fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });

app.use(express.json());
app.use(express.static(PUBLIC_DIR));

function getVideoUrl(req, res) {
  const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";

  if (!url) {
    res.status(400).json({
      success: false,
      error: "A video URL is required.",
    });
    return null;
  }

  try {
    const parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
  } catch {
    res.status(400).json({
      success: false,
      error: "Please provide a valid HTTP or HTTPS video URL.",
    });
    return null;
  }

  return url;
}

app.get("/yt-dlp-version", (req, res) => {
  ytDlp.exec(null, { version: true }, { maxBuffer: YTDLP_MAX_BUFFER })
    .then(({ stdout }) => res.json({ success: true, ytDlpVersion: stdout.trim() }))
    .catch((error) => {
      const details = error.stderr?.trim() || error.message;
      console.error("yt-dlp version error:", details);
      res.status(500).json({
        success: false,
        error: "yt-dlp is not available in this runtime.",
        details,
      });
    });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.post("/download", (req, res) => {
  const url = getVideoUrl(req, res);
  if (!url) return;

  ytDlp.exec(
    url,
    { dumpSingleJson: true, noDownload: true, noPlaylist: true, noWarnings: true },
    { maxBuffer: YTDLP_MAX_BUFFER },
  )
    .then(({ stdout }) => {
      try {
        const videoInfo = JSON.parse(stdout);
        res.json({
          title: videoInfo.title,
          description: videoInfo.description,
          duration: videoInfo.duration,
          uploader: videoInfo.uploader,
          thumbnail: videoInfo.thumbnail,
          webpage_url: videoInfo.webpage_url,
        });
      } catch (error) {
        console.error("Error parsing video information:", error.message);
        res.status(500).json({
          success: false,
          error: "Failed to parse video information.",
        });
      }
    })
    .catch((error) => {
      const details = error.stderr?.trim() || error.message;
      console.error("yt-dlp metadata error:", details);
      res.status(500).json({
        success: false,
        error: "Failed to fetch video information. Check the URL and yt-dlp output.",
        details,
      });
    });
});

app.post("/download/file", (req, res) => {
  const url = getVideoUrl(req, res);
  if (!url) return;

  const filename = `${uuidv4()}.mp4`;
  const outputPath = path.join(DOWNLOADS_DIR, filename);

  ytDlp.exec(
    url,
    {
      format: "bv*+ba/b",
      noPlaylist: true,
      mergeOutputFormat: "mp4",
      output: outputPath,
    },
    { maxBuffer: YTDLP_MAX_BUFFER },
  )
    .then(() => {
      if (!fs.existsSync(outputPath)) {
        const outputPrefix = path.basename(outputPath, path.extname(outputPath));
        for (const partialFile of fs.readdirSync(DOWNLOADS_DIR)) {
          if (partialFile.startsWith(`${outputPrefix}.`)) {
            fs.unlinkSync(path.join(DOWNLOADS_DIR, partialFile));
          }
        }

        return res.status(500).json({
          success: false,
          error: "yt-dlp could not create the MP4 file.",
          details: "Install ffmpeg so yt-dlp can merge the video and audio streams, then try again.",
        });
      }

      res.download(outputPath, "clipforge-video.mp4", (downloadError) => {
        if (downloadError) {
          console.error("File transfer error:", downloadError);
        }

        fs.unlink(outputPath, (deleteError) => {
          if (deleteError) console.error("Could not delete temporary file:", deleteError);
        });
      });
    })
    .catch((error) => {
      const details = error.stderr?.trim() || error.message;
        console.error("yt-dlp download error:", details);
      res.status(500).json({
        success: false,
        error: "Video download failed.",
        details,
      });
    });
});
// Vercel imports this file as a serverless function. Only bind a port locally.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

export default app;