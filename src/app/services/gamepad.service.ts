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

export interface GamepadButtons {
  [index: number]: boolean;
}

export interface NormalizedGamepadState {
  connected: boolean;
  id: string;
  axes: SpaceMouseAxes;
  buttons: GamepadButtons;
  timestamp: number;
}

const DEFAULT_STATE: NormalizedGamepadState = {
  connected: false,
  id: '',
  axes: { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 },
  buttons: {},
  timestamp: 0,
};

@Injectable({
  providedIn: 'root',
})
export class GamepadService implements OnDestroy {
  private readonly ngZone = inject(NgZone);

  /** The normalized gamepad state exposed as a signal */
  readonly state = signal<NormalizedGamepadState>(DEFAULT_STATE);

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

  private onGamepadConnected = (event: GamepadEvent): void => {
    console.log('Gamepad connected:', event.gamepad.id);
    this.startPolling();
  };

  private onGamepadDisconnected = (event: GamepadEvent): void => {
    console.log('Gamepad disconnected:', event.gamepad.id);

    // Check if any gamepads are still connected
    const gamepads = navigator.getGamepads();
    const hasConnectedGamepad = gamepads.some((gp) => gp !== null);

    if (!hasConnectedGamepad) {
      this.stopPolling();
      this.state.set(DEFAULT_STATE);
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
    const gamepad = gamepads.find((gp) => gp !== null) ?? null;

    if (!gamepad) {
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
    // SpaceMouse typically reports 6 axes: TX, TY, TZ, RX, RY, RZ
    return {
      tx: applyDeadzone(rawAxes[0] ?? 0, this.deadzoneThreshold),
      ty: applyDeadzone(rawAxes[1] ?? 0, this.deadzoneThreshold),
      tz: applyDeadzone(rawAxes[2] ?? 0, this.deadzoneThreshold),
      rx: applyDeadzone(rawAxes[3] ?? 0, this.deadzoneThreshold),
      ry: applyDeadzone(rawAxes[4] ?? 0, this.deadzoneThreshold),
      rz: applyDeadzone(rawAxes[5] ?? 0, this.deadzoneThreshold),
    };
  }

  private normalizeButtons(rawButtons: readonly GamepadButton[]): GamepadButtons {
    const buttons: GamepadButtons = {};
    rawButtons.forEach((button, index) => {
      buttons[index] = button.pressed;
    });
    return buttons;
  }

  private hasStateChanged(
    current: NormalizedGamepadState,
    newAxes: SpaceMouseAxes,
    newButtons: GamepadButtons,
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
