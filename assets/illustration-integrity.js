// Illustration Studio — saved-scenario tamper-evidence.
//
// The canonical saved form is inert JSON (re-rendered by this trusted app on
// load), carrying a SHA-256 checksum of its own payload so casual hand-editing
// or corruption is DETECTABLE on load. Honest scope: an integrity CHECKSUM,
// not a signature — anyone can recompute it, so it proves the file is intact,
// not who produced it. Extracted from illustration-studio.html so the pure
// serialization/verify logic can be unit-tested. Uses Web Crypto (crypto.subtle),
// available in the browser and in Node 20+.
//
// UMD: window.IRIntegrity in the browser, module.exports in Node.
(function (root) {
  "use strict";

  // Deterministic serialization with recursively sorted keys, so the same
  // logical payload always hashes the same regardless of key order. undefined
  // values are dropped (JSON.stringify would drop them anyway).
  function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
    const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
  }

  function subtleCrypto() {
    return (typeof crypto !== "undefined" && crypto.subtle) ? crypto.subtle : null;
  }

  async function sha256Hex(text) {
    const subtle = subtleCrypto();
    if (!subtle) return null;
    const buf = await subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Hash everything except the integrity block itself.
  async function scenarioHash(payload) {
    const rest = Object.assign({}, payload);
    delete rest.integrity;
    return sha256Hex(stableStringify(rest));
  }

  async function attachIntegrity(payload) {
    const hash = await scenarioHash(payload);
    if (hash) payload.integrity = { algo: "SHA-256", hash, signedAt: new Date().toISOString() };
    return payload;
  }

  // -> "ok" | "modified" | "unsigned" | "unverifiable"
  async function verifyScenarioIntegrity(payload) {
    if (!payload || !payload.integrity || !payload.integrity.hash) return "unsigned";
    if (!subtleCrypto()) return "unverifiable";
    const hash = await scenarioHash(payload);
    return hash === payload.integrity.hash ? "ok" : "modified";
  }

  const api = { stableStringify, sha256Hex, scenarioHash, attachIntegrity, verifyScenarioIntegrity };
  root.IRIntegrity = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
