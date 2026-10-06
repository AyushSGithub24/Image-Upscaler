const $ = (id) => document.getElementById(id);
let selected,
  originalUrl,
  working = false;
const setStatus = (message) => ($("status").textContent = message);
function updateTarget() {
  const source = $("original");
  if (!selected || !source.naturalWidth) return;
  const scale = Number(document.querySelector("[name=scale]:checked").value);
  $("target-size").textContent =
    `Output: ${source.naturalWidth * scale} × ${source.naturalHeight * scale} pixels · complete image`;
}
function clearResult() {
  $("result").hidden = true;
  $("result").removeAttribute("src");
  $("result-empty").hidden = false;
  $("result-size").textContent = "—";
  $("download").hidden = true;
}
function choose(file) {
  if (working || !file) return;
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    setStatus("Choose a PNG, JPG, or WebP image.");
    return;
  }
  if (file.size > 30 * 1024 * 1024) {
    setStatus("Choose an image smaller than 30 MB.");
    return;
  }
  selected = file;
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = URL.createObjectURL(file);
  clearResult();
  $("original").src = originalUrl;
  $("original").hidden = false;
  $("original-empty").hidden = true;
  $("filename").textContent = file.name;
  $("run").disabled = false;
  $("original").onload = () => {
    $("original-size").textContent =
      `${$("original").naturalWidth} × ${$("original").naturalHeight}`;
    updateTarget();
  };
  setStatus("Ready to upscale.");
  $("badge").textContent = "PREVIEW";
}
$("file").addEventListener("change", (event) => choose(event.target.files[0]));
["dragenter", "dragover"].forEach((type) =>
  $("drop").addEventListener(type, (event) => {
    event.preventDefault();
    $("drop").classList.add("drag");
  }),
);
["dragleave", "drop"].forEach((type) =>
  $("drop").addEventListener(type, (event) => {
    event.preventDefault();
    $("drop").classList.remove("drag");
  }),
);
$("drop").addEventListener("drop", (event) =>
  choose(event.dataTransfer.files[0]),
);
document.querySelectorAll("[name=scale]").forEach((input) =>
  input.addEventListener("change", () => {
    clearResult();
    updateTarget();
    $("badge").textContent = "PREVIEW";
    if (selected) setStatus("Ready to upscale.");
  }),
);
for (const id of ["original", "result"])
  $(id).addEventListener("click", () => {
    if ($(id).src) window.open($(id).src, "_blank", "noopener");
  });
async function readResponse(response) {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}
$("run").addEventListener("click", async () => {
  if (!selected || working) return;
  working = true;
  clearResult();
  $("run").disabled = true;
  $("file").disabled = true;
  document
    .querySelectorAll("[name=scale]")
    .forEach((input) => (input.disabled = true));
  $("progress").hidden = false;
  $("progress").value = 0;
  $("badge").textContent = "PROCESSING";
  const scale = document.querySelector("[name=scale]:checked").value;
  try {
    setStatus("Uploading to your local upscaler…");
    let job = await readResponse(
      await fetch(`/api/upscale?scale=${scale}`, {
        method: "POST",
        headers: { "Content-Type": selected.type },
        body: selected,
      }),
    );
    while (job.status === "processing") {
      setStatus(
        `${job.stage}… ${Math.round(job.progress)}%. Large images can take several minutes.`,
      );
      $("progress").value = job.progress;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      job = await readResponse(await fetch(`/api/jobs/${job.id}`));
    }
    if (job.status === "error") throw new Error(job.error);
    const result = $("result");
    await new Promise((resolve, reject) => {
      result.onload = resolve;
      result.onerror = () =>
        reject(new Error("Could not load the result image."));
      result.src = job.url;
    });
    result.hidden = false;
    $("result-empty").hidden = true;
    $("result-size").textContent =
      `${result.naturalWidth} × ${result.naturalHeight}`;
    $("download").href = job.url;
    $("download").download =
      `${selected.name.replace(/\.[^.]+$/, "")}-${scale}x.png`;
    $("download").hidden = false;
    $("progress").value = 100;
    $("badge").textContent = "COMPLETE";
    setStatus("Your upscaled image is ready.");
  } catch (error) {
    setStatus(`Could not upscale: ${error.message}`);
    $("badge").textContent = "TRY AGAIN";
  } finally {
    working = false;
    $("run").disabled = !selected;
    $("file").disabled = false;
    document
      .querySelectorAll("[name=scale]")
      .forEach((input) => (input.disabled = false));
    $("progress").hidden = true;
  }
});
fetch("/api/health")
  .then(readResponse)
  .then((body) => {
    if (!body.ready) {
      $("run").disabled = true;
      setStatus("Pretrained model files are missing.");
    }
  })
  .catch(() => setStatus("Start the local server to use the upscaler."));
