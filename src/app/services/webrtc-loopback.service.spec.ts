import { TestBed } from '@angular/core/testing';
import { WebRTCLoopbackService } from './webrtc-loopback.service';
import { SpaceMouseService } from './spacemouse.service';
import { signal } from '@angular/core';

/**
 * Predicate-based wait helper to avoid flaky setTimeout tests.
 * Polls until the predicate returns true or timeout is reached.
 */
async function waitFor(
  predicate: () => boolean,
  timeout = 2000,
  interval = 10
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error(`waitFor timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

describe('WebRTCLoopbackService', () => {
  let service: WebRTCLoopbackService;

  // Mock gamepad state
  const mockGamepadState = signal({
    connected: false,
    id: '',
    axes: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 },
    buttons: {},
    timestamp: 0,
  });

  // Check if RTCPeerConnection is available (browser environment)
  const hasWebRTC = typeof RTCPeerConnection !== 'undefined';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        WebRTCLoopbackService,
        {
          provide: SpaceMouseService,
          useValue: {
            state: mockGamepadState,
          },
        },
      ],
    });
    service = TestBed.inject(WebRTCLoopbackService);
  });

  afterEach(() => {
    service.disconnect();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should start in disconnected state', () => {
    expect(service.connectionState()).toBe('disconnected');
  });

  it('should have zero packets sent/received initially', () => {
    expect(service.packetsSent()).toBe(0);
    expect(service.packetsReceived()).toBe(0);
  });

  it('should have null received pose initially', () => {
    expect(service.receivedPose()).toBeNull();
  });

  it('should not send when not connected', () => {
    const testPose = {
      tx: 0.5,
      ty: 0.5,
      tz: 0.5,
      rx: 0.5,
      ry: 0.5,
      rz: 0.5,
    };

    service.sendPose(testPose);

    expect(service.packetsSent()).toBe(0);
  });

  // WebRTC-specific tests - only run in browser environment
  (hasWebRTC ? describe : describe.skip)('WebRTC connection tests', () => {
    it('should connect and reach connected state', async () => {
      await service.connect();
      await waitFor(() => service.connectionState() === 'connected');

      expect(service.connectionState()).toBe('connected');
    });

    it('should disconnect properly', async () => {
      await service.connect();
      await waitFor(() => service.connectionState() === 'connected');

      service.disconnect();

      expect(service.connectionState()).toBe('disconnected');
      expect(service.packetsSent()).toBe(0);
      expect(service.packetsReceived()).toBe(0);
    });

    it('should send and receive pose data through loopback', async () => {
      await service.connect();
      await waitFor(() => service.connectionState() === 'connected');

      const testPose = {
        tx: 0.5,
        ty: -0.25,
        tz: 0.75,
        rx: -0.1,
        ry: 0.33,
        rz: -0.9,
      };

      service.sendPose(testPose);
      await waitFor(() => service.packetsReceived() === 1);

      expect(service.packetsSent()).toBe(1);
      expect(service.packetsReceived()).toBe(1);

      const received = service.receivedPose();
      expect(received).toBeTruthy();
      expect(received!.tx).toBeCloseTo(testPose.tx, 5);
      expect(received!.ty).toBeCloseTo(testPose.ty, 5);
      expect(received!.tz).toBeCloseTo(testPose.tz, 5);
      expect(received!.rx).toBeCloseTo(testPose.rx, 5);
      expect(received!.ry).toBeCloseTo(testPose.ry, 5);
      expect(received!.rz).toBeCloseTo(testPose.rz, 5);
    });
  });
});
