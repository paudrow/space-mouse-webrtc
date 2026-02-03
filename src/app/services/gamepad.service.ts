import { Injectable, NgZone, signal, inject, OnDestroy } from '@angular/core';
import { applyDeadzone, hasSignificantChange } from '../utils/deadzone';

/** 6 DOF axes for SpaceMouse - Translation and Rotation */
export interface SpaceMouseAxes {
  // Translation (linear movement)
  tx: number; // X translation (left/right)
  ty: number; // Y translation (up/down)
  tz: number; // Z translation (forward/back)
  // Rotation (angular movement)
  rx: number; // Pitch (tilt forward/back)
  ry: number; // Yaw (twist left/right)
  rz: number; // Roll (tilt left/right)
}

export interface SpaceMouseButtons {
  [index: number]: boolean;
}

export interface SpaceMouseState {
  connected: boolean;
  id: string;
  axes: SpaceMouseAxes;
  buttons: SpaceMouseButtons;
  timestamp: number;
}

const DEFAULT_STATE: SpaceMouseState = {
  connected: false,
  id: '',
  axes: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 },
  buttons: {},
  timestamp: 0,
};

// 3Dconnexion vendor ID
const VENDOR_ID_3DCONNEXION = 0x256f;

// Known SpaceMouse product IDs
const SPACEMOUSE_PRODUCT_IDS = [
  0xc62e, // SpaceMouse Compact
  0xc62f, // SpaceMouse Module
  0xc631, // SpaceMouse Pro Wireless (cabled)
  0xc632, // SpaceMouse Pro Wireless (wireless)
  0xc633, // SpaceMouse Enterprise
  0xc635, // SpaceMouse Compact (new)
  0xc652, // Universal Receiver
];

@Injectable({
  providedIn: 'root',
})
export class SpaceMouseService implements OnDestroy {
  private readonly ngZone = inject(NgZone);

  /** The SpaceMouse state exposed as a signal */
  readonly state = signal<SpaceMouseState>(DEFAULT_STATE);

  /** Whether WebHID is supported in this browser */
  readonly isSupported = signal<boolean>(this.checkWebHIDSupport());

  /** Error message if connection fails */
  readonly error = signal<string | null>(null);

  /** Deadzone threshold for axes */
  readonly deadzoneThreshold = 0.1;

  /** The maximum raw value from SpaceMouse (±350 typically) */
  private readonly maxRawValue = 350;

  private device: HIDDevice | null = null;
  private onDisconnectHandler = this.onDeviceDisconnected.bind(this);

  constructor() {
    this.setupEventListeners();
    this.tryReconnectPreviousDevice();
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
    this.disconnect();
  }

  private checkWebHIDSupport(): boolean {
    return 'hid' in navigator;
  }

  private setupEventListeners(): void {
    if (!this.isSupported()) return;
    navigator.hid.addEventListener('disconnect', this.onDisconnectHandler);
  }

  private removeEventListeners(): void {
    if (!this.isSupported()) return;
    navigator.hid.removeEventListener('disconnect', this.onDisconnectHandler);
  }

  /**
   * Request access to a SpaceMouse device.
   * Must be called from a user gesture (button click, etc.)
   */
  async requestDevice(): Promise<boolean> {
    if (!this.isSupported()) {
      console.error('WebHID is not supported in this browser');
      return false;
    }

    // Clear any previous error
    this.error.set(null);

    try {
      // Build filters for known SpaceMouse devices
      const filters: HIDDeviceFilter[] = SPACEMOUSE_PRODUCT_IDS.map((productId) => ({
        vendorId: VENDOR_ID_3DCONNEXION,
        productId,
      }));

      const [device] = await navigator.hid.requestDevice({ filters });

      if (device) {
        await this.connectToDevice(device);
        return true;
      }
    } catch (error) {
      console.error('Failed to request HID device:', error);
      if (error instanceof Error) {
        this.error.set(error.message);
      }
    }

    return false;
  }

  /**
   * Try to reconnect to a previously authorized device
   */
  private async tryReconnectPreviousDevice(): Promise<void> {
    if (!this.isSupported()) return;

    try {
      const devices = await navigator.hid.getDevices();
      const spaceMouse = devices.find(
        (d) =>
          d.vendorId === VENDOR_ID_3DCONNEXION &&
          SPACEMOUSE_PRODUCT_IDS.includes(d.productId)
      );

      if (spaceMouse) {
        await this.connectToDevice(spaceMouse);
      }
    } catch (error) {
      console.error('Failed to reconnect to previous device:', error);
    }
  }

  private async connectToDevice(device: HIDDevice): Promise<void> {
    try {
      console.log('Attempting to open device:', device.productName, 'opened:', device.opened);
      
      if (!device.opened) {
        await device.open();
        console.log('Device opened successfully');
      }

      this.device = device;
      console.log(`Connected to ${device.productName}`);
      console.log('Device collections:', device.collections);

      // Listen for input reports
      device.addEventListener('inputreport', this.onInputReport);
      console.log('Input report listener added');

      // Update state to connected
      this.ngZone.run(() => {
        this.state.update((s) => ({
          ...s,
          connected: true,
          id: device.productName || `SpaceMouse (${device.productId.toString(16)})`,
        }));
        console.log('State updated to connected');
      });
    } catch (error) {
      console.error('Failed to open device:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        this.ngZone.run(() => {
          this.error.set(
            'Cannot open device. Please quit the 3Dconnexion driver first (check your menu bar or Activity Monitor for "3DconnexionHelper").'
          );
        });
      } else if (error instanceof Error) {
        this.ngZone.run(() => {
          this.error.set(error.message);
        });
      }
    }
  }

  disconnect(): void {
    if (this.device) {
      this.device.removeEventListener('inputreport', this.onInputReport);
      this.device.close();
      this.device = null;
    }
    this.state.set(DEFAULT_STATE);
  }

  private onDeviceDisconnected(event: HIDConnectionEvent): void {
    if (event.device === this.device) {
      console.log('SpaceMouse disconnected');
      this.device = null;
      this.ngZone.run(() => {
        this.state.set(DEFAULT_STATE);
      });
    }
  }

  private onInputReport = (event: HIDInputReportEvent): void => {
    const { data, reportId } = event;

    console.log('Input report received:', reportId, 'bytes:', data.byteLength);

    // SpaceMouse sends different report types:
    // Report 1: Translation data (TX, TY, TZ)
    // Report 2: Rotation data (RX, RY, RZ)
    // Report 3: Button data

    const currentState = this.state();
    let newAxes = { ...currentState.axes };
    let newButtons = { ...currentState.buttons };

    if (reportId === 1 && data.byteLength >= 6) {
      // Translation data: 3 x 16-bit signed integers (little-endian)
      const tx = this.normalizeAxis(data.getInt16(0, true));
      const ty = this.normalizeAxis(data.getInt16(2, true));
      const tz = this.normalizeAxis(data.getInt16(4, true));
      newAxes = { ...newAxes, tx, ty, tz };
    } else if (reportId === 2 && data.byteLength >= 6) {
      // Rotation data: 3 x 16-bit signed integers (little-endian)
      const rx = this.normalizeAxis(data.getInt16(0, true));
      const ry = this.normalizeAxis(data.getInt16(2, true));
      const rz = this.normalizeAxis(data.getInt16(4, true));
      newAxes = { ...newAxes, rx, ry, rz };
    } else if (reportId === 3 && data.byteLength >= 2) {
      // Button data: bitmask
      const buttonMask = data.getUint16(0, true);
      newButtons = this.parseButtons(buttonMask);
    }

    // Only update if there are significant changes
    if (this.hasStateChanged(currentState, newAxes, newButtons)) {
      this.ngZone.run(() => {
        this.state.set({
          connected: true,
          id: currentState.id,
          axes: newAxes,
          buttons: newButtons,
          timestamp: performance.now(),
        });
      });
    }
  };

  private normalizeAxis(rawValue: number): number {
    // Normalize to -1 to 1 range and apply deadzone
    const normalized = Math.max(-1, Math.min(1, rawValue / this.maxRawValue));
    return applyDeadzone(normalized, this.deadzoneThreshold);
  }

  private parseButtons(mask: number): SpaceMouseButtons {
    const buttons: SpaceMouseButtons = {};
    // SpaceMouse typically has up to 16 buttons encoded as a bitmask
    for (let i = 0; i < 16; i++) {
      if (mask & (1 << i)) {
        buttons[i] = true;
      }
    }
    return buttons;
  }

  private hasStateChanged(
    current: SpaceMouseState,
    newAxes: SpaceMouseAxes,
    newButtons: SpaceMouseButtons
  ): boolean {
    // Check all 6 axes for significant changes
    if (
      hasSignificantChange(current.axes.tx, newAxes.tx) ||
      hasSignificantChange(current.axes.ty, newAxes.ty) ||
      hasSignificantChange(current.axes.tz, newAxes.tz) ||
      hasSignificantChange(current.axes.rx, newAxes.rx) ||
      hasSignificantChange(current.axes.ry, newAxes.ry) ||
      hasSignificantChange(current.axes.rz, newAxes.rz)
    ) {
      return true;
    }

    // Check buttons for any change
    const currentButtonKeys = Object.keys(current.buttons);
    const newButtonKeys = Object.keys(newButtons);

    if (currentButtonKeys.length !== newButtonKeys.length) {
      return true;
    }

    for (const key of currentButtonKeys) {
      const index = parseInt(key, 10);
      if (current.buttons[index] !== newButtons[index]) {
        return true;
      }
    }

    return false;
  }
}
