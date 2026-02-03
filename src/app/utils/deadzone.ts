/**
 * Applies a deadzone to an analog input value.
 * Values within the threshold are mapped to 0, values outside are scaled
 * to maintain smooth 0-1 range after the deadzone.
 *
 * @param value - The raw input value (typically -1 to 1)
 * @param threshold - The deadzone threshold (default 0.1)
 * @returns The adjusted value with deadzone applied
 */
export function applyDeadzone(value: number, threshold = 0.1): number {
  const absValue = Math.abs(value);

  if (absValue < threshold) {
    return 0;
  }

  // Scale the value so that just outside deadzone starts near 0
  const sign = Math.sign(value);
  const scaledValue = (absValue - threshold) / (1 - threshold);

  return sign * Math.min(scaledValue, 1);
}

/**
 * Checks if two numbers are significantly different.
 * Used to avoid signal flutter from minor floating-point changes.
 *
 * @param a - First value
 * @param b - Second value
 * @param epsilon - Minimum difference threshold
 * @returns true if values differ by more than epsilon
 */
export function hasSignificantChange(a: number, b: number, epsilon = 0.001): boolean {
  return Math.abs(a - b) > epsilon;
}
