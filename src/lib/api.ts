/**
 * Resolves full API endpoint URL dynamically across all runtime platforms:
 * - Web (Vercel / Localhost): Uses relative or origin path.
 * - Mobile (Android / iOS via Capacitor): Uses remote NEXT_PUBLIC_APP_URL.
 * - Desktop (Windows / macOS / Linux via Tauri): Uses remote NEXT_PUBLIC_APP_URL or configured backend.
 */
export function getApiEndpoint(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;

    // If running directly inside a standard web browser on a live website
    if (
      origin.startsWith('http://') ||
      origin.startsWith('https://')
    ) {
      if (
        !origin.includes('localhost') &&
        !origin.includes('127.0.0.1') &&
        !origin.includes('tauri://') &&
        !origin.includes('capacitor://')
      ) {
        return cleanPath;
      }
    }
  }

  const configuredBackend =
    process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return `${configuredBackend.replace(/\/$/, '')}${cleanPath}`;
}
