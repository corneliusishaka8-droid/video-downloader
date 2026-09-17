# Coco's Forge

Coco's Forge is a local video downloader with a browser frontend and an Express backend. It uses `yt-dlp` to inspect public video URLs and download them as MP4 files.

## Requirements

- Node.js 18 or newer
- Python 3
- `yt-dlp` installed for Python

Install the project dependencies and downloader:

```powershell
cd C:\Users\COCO\program\video
npm install
python -m pip install --upgrade yt-dlp
```

On Windows, the server runs `yt-dlp` through:

```text
py -m yt_dlp
```

## Start the app

From the workspace root:

```powershell
cd C:\Users\COCO\program
node video/server.js
```

Or from the project directory:

```powershell
cd C:\Users\COCO\program\video
node server.js
```

Open the frontend at:

```text
http://localhost:3000
```

Paste a public video URL, select **Inspect video**, then select **Download MP4**.

## API routes

### Check the downloader

```http
GET /yt-dlp-version
```

Returns the installed `yt-dlp` version.

### Inspect a video

```http
POST /download
Content-Type: application/json

{"url":"https://www.tiktok.com/@user/video/123456789"}
```

Returns metadata such as the title, uploader, duration, thumbnail, and source URL.

### Download an MP4

```http
POST /download/file
Content-Type: application/json

{"url":"https://www.tiktok.com/@user/video/123456789"}
```

The response is an MP4 file. The server temporarily stores the file in `downloads/` and removes it after the response finishes.

PowerShell example:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3000/download/file" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"url":"https://www.tiktok.com/@user/video/123456789"}' `
  -OutFile "test-video.mp4"
```

## Project structure

```text
video/
├── public/
│   ├── index.html    # Frontend page
│   ├── main.js       # Frontend API requests and download flow
│   └── styles.css    # Frontend styling
├── downloads/        # Temporary downloaded files
├── server.js         # Express server and yt-dlp routes
├── package.json
└── README.md
```

## Troubleshooting

### `yt-dlp` is not installed

Run:

```powershell
python -m pip install --upgrade yt-dlp
py -m yt_dlp --version
```

### The page has no styling

Start the Express server and open `http://localhost:3000`. Do not open `public/index.html` directly from File Explorer because the frontend needs Express to serve `/styles.css`, `/main.js`, and the API routes.

### The download fails

Use a public HTTP or HTTPS URL and inspect the server terminal for the `yt-dlp` error details. Some videos may be private, region-restricted, age-restricted, removed, or blocked by the source platform.

Use the downloader only for content you are allowed to download and in accordance with the source platform's terms.
