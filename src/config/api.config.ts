// Update this URL each time you restart ngrok. Overridable via API_BASE_URL (e.g. for CI's
// live-backend integration tests, which point this at a real fieldops instance on localhost) --
// process.env works natively under Jest/Node, no react-native-dotenv wiring needed. Unset in
// every normal dev/app context, so this falls through to the ngrok URL exactly as before.
export const API_BASE_URL =
  process.env.API_BASE_URL || 'https://magali-overexpressive-pristinely.ngrok-free.dev';
