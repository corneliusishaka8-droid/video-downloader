const form = document.querySelector("#download-form");
const input = document.querySelector("#video-url");
const clearButton = document.querySelector("#clear-button");
const inspectButton = document.querySelector("#inspect-button");
const resultSection = document.querySelector("#result-section");
const resultArt = document.querySelector("#result-art");
const videoTitle = document.querySelector("#video-title");
const videoMeta = document.querySelector("#video-meta");
const downloadButton = document.querySelector("#download-button");
const toast = document.querySelector("#toast");

let currentUrl = "";
let toastTimer;

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.querySelector("span").textContent = busy ? label : button.dataset.defaultLabel;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 5000);
}

function setResultImage(thumbnail) {
  resultArt.style.backgroundImage = thumbnail ? `linear-gradient(120deg, rgba(17, 20, 26, .1), rgba(17, 20, 26, .62)), url("${thumbnail}")` : "";
  resultArt.classList.toggle("has-image", Boolean(thumbnail));
}

async function readError(response) {
  try {
    const payload = await response.json();
    return payload.details || payload.error || "The server could not complete that request.";
  } catch {
    return "The server could not complete that request.";
  }
}

function getDownloadName(response) {
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || "clipforge-video.mp4";
}

inspectButton.dataset.defaultLabel = "Inspect video";
downloadButton.dataset.defaultLabel = "Download MP4";

input.addEventListener("input", () => {
  clearButton.hidden = input.value.length === 0;
});

clearButton.addEventListener("click", () => {
  input.value = "";
  clearButton.hidden = true;
  input.focus();
  resultSection.hidden = true;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  if (!url) return;

  currentUrl = url;
  setBusy(inspectButton, true, "Inspecting...");
  resultSection.hidden = true;

  try {
    const response = await fetch("/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) throw new Error(await readError(response));
    const video = await response.json();
    videoTitle.textContent = video.title || "Untitled video";
    videoMeta.textContent = [video.uploader, video.duration ? `${video.duration}s` : null].filter(Boolean).join("  /  ") || "Ready to forge a local copy.";
    setResultImage(video.thumbnail);
    resultSection.hidden = false;
    resultSection.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(inspectButton, false);
  }
});

downloadButton.addEventListener("click", async () => {
  if (!currentUrl) return;
  setBusy(downloadButton, true, "Forging...");

  try {
    const response = await fetch("/download/file", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: currentUrl }),
    });

    if (!response.ok) throw new Error(await readError(response));
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = getDownloadName(response);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
    showToast("Your MP4 is ready.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(downloadButton, false);
  }
});
