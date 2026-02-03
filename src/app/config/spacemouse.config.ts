/**
 * SpaceMouse Configuration
 *
 * Axis mappings and device identification for 3Dconnexion SpaceMouse devices.
 * These values may differ across operating systems or driver versions.
 */

/** Axis indices for SpaceMouse (standard mapping) */
export const AXIS_INDEX = {
  TX: 0, // X translation (left/right)
  TY: 1, // Y translation (up/down)
  TZ: 2, // Z translation (forward/back)
  RX: 3, // Pitch (tilt forward/back)
  RY: 4, // Yaw (twist left/right)
  RZ: 5, // Roll (tilt left/right)
} as const;

/**
 * Identifies if a gamepad is a SpaceMouse device.
 * 3Dconnexion devices typically include "SpaceMouse" or "3Dconnexion" in the ID string.
 */
export function isSpaceMouse(gamepad: Gamepad): boolean {
  const id = gamepad.id.toLowerCase();
  return id.includes('spacemouse') || id.includes('3dconnexion');
}
