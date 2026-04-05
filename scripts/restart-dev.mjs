import { spawn } from "node:child_process";

const command = process.argv.slice(2).join(" ").trim();

if (!command) {
  console.error("Usage: node scripts/restart-dev.mjs <command>");
  process.exit(1);
}

const maxRestarts = Number(process.env.DEV_RESTART_TRIES ?? "20");
const restartDelayMs = Number(process.env.DEV_RESTART_DELAY_MS ?? "1500");

let restartCount = 0;
let child = null;
let stopping = false;

const stopChild = (signal) => {
  if (!child || child.killed) {
    process.exit(0);
    return;
  }

  stopping = true;
  child.kill(signal);
};

const start = () => {
  child = spawn(command, {
    cwd: process.cwd(),
    env: process.env,
    shell: true,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    child = null;

    if (stopping || signal === "SIGINT" || signal === "SIGTERM") {
      process.exit(code ?? 0);
      return;
    }

    if (code === 0) {
      process.exit(0);
      return;
    }

    restartCount += 1;

    if (restartCount > maxRestarts) {
      console.error(
        `[dev-supervisor] Process exited ${restartCount} times. Giving up after ${maxRestarts} restart attempts.`,
      );
      process.exit(code ?? 1);
      return;
    }

    console.warn(
      `[dev-supervisor] Process crashed with code ${code ?? "unknown"}. Restarting in ${restartDelayMs}ms (${restartCount}/${maxRestarts}).`,
    );

    setTimeout(start, restartDelayMs);
  });
};

process.on("SIGINT", () => stopChild("SIGINT"));
process.on("SIGTERM", () => stopChild("SIGTERM"));

start();
