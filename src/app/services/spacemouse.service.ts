import { Injectable, NgZone, signal, inject, OnDestroy } from '@angular/core';
import { applyDeadzone, hasSignificantChange } from '../utils/deadzone';
import { AXIS_INDEX, isSpaceMouse } from '../config/spacemouse.config';

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

/** Creates a fresh default state to prevent accidental mutation */
function createDefaultState(): SpaceMouseState {
  return {
    connected: false,
    id: '',
    axes: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 },
    buttons: {},
    timestamp: 0,
  };
}

@Injectable({
  providedIn: 'root',
})
export class SpaceMouseService implements OnDestroy {
  private readonly ngZone = inject(NgZone);

  /** The SpaceMouse state exposed as a signal */
  readonly state = signal<SpaceMouseState>(createDefaultState());

  /** Deadzone threshold for analog sticks */
  readonly deadzoneThreshold = 0.1;

  private animationFrameId: number | null = null;
  private isPolling = false;

  constructor() {
    this.setupEventListeners();
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.removeEventListeners();
  }

  private setupEventListeners(): void {
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  private removeEventListeners(): void {
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  private onGamepadConnected = (): void => {
    this.startPolling();
  };

  private onGamepadDisconnected = (): void => {
    // Check if any gamepads are still connected
    const gamepads = navigator.getGamepads();
    const hasConnectedGamepad = gamepads.some((gp) => gp !== null);

    if (!hasConnectedGamepad) {
      this.stopPolling();
      this.state.set(createDefaultState());
    }
  };

  private startPolling(): void {
    if (this.isPolling) return;

    this.isPolling = true;

    // Run the polling loop outside Angular zone to prevent
    // triggering change detection 60 times per second
    this.ngZone.runOutsideAngular(() => {
      this.poll();
    });
  }

  private stopPolling(): void {
    this.isPolling = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private poll = (): void => {
    if (!this.isPolling) return;

    this.updateGamepadState();
    this.animationFrameId = requestAnimationFrame(this.poll);
  };

  private updateGamepadState(): void {
    const gamepads = navigator.getGamepads();
    // Filter specifically for SpaceMouse to avoid capturing Xbox/PlayStation controllers
    const gamepad = gamepads.find((gp) => gp !== null && isSpaceMouse(gp)) ?? null;

    // If we were connected but now can't find the device, disconnect
    if (!gamepad) {
      if (this.state().connected) {
        this.ngZone.run(() => {
          this.state.set(createDefaultState());
        });
      }
      // Stop polling - no need to burn CPU at 60fps checking for a device.
      // The 'gamepadconnected' event will restart the loop when plugged back in.
      this.stopPolling();
      return;
    }

    const newAxes = this.normalizeAxes(gamepad.axes);
    const newButtons = this.normalizeButtons(gamepad.buttons);

    const currentState = this.state();

    // Only update if there are significant changes
    if (this.hasStateChanged(currentState, newAxes, newButtons, gamepad.connected)) {
      // Run inside Angular zone when updating the signal
      // to ensure any dependent components get notified
      this.ngZone.run(() => {
        this.state.set({
          connected: gamepad.connected,
          id: gamepad.id,
          axes: newAxes,
          buttons: newButtons,
          timestamp: gamepad.timestamp,
        });
      });
    }
  }

  private normalizeAxes(rawAxes: readonly number[]): SpaceMouseAxes {
    // Use named constants instead of magic numbers for cross-platform clarity
    return {
      tx: applyDeadzone(rawAxes[AXIS_INDEX.TX] ?? 0, this.deadzoneThreshold),
      ty: applyDeadzone(rawAxes[AXIS_INDEX.TY] ?? 0, this.deadzoneThreshold),
      tz: applyDeadzone(rawAxes[AXIS_INDEX.TZ] ?? 0, this.deadzoneThreshold),
      rx: applyDeadzone(rawAxes[AXIS_INDEX.RX] ?? 0, this.deadzoneThreshold),
      ry: applyDeadzone(rawAxes[AXIS_INDEX.RY] ?? 0, this.deadzoneThreshold),
      rz: applyDeadzone(rawAxes[AXIS_INDEX.RZ] ?? 0, this.deadzoneThreshold),
    };
  }

  private normalizeButtons(rawButtons: readonly GamepadButton[]): SpaceMouseButtons {
    const buttons: SpaceMouseButtons = {};
    rawButtons.forEach((button, index) => {
      buttons[index] = button.pressed;
    });
    return buttons;
  }

  private hasStateChanged(
    current: SpaceMouseState,
    newAxes: SpaceMouseAxes,
    newButtons: SpaceMouseButtons,
    connected: boolean
  ): boolean {
    // Connection state changed
    if (current.connected !== connected) {
      return true;
    }

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
