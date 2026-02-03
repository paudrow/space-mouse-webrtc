import { SpaceMouseAxes } from '../services/gamepad.service';
import {
  packPose,
  unpackPose,
  unpackPoseWithTimestamp,
  POSE_PACKET_SIZE,
} from './pose-serializer';

describe('Pose Serializer', () => {
  const samplePose: SpaceMouseAxes = {
    tx: 0.5,
    ty: -0.25,
    tz: 0.75,
    rx: -0.1,
    ry: 0.33,
    rz: -0.9,
  };

  const zeroPose: SpaceMouseAxes = {
    tx: 0,
    ty: 0,
    tz: 0,
    rx: 0,
    ry: 0,
    rz: 0,
  };

  const extremePose: SpaceMouseAxes = {
    tx: 1.0,
    ty: -1.0,
    tz: 1.0,
    rx: -1.0,
    ry: 1.0,
    rz: -1.0,
  };

  describe('packPose', () => {
    it('should return an ArrayBuffer of correct size', () => {
      const buffer = packPose(samplePose);
      expect(buffer.byteLength).toBe(POSE_PACKET_SIZE);
      expect(buffer.byteLength).toBe(32);
    });

    it('should include timestamp in the buffer', () => {
      const timestamp = 12345.678;
      const buffer = packPose(samplePose, timestamp);
      const view = new DataView(buffer);
      expect(view.getFloat64(0, true)).toBeCloseTo(timestamp, 3);
    });
  });

  describe('unpackPose', () => {
    it('should throw error for invalid buffer size', () => {
      const invalidBuffer = new ArrayBuffer(10);
      expect(() => unpackPose(invalidBuffer)).toThrow(
        'Invalid buffer size: expected 32 bytes, got 10'
      );
    });

    it('should return a valid SpaceMouseAxes object', () => {
      const buffer = packPose(samplePose);
      const unpacked = unpackPose(buffer);

      expect(unpacked).toHaveProperty('tx');
      expect(unpacked).toHaveProperty('ty');
      expect(unpacked).toHaveProperty('tz');
      expect(unpacked).toHaveProperty('rx');
      expect(unpacked).toHaveProperty('ry');
      expect(unpacked).toHaveProperty('rz');
    });
  });

  describe('unpackPoseWithTimestamp', () => {
    it('should return both timestamp and axes', () => {
      const timestamp = 9999.123;
      const buffer = packPose(samplePose, timestamp);
      const result = unpackPoseWithTimestamp(buffer);

      expect(result.timestamp).toBeCloseTo(timestamp, 3);
      expect(result.axes.tx).toBeCloseTo(samplePose.tx, 5);
      expect(result.axes.ty).toBeCloseTo(samplePose.ty, 5);
    });
  });

  describe('round-trip serialization', () => {
    it('should preserve sample pose values through pack/unpack cycle', () => {
      const packed = packPose(samplePose);
      const unpacked = unpackPose(packed);

      expect(unpacked.tx).toBeCloseTo(samplePose.tx, 5);
      expect(unpacked.ty).toBeCloseTo(samplePose.ty, 5);
      expect(unpacked.tz).toBeCloseTo(samplePose.tz, 5);
      expect(unpacked.rx).toBeCloseTo(samplePose.rx, 5);
      expect(unpacked.ry).toBeCloseTo(samplePose.ry, 5);
      expect(unpacked.rz).toBeCloseTo(samplePose.rz, 5);
    });

    it('should preserve zero values', () => {
      const packed = packPose(zeroPose);
      const unpacked = unpackPose(packed);

      expect(unpacked.tx).toBe(0);
      expect(unpacked.ty).toBe(0);
      expect(unpacked.tz).toBe(0);
      expect(unpacked.rx).toBe(0);
      expect(unpacked.ry).toBe(0);
      expect(unpacked.rz).toBe(0);
    });

    it('should preserve extreme values (-1 to 1)', () => {
      const packed = packPose(extremePose);
      const unpacked = unpackPose(packed);

      expect(unpacked.tx).toBeCloseTo(extremePose.tx, 5);
      expect(unpacked.ty).toBeCloseTo(extremePose.ty, 5);
      expect(unpacked.tz).toBeCloseTo(extremePose.tz, 5);
      expect(unpacked.rx).toBeCloseTo(extremePose.rx, 5);
      expect(unpacked.ry).toBeCloseTo(extremePose.ry, 5);
      expect(unpacked.rz).toBeCloseTo(extremePose.rz, 5);
    });

    it('should handle small floating point values', () => {
      const smallPose: SpaceMouseAxes = {
        tx: 0.001,
        ty: -0.0005,
        tz: 0.0001,
        rx: -0.00001,
        ry: 0.00005,
        rz: -0.0003,
      };

      const packed = packPose(smallPose);
      const unpacked = unpackPose(packed);

      // Float32 has ~7 decimal digits of precision
      expect(unpacked.tx).toBeCloseTo(smallPose.tx, 4);
      expect(unpacked.ty).toBeCloseTo(smallPose.ty, 4);
      expect(unpacked.tz).toBeCloseTo(smallPose.tz, 4);
      expect(unpacked.rx).toBeCloseTo(smallPose.rx, 4);
      expect(unpacked.ry).toBeCloseTo(smallPose.ry, 4);
      expect(unpacked.rz).toBeCloseTo(smallPose.rz, 4);
    });
  });

  describe('POSE_PACKET_SIZE constant', () => {
    it('should be 32 bytes (1 float64 + 6 floats × 4 bytes)', () => {
      expect(POSE_PACKET_SIZE).toBe(32);
    });
  });
});
