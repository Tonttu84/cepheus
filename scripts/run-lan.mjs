import { spawn } from "node:child_process";
import os from "node:os";

const port = process.env.PORT || "3000";

function rankIface(name, address) {
  let score = 0;
  if (/wi-?fi|wlan|wlp|en0|en1|eth|ethernet|enp/i.test(name)) score += 20;
  if (
    !/vethernet|wsl|hyper-v|vmware|virtualbox|vbox|docker|br-|virbr|tailscale|wireguard|tun|tap/i.test(
      name
    )
  ) {
    score += 10;
  }
  if (address.startsWith("192.168.")) score += 6;
  else if (address.startsWith("10.")) score += 4;
  return score;
}

function getLanIps() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const [name, entries] of Object.entries(ifaces)) {
    for (const entry of entries || []) {
      if (
        entry.family === "IPv4" &&
        !entry.internal &&
        !entry.address.startsWith("169.254.")
      ) {
        ips.push({
          name,
          address: entry.address,
          score: rankIface(name, entry.address),
        });
      }
    }
  }
  return ips.sort((a, b) => b.score - a.score);
}

const ips = getLanIps();
console.log(
  "\n[cepheus:lan] Listening on all interfaces (0.0.0.0:" + port + ")"
);
if (ips.length > 0) {
  console.log(
    "[cepheus:lan] Open on laptop:  http://" +
      ips[0].address +
      ":" +
      port +
      "/demo"
  );
  for (const item of ips) {
    console.log(
      "[cepheus:lan] Phone URL (" +
        item.name +
        "): http://" +
        item.address +
        ":" +
        port +
        "/sign-in"
    );
  }
} else {
  console.log(
    "[cepheus:lan] No non-loopback IPv4 found; use your laptop Wi-Fi IP with port " +
      port
  );
}
console.log("");

const nextBin = "node_modules/next/dist/bin/next";
const args = [nextBin, "dev", "-H", "0.0.0.0", "-p", port];

const child = spawn(process.execPath, args, {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
