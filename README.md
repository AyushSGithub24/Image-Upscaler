# Local Image Upscaler

## Run on another Windows laptop

1. Extract the entire `Image-Upscaler-Windows.zip` into a writable folder.
   Do not run the start script from inside the ZIP.
2. Install Node.js LTS for Windows from https://nodejs.org/ if it is not already
   installed. Use Node.js 22 or newer. This project was tested with Node.js 24.
3. The bundled model executable requires a compatible Windows x64 machine
   and Vulkan-capable Intel, AMD, or NVIDIA graphics with a working driver.
   If GPU initialization fails, install the graphics driver from the GPU or
   laptop manufacturer's official website. This build has no CPU fallback.
4. Double-click `Start Upscaler.bat`, then open http://127.0.0.1:3000.
5. Keep the command window open during processing. After downloading the image,
   press Ctrl+C or close the window to stop the server.

Windows PowerShell and its System.Drawing library perform the final resizing.
No Python, PyTorch, CUDA, API key, npm install, or internet connection is required
for normal use after the runtime and graphics drivers are installed.

Keep `server.js`, `public`, and `realesrgan-ncnn-vulkan-v0.2.0-windows`
beside the start script. The server creates `outputs` automatically.
If port 3000 is already in use, close the other instance before starting.

The ZIP excludes personal output images, test files, and redundant download
backups. The Real-ESRGAN engine's bundled LICENSE is included.

## Using the website

Double-click **Start Upscaler.bat**, then open http://127.0.0.1:3000.
Keep the command window open. Press Ctrl+C there to stop the server.

Choose or drag in a PNG, JPG, or WebP (up to 30 MB), select 2×, 4×, 6×, or 10×,
and click **Upscale image**. Compare the previews, click an image to
inspect it at full size, and download the PNG.

The interface uses HTML, CSS, and JavaScript. A Node.js server invokes
the bundled Real-ESRGAN executable on your laptop. No npm packages are required.
The server binds only to 127.0.0.1 and processes one image at a time.

The general Real-ESRGAN x4plus model produces 4× output. The 2× option
downsamples that output with high-quality bicubic interpolation. The 6× and
10× options enlarge the 4× AI result with the same interpolation. Every option
keeps the complete image and its original proportions. The interface shows
the expected pixel dimensions before processing. Larger sizes do not guarantee
more recovered detail, and large outputs require more memory. Output PNG files stay in the `outputs` folder;
uploaded temporary images are deleted after processing.

Check small text and numbers before printing. The model can change character
shapes and cannot guarantee recovery of missing detail.
