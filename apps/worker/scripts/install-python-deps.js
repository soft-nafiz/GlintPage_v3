const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const workerDir = path.resolve(__dirname, "..");
const requirementsPath = path.join(workerDir, "requirements.txt");
const vendorPath = path.join(workerDir, "python_vendor");

const candidates = process.env.PYTHON_BIN
  ? [process.env.PYTHON_BIN]
  : process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: workerDir,
    env: process.env,
    stdio: "inherit",
    ...options,
  });
}

function findPython() {
  for (const command of candidates) {
    const result = spawnSync(command, ["-c", "import sys; print(sys.executable)"], {
      cwd: workerDir,
      encoding: "utf8",
    });

    if (result.status === 0) return command;
  }

  throw new Error(
    `No Python executable found. Tried: ${candidates.join(", ")}. ` +
      "Railpack must install Python before running the worker build script.",
  );
}

const python = findPython();

fs.rmSync(vendorPath, { recursive: true, force: true });
fs.mkdirSync(vendorPath, { recursive: true });

console.log(`[Worker] Installing Python PDF dependencies with ${python}`);

const install = run(python, [
  "-m",
  "pip",
  "install",
  "--disable-pip-version-check",
  "--no-cache-dir",
  "--target",
  vendorPath,
  "-r",
  requirementsPath,
]);

if (install.status !== 0) {
  process.exit(install.status || 1);
}

console.log(`[Worker] Python dependencies installed to ${vendorPath}`);
