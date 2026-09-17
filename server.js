import express from "express";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";    
import {v4 as uuidv4} from "uuid";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;
// Windows uses the Python launcher so the server can run yt-dlp as a module.
const YTDLP_COMMAND = process.platform === "win32" ? "py" : "yt-dlp";
const YTDLP_PREFIX_ARGS = process.platform === "win32" ? ["-m", "yt_dlp"] : [];
const PROJECT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.join(PROJECT_DIR, "downloads");
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
  // `res` belongs to this Express route. The old code used `res` in a
  // startup callback, where it did not exist, causing "res is not defined".
  execFile(YTDLP_COMMAND, [...YTDLP_PREFIX_ARGS, "--version"], (error, stdout) => {
    if (error) {
      console.error("yt-dlp error:", error.message);

      return res.status(500).json({
        success: false,
        error: "yt-dlp is not installed or not found in PATH.",
      });
    }

    res.json({
      success: true,
      ytDlpVersion: stdout.trim(),
    });
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

app.post("/download", (req, res) => {
  const url = getVideoUrl(req, res);
  if (!url) return;

  execFile(YTDLP_COMMAND, [...YTDLP_PREFIX_ARGS, "--dump-single-json", "--no-download", "--no-warnings", url], (error, stdout) => {
    if (error) {
      console.error("yt-dlp metadata error:", error.message);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch video information. Check the URL and yt-dlp output.",
      });
    }
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
      return res.status(500).json({
        success: false,
        error: "Failed to parse video information.",
      });
    }
  });
});

app.post("/download/file", (req, res) => {
  const url = getVideoUrl(req, res);
  if (!url) return;

  const filename = `${uuidv4()}.mp4`;
  const outputPath = path.join(DOWNLOADS_DIR, filename);

  execFile(
    YTDLP_COMMAND,
    [
      ...YTDLP_PREFIX_ARGS,
      "-f",
      "bv*+ba/b",
      "--merge-output-format",
      "mp4",
      "-o",
      outputPath,
      url
    ],
    (error, stdout, stderr) => {
      if (error) {
        const details = stderr?.trim() || error.message;
        console.error("yt-dlp download error:", details);

        return res.status(500).json({
          success: false,
          error: "Video download failed.",
          details,
        });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({
          success: false,
          error: "Downloaded file was not found.",
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
    }
  );
});
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});