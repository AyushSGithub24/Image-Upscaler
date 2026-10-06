const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const root = __dirname;
const engine = path.join(root, "realesrgan-ncnn-vulkan-v0.2.0-windows");
const storage = path.join(root, "outputs");
fs.mkdirSync(storage, { recursive: true });
const jobs = new Map();
let busy = false;
function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}
function execute(command, args, job) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: engine, windowsHide: true });
    let errors = "";
    child.stderr.on("data", (data) => {
      errors = (errors + data).slice(-4000);
      const matches = [...String(data).matchAll(/(\d+(?:\.\d+)?)%/g)];
      if (matches.length)
        job.progress = Math.min(95, Number(matches.at(-1)[1]) * 0.95);
    });
    child.stdout.on("data", () => {});
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(errors || `Process exited with code ${code}`)),
    );
  });
}
async function upscale(job, input, output, scale) {
  try {
    const full = scale === 4 ? output : path.join(storage, `${job.id}-4x.png`);
    await execute(
      path.join(engine, "realesrgan-ncnn-vulkan.exe"),
      [
        "-i",
        input,
        "-o",
        full,
        "-m",
        path.join(engine, "models"),
        "-n",
        "realesrgan-x4plus",
        "-s",
        "4",
        "-t",
        "128",
      ],
      job,
    );
    if (scale !== 4) {
      job.stage = `Finishing ${scale}× image`;
      job.progress = 95;
      // Paths are generated locally; single quotes are escaped for PowerShell literals.
      const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
      const script = `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Drawing; $src=[System.Drawing.Image]::FromFile(${quote(full)}); try { $dst=[System.Drawing.Bitmap]::new([int]($src.Width*${scale}/4),[int]($src.Height*${scale}/4)); try { $g=[System.Drawing.Graphics]::FromImage($dst); try { $g.InterpolationMode=[System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $g.PixelOffsetMode=[System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality; $g.DrawImage($src,0,0,$dst.Width,$dst.Height); $dst.Save(${quote(output)},[System.Drawing.Imaging.ImageFormat]::Png) } finally { $g.Dispose() } } finally { $dst.Dispose() } } finally { $src.Dispose() }`;
      await execute(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-Command", script],
        job,
      );
      fs.unlinkSync(full);
    }
    job.status = "done";
    job.progress = 100;
    job.url = `/outputs/${job.id}.png`;
  } catch (error) {
    job.status = "error";
    job.error = error.message;
  } finally {
    busy = false;
    fs.rmSync(input, { force: true });
  }
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "GET" && url.pathname === "/api/health")
    return json(res, 200, {
      ready: fs.existsSync(
        path.join(engine, "models", "realesrgan-x4plus.bin"),
      ),
    });
  if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
    const job = jobs.get(url.pathname.split("/").at(-1));
    return json(
      res,
      job ? 200 : 404,
      job || { error: "Job not found. The server may have restarted." },
    );
  }
  if (req.method === "POST" && url.pathname === "/api/upscale") {
    if (
      req.headers.origin &&
      req.headers.origin !== `http://${req.headers.host}`
    )
      return json(res, 403, { error: "Upload from the local website only." });
    if (busy)
      return json(res, 409, {
        error: "An image is already processing. Please wait.",
      });
    const scale = Number(url.searchParams.get("scale"));
    if (![2, 4, 6, 10].includes(scale))
      return json(res, 400, { error: "Choose 2×, 4×, 6×, or 10×." });
    busy = true;
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 30 * 1024 * 1024) {
          busy = false;
          return json(res, 413, { error: "Maximum upload size is 30 MB." });
        }
        chunks.push(chunk);
      }
      const data = Buffer.concat(chunks);
      let extension;
      if (
        data
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      )
        extension = "png";
      else if (data[0] === 255 && data[1] === 216 && data[2] === 255)
        extension = "jpg";
      else if (
        data.toString("ascii", 0, 4) === "RIFF" &&
        data.toString("ascii", 8, 12) === "WEBP"
      )
        extension = "webp";
      else {
        busy = false;
        return json(res, 400, {
          error: "Please upload a PNG, JPG, or WebP image.",
        });
      }
      const id = randomUUID();
      const input = path.join(storage, `${id}-input.${extension}`);
      fs.writeFileSync(input, data);
      const job = {
        id,
        status: "processing",
        stage: "Upscaling image",
        progress: 0,
      };
      jobs.set(id, job);
      json(res, 202, job);
      upscale(job, input, path.join(storage, `${id}.png`), scale);
    } catch (error) {
      busy = false;
      if (!res.headersSent)
        json(res, 400, { error: "Could not read uploaded image." });
    }
    return;
  }
  let file;
  if (url.pathname === "/" || url.pathname === "/index.html")
    file = path.join(root, "public", "index.html");
  else if (["/style.css", "/app.js", "/favicon.svg"].includes(url.pathname))
    file = path.join(root, "public", url.pathname.slice(1));
  else if (/^\/outputs\/[a-f0-9-]+\.png$/.test(url.pathname))
    file = path.join(storage, path.basename(url.pathname));
  if (!file || !fs.existsSync(file))
    return json(res, 404, { error: "Not found" });
  const types = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".svg": "image/svg+xml",
    ".png": "image/png",
  };
  res.writeHead(200, {
    "Content-Type": types[path.extname(file)],
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(file).pipe(res);
});
server.listen(3000, "127.0.0.1", () =>
  console.log("Image Upscaler: http://127.0.0.1:3000"),
);
server.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
