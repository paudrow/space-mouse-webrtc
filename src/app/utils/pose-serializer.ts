import { SpaceMouseAxes } from '../services/spacemouse.service';

/**
 * Binary serialization for 6 DOF SpaceMouse pose data with timestamp.
 *
 * Layout (32 bytes total):
 * - Bytes 0-7:   Timestamp (Float64) - High-precision timestamp for latency measurement
 * - Bytes 8-11:  TX (Float32) - X translation
 * - Bytes 12-15: TY (Float32) - Y translation
 * - Bytes 16-19: TZ (Float32) - Z translation
 * - Bytes 20-23: RX (Float32) - Pitch rotation
 * - Bytes 24-27: RY (Float32) - Yaw rotation
 * - Bytes 28-31: RZ (Float32) - Roll rotation
 */

/** Size of a serialized pose packet in bytes */
export const POSE_PACKET_SIZE = 32; // 1 float64 (8 bytes) + 6 floats × 4 bytes

/** Result of unpacking a pose with timestamp */
export interface TimestampedPose {
  timestamp: number;
  axes: SpaceMouseAxes;
}

/**
 * Pack a SpaceMouseAxes object into a compact ArrayBuffer with timestamp.
 * 
 * @param axes The 6 DOF axes to serialize
 * @param timestamp Optional timestamp (defaults to performance.now())
 * @param reuseBuffer Optional pre-allocated buffer to reduce GC pressure at 60fps
 * @returns ArrayBuffer containing the packed data (32 bytes)
 */
export function packPose(
  axes: SpaceMouseAxes,
  timestamp?: number,
  reuseBuffer?: ArrayBuffer
): ArrayBuffer {
  const buffer = reuseBuffer ?? new ArrayBuffer(POSE_PACKET_SIZE);
  const dataView = new DataView(buffer);

  // Write timestamp as Float64 (8 bytes)
  dataView.setFloat64(0, timestamp ?? performance.now(), true); // little-endian

  // Write axes as Float32 (4 bytes each)
  dataView.setFloat32(8, axes.tx, true);
  dataView.setFloat32(12, axes.ty, true);
  dataView.setFloat32(16, axes.tz, true);
  dataView.setFloat32(20, axes.rx, true);
  dataView.setFloat32(24, axes.ry, true);
  dataView.setFloat32(28, axes.rz, true);

  return buffer;
}

/**
 * Unpack an ArrayBuffer back into a SpaceMouseAxes object (without timestamp).
 * @param buffer The ArrayBuffer to deserialize (must be 32 bytes)
 * @returns The unpacked 6 DOF axes
 * @throws Error if buffer size is invalid
 */
export function unpackPose(buffer: ArrayBuffer): SpaceMouseAxes {
  if (buffer.byteLength !== POSE_PACKET_SIZE) {
    throw new Error(
      `Invalid buffer size: expected ${POSE_PACKET_SIZE} bytes, got ${buffer.byteLength}`
    );
  }

  const dataView = new DataView(buffer);

  return {
    tx: dataView.getFloat32(8, true),
    ty: dataView.getFloat32(12, true),
    tz: dataView.getFloat32(16, true),
    rx: dataView.getFloat32(20, true),
    ry: dataView.getFloat32(24, true),
    rz: dataView.getFloat32(28, true),
  };
}

/**
 * Unpack an ArrayBuffer back into a TimestampedPose object.
 * @param buffer The ArrayBuffer to deserialize (must be 32 bytes)
 * @returns The unpacked pose with timestamp
 * @throws Error if buffer size is invalid
 */
export function unpackPoseWithTimestamp(buffer: ArrayBuffer): TimestampedPose {
  if (buffer.byteLength !== POSE_PACKET_SIZE) {
    throw new Error(
      `Invalid buffer size: expected ${POSE_PACKET_SIZE} bytes, got ${buffer.byteLength}`
    );
  }

  const dataView = new DataView(buffer);

  return {
    timestamp: dataView.getFloat64(0, true),
    axes: {
      tx: dataView.getFloat32(8, true),
      ty: dataView.getFloat32(12, true),
      tz: dataView.getFloat32(16, true),
      rx: dataView.getFloat32(20, true),
      ry: dataView.getFloat32(24, true),
      rz: dataView.getFloat32(28, true),
    },
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
