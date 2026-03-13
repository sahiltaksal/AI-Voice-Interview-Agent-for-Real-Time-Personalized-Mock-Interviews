import Vapi from "@vapi-ai/web";

// ✅ CRITICAL: Strip quotes from token if present (handles both "token" and token formats)
const rawToken = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN || "";
const cleanToken = rawToken.replace(/^\"|\"$/g, "").trim();

if (!cleanToken) {
  console.error("[VAPI] ❌ ERROR: NEXT_PUBLIC_VAPI_WEB_TOKEN is not set or empty");
  console.error("[VAPI] Raw token value:", rawToken);
}

console.log("[VAPI] ✅ Token initialized:", {
  hasToken: !!cleanToken,
  tokenLength: cleanToken.length,
  tokenPreview: cleanToken ? cleanToken.substring(0, 8) + "..." : "MISSING"
});

export const vapi = new Vapi(cleanToken);
