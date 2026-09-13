export function normalizeJoinCode(code: string) {
  return code.trim().normalize("NFKC");
}

export async function hashJoinCode(code: string) {
  const value = `terakoya:v1:${normalizeJoinCode(code)}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
