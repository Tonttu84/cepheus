import { describe, expect, it } from "vitest";
import type os from "node:os";
import {
  buildPhoneDemoOriginOptions,
  detectLanIpv4Addresses,
  isPrivateLanHostname,
} from "../lan-origin";

function fakeInterfaces(): NodeJS.Dict<os.NetworkInterfaceInfo[]> {
  return {
    lo: [
      {
        address: "127.0.0.1",
        netmask: "255.0.0.0",
        family: "IPv4",
        mac: "00:00:00:00:00:00",
        internal: true,
        cidr: "127.0.0.1/8",
      },
    ],
    "vEthernet (WSL)": [
      {
        address: "172.24.16.1",
        netmask: "255.255.240.0",
        family: "IPv4",
        mac: "00:15:5d:00:00:01",
        internal: false,
        cidr: "172.24.16.1/20",
      },
    ],
    "Wi-Fi": [
      {
        address: "192.168.1.42",
        netmask: "255.255.255.0",
        family: "IPv4",
        mac: "aa:bb:cc:dd:ee:ff",
        internal: false,
        cidr: "192.168.1.42/24",
      },
    ],
  };
}

describe("Phone demo LAN origin helpers", () => {
  it("identifies localhost, .local, and RFC1918 private LAN hosts only", () => {
    expect(isPrivateLanHostname("localhost:3000")).toBe(true);
    expect(isPrivateLanHostname("127.0.0.1:3000")).toBe(true);
    expect(isPrivateLanHostname("192.168.1.42:3000")).toBe(true);
    expect(isPrivateLanHostname("10.0.0.15:3000")).toBe(true);
    expect(isPrivateLanHostname("172.16.5.9:3000")).toBe(true);
    expect(isPrivateLanHostname("172.31.255.1:3000")).toBe(true);
    expect(isPrivateLanHostname("laptop.local:3000")).toBe(true);

    expect(isPrivateLanHostname("172.32.0.1:3000")).toBe(false);
    expect(isPrivateLanHostname("8.8.8.8")).toBe(false);
    expect(isPrivateLanHostname("cepheus.example.fi")).toBe(false);
    expect(isPrivateLanHostname("")).toBe(false);
  });

  it("ranks physical Wi-Fi / LAN IPv4 addresses ahead of virtual adapters", () => {
    const detected = detectLanIpv4Addresses(fakeInterfaces());
    expect(detected.length).toBe(2);
    expect(detected[0].address).toBe("192.168.1.42");
    expect(detected[0].interfaceName).toBe("Wi-Fi");
  });

  it("builds phone demo origin options preferring request host or Wi-Fi IP", () => {
    const fromLocalhost = buildPhoneDemoOriginOptions({
      requestHost: "localhost:3000",
      protocol: "http",
      port: 3000,
      interfaces: fakeInterfaces(),
    });
    expect(fromLocalhost[0].url).toBe("http://192.168.1.42:3000");
    expect(fromLocalhost[0].isPreferred).toBe(true);

    const fromLan = buildPhoneDemoOriginOptions({
      requestHost: "192.168.1.42:3000",
      protocol: "http",
      port: 3000,
      interfaces: fakeInterfaces(),
    });
    expect(fromLan[0].url).toBe("http://192.168.1.42:3000");
    expect(fromLan[0].label).toContain("Current address");
  });

  it("falls back cleanly when no non-loopback interface exists", () => {
    const loopbackOnly = buildPhoneDemoOriginOptions({
      requestHost: "localhost:3000",
      protocol: "http",
      port: 3000,
      interfaces: {},
    });
    expect(loopbackOnly).toHaveLength(1);
    expect(loopbackOnly[0].url).toBe("http://localhost:3000");
  });
});
