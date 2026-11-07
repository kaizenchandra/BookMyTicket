export const MFA_WINDOW_SECONDS = 300;
export const MFA_MAX_FAILURES = 5;
export const MFA_ELEVATION_SECONDS = 1800;
export function mfaAttemptWindow(
  failures: number,
  windowStarted: Date,
  now: Date,
) {
  const reset =
    now.getTime() - windowStarted.getTime() >= MFA_WINDOW_SECONDS * 1000;
  return {
    failures: reset ? 0 : failures,
    reset,
    locked: !reset && failures >= MFA_MAX_FAILURES,
  };
}
