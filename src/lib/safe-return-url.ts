const ALLOWED_PATH_CHARS = /^\/[A-Za-z0-9\-._~/?=&%]*$/;
const FORBIDDEN_DECODED = /[\s\u0000-\u001f\u007f\\:]/;

/**
 * Validates and sanitizes a return URL parameter to prevent open redirects.
 *
 * Accepts only a path that starts with a single `/` followed by characters from
 * `A-Z a-z 0-9 - . _ ~ / ? = & %`, never `//` anywhere at the start, no backslash,
 * no colon, no whitespace or control characters in either raw or percent-decoded form.
 * Values that fail percent-decoding are rejected.
 */
export function safeReturnUrl(target: string | null | undefined): string | null {
  if (!target || typeof target !== "string") {
    return null;
  }

  // Must start with single '/' and contain only allowed characters
  if (!ALLOWED_PATH_CHARS.test(target) || target.startsWith("//")) {
    return null;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }

  // Decoded form must start with single '/' and not '//'
  if (!decoded.startsWith("/") || decoded.startsWith("//")) {
    return null;
  }

  // Decoded form must not contain backslash, colon, whitespace, or control characters
  if (FORBIDDEN_DECODED.test(decoded)) {
    return null;
  }

  return target;
}
