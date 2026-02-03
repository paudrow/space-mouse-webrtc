import { applyDeadzone, hasSignificantChange } from './deadzone';

describe('Deadzone Utilities', () => {
  describe('applyDeadzone', () => {
    it('should return 0 for values within threshold', () => {
      expect(applyDeadzone(0.05, 0.1)).toBe(0);
      expect(applyDeadzone(-0.05, 0.1)).toBe(0);
      expect(applyDeadzone(0, 0.1)).toBe(0);
      expect(applyDeadzone(0.09, 0.1)).toBe(0);
    });

    it('should scale values outside threshold to start from 0', () => {
      // At exactly threshold, should be near 0
      expect(applyDeadzone(0.1, 0.1)).toBeCloseTo(0, 5);

      // At max (1.0), should be close to 1.0
      expect(applyDeadzone(1.0, 0.1)).toBeCloseTo(1.0, 5);

      // Midway between threshold and max should scale proportionally
      expect(applyDeadzone(0.55, 0.1)).toBeCloseTo(0.5, 5);
    });

    it('should preserve sign for negative values', () => {
      expect(applyDeadzone(-1.0, 0.1)).toBeCloseTo(-1.0, 5);
      expect(applyDeadzone(-0.55, 0.1)).toBeCloseTo(-0.5, 5);
    });

    it('should clamp output to max of 1', () => {
      expect(applyDeadzone(1.5, 0.1)).toBe(1);
      expect(applyDeadzone(-1.5, 0.1)).toBe(-1);
    });

    it('should use default threshold of 0.1', () => {
      expect(applyDeadzone(0.05)).toBe(0);
      expect(applyDeadzone(0.2)).toBeGreaterThan(0);
    });
  });

  describe('hasSignificantChange', () => {
    it('should return false for identical values', () => {
      expect(hasSignificantChange(0.5, 0.5)).toBe(false);
      expect(hasSignificantChange(0, 0)).toBe(false);
    });

    it('should return false for changes within epsilon', () => {
      expect(hasSignificantChange(0.5, 0.5005, 0.001)).toBe(false);
      expect(hasSignificantChange(0.5, 0.4995, 0.001)).toBe(false);
    });

    it('should return true for changes exceeding epsilon', () => {
      expect(hasSignificantChange(0.5, 0.502, 0.001)).toBe(true);
      expect(hasSignificantChange(0.5, 0.498, 0.001)).toBe(true);
    });

    it('should use default epsilon of 0.001', () => {
      expect(hasSignificantChange(0, 0.0005)).toBe(false);
      expect(hasSignificantChange(0, 0.002)).toBe(true);
    });
  });
});
