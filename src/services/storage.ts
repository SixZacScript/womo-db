// Simple XOR-based obfuscation for localStorage
// Not cryptographically secure, but prevents casual inspection
const OBFUSCATION_KEY = "womo-db-secret-key-v1";

function obfuscate(text: string): string {
  const key = OBFUSCATION_KEY;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result); // Base64 encode
}

function deobfuscate(encoded: string): string {
  try {
    const decoded = atob(encoded); // Base64 decode
    const key = OBFUSCATION_KEY;
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return result;
  } catch {
    return "";
  }
}

export const secureStorage = {
  setUri(uri: string) {
    const obfuscated = obfuscate(uri);
    localStorage.setItem("womo-db-uri", obfuscated);
  },

  getUri(): string | null {
    const stored = localStorage.getItem("womo-db-uri");
    if (!stored) return null;

    // Try to deobfuscate, if it fails assume it's old plain text
    const deobfuscated = deobfuscate(stored);
    if (!deobfuscated && stored) {
      // Migrate old plain text to obfuscated
      this.setUri(stored);
      return stored;
    }
    return deobfuscated || null;
  },

  removeUri() {
    localStorage.removeItem("womo-db-uri");
  },
};
