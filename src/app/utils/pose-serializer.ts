import { SpaceMouseAxes } from '../services/gamepad.service';

/**
 * Binary serialization for 6 DOF SpaceMouse pose data.
 *
 * Layout (24 bytes total):
 * - Bytes 0-3:   TX (Float32) - X translation
 * - Bytes 4-7:   TY (Float32) - Y translation
 * - Bytes 8-11:  TZ (Float32) - Z translation
 * - Bytes 12-15: RX (Float32) - Pitch rotation
 * - Bytes 16-19: RY (Float32) - Yaw rotation
 * - Bytes 20-23: RZ (Float32) - Roll rotation
 */

/** Size of a serialized pose packet in bytes */
export const POSE_PACKET_SIZE = 24; // 6 floats × 4 bytes

/**
 * Pack a SpaceMouseAxes object into a compact ArrayBuffer.
 * @param axes The 6 DOF axes to serialize
 * @returns ArrayBuffer containing the packed data (24 bytes)
 */
export function packPose(axes: SpaceMouseAxes): ArrayBuffer {
  const buffer = new ArrayBuffer(POSE_PACKET_SIZE);
  const view = new Float32Array(buffer);

  view[0] = axes.tx;
  view[1] = axes.ty;
  view[2] = axes.tz;
  view[3] = axes.rx;
  view[4] = axes.ry;
  view[5] = axes.rz;

  return buffer;
}

/**
 * Unpack an ArrayBuffer back into a SpaceMouseAxes object.
 * @param buffer The ArrayBuffer to deserialize (must be 24 bytes)
 * @returns The unpacked 6 DOF axes
 * @throws Error if buffer size is invalid
 */
export function unpackPose(buffer: ArrayBuffer): SpaceMouseAxes {
  if (buffer.byteLength !== POSE_PACKET_SIZE) {
    throw new Error(
      `Invalid buffer size: expected ${POSE_PACKET_SIZE} bytes, got ${buffer.byteLength}`
    );
  }

  const view = new Float32Array(buffer);

  return {
    tx: view[0],
    ty: view[1],
    tz: view[2],
    rx: view[3],
    ry: view[4],
    rz: view[5],
  };
}

/**
 * Pack pose data into an existing Uint8Array (useful for WebRTC DataChannel).
 * @param axes The 6 DOF axes to serialize
 * @param target Optional target Uint8Array (must be at least 24 bytes)
 * @param offset Offset in the target array to start writing
 * @returns Uint8Array view of the packed data
 */
export function packPoseToUint8Array(
  axes: SpaceMouseAxes,
  target?: Uint8Array,
  offset = 0
): Uint8Array {
  const buffer = packPose(axes);

  if (target) {
    target.set(new Uint8Array(buffer), offset);
    return target;
  }

  return new Uint8Array(buffer);
}

/**
 * Unpack pose data from a Uint8Array.
 * @param data The Uint8Array containing packed pose data
 * @param offset Offset in the array to start reading from
 * @returns The unpacked 6 DOF axes
 */
export function unpackPoseFromUint8Array(
  data: Uint8Array,
  offset = 0
): SpaceMouseAxes {
  const slice = data.slice(offset, offset + POSE_PACKET_SIZE);
  return unpackPose(slice.buffer);
}
