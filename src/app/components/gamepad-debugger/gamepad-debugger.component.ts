import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { GamepadService } from '../../services/gamepad.service';

@Component({
  selector: 'app-gamepad-debugger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="gamepad-debugger">
      <h2>SpaceMouse Debugger</h2>

      @if (isConnected()) {
        <div class="status connected">
          <span class="status-indicator"></span>
          Connected: {{ gamepadId() }}
        </div>

        <section class="axes-section">
          <h3>6 DOF Input</h3>
          <div class="axes-grid">
            <div class="axis-group">
              <h4>Translation</h4>
              <div class="axis-display">
                <div class="axis-value">
                  <span class="label">TX (Left/Right):</span>
                  <span class="value" [class.active]="axes().tx !== 0">
                    {{ axes().tx | number:'1.3-3' }}
                  </span>
                </div>
                <div class="axis-value">
                  <span class="label">TY (Up/Down):</span>
                  <span class="value" [class.active]="axes().ty !== 0">
                    {{ axes().ty | number:'1.3-3' }}
                  </span>
                </div>
                <div class="axis-value">
                  <span class="label">TZ (Fwd/Back):</span>
                  <span class="value" [class.active]="axes().tz !== 0">
                    {{ axes().tz | number:'1.3-3' }}
                  </span>
                </div>
                <div class="visual-3d">
                  <div class="visual-plane xy">
                    <span class="plane-label">XY</span>
                    <div
                      class="position-indicator"
                      [style.transform]="'translate(calc(-50% + ' + (axes().tx * 20) + 'px), calc(-50% + ' + (axes().ty * 20) + 'px))'"
                    ></div>
                  </div>
                  <div class="z-bar">
                    <span class="plane-label">Z</span>
                    <div class="z-track">
                      <div
                        class="z-indicator"
                        [style.transform]="'translateY(calc(-50% + ' + (axes().tz * -20) + 'px))'"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="axis-group">
              <h4>Rotation</h4>
              <div class="axis-display">
                <div class="axis-value">
                  <span class="label">RX (Pitch):</span>
                  <span class="value" [class.active]="axes().rx !== 0">
                    {{ axes().rx | number:'1.3-3' }}
                  </span>
                </div>
                <div class="axis-value">
                  <span class="label">RY (Yaw):</span>
                  <span class="value" [class.active]="axes().ry !== 0">
                    {{ axes().ry | number:'1.3-3' }}
                  </span>
                </div>
                <div class="axis-value">
                  <span class="label">RZ (Roll):</span>
                  <span class="value" [class.active]="axes().rz !== 0">
                    {{ axes().rz | number:'1.3-3' }}
                  </span>
                </div>
                <div class="visual-3d">
                  <div class="visual-plane xy">
                    <span class="plane-label">Pitch/Yaw</span>
                    <div
                      class="position-indicator"
                      [style.transform]="'translate(calc(-50% + ' + (axes().ry * 20) + 'px), calc(-50% + ' + (axes().rx * 20) + 'px))'"
                    ></div>
                  </div>
                  <div class="z-bar">
                    <span class="plane-label">Roll</span>
                    <div class="z-track">
                      <div
                        class="z-indicator"
                        [style.transform]="'translateY(calc(-50% + ' + (axes().rz * -20) + 'px))'"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="buttons-section">
          <h3>Buttons</h3>
          <div class="buttons-grid">
            @for (button of pressedButtons(); track button) {
              <div class="button-indicator pressed">
                Button {{ button }}
              </div>
            }
            @empty {
              <span class="no-buttons">No buttons pressed</span>
            }
          </div>
        </section>
      } @else {
        <div class="status disconnected">
          <span class="status-indicator"></span>
          No SpaceMouse connected
        </div>
        <p class="instructions">
          Connect your SpaceMouse and press any button to activate it.
        </p>
      }
    </div>
  `,
  styles: `
    .gamepad-debugger {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1.5rem;
      max-width: 600px;
      margin: 0 auto;
      background: #1a1a2e;
      border-radius: 12px;
      color: #e0e0e0;
    }

    h2 {
      margin-top: 0;
      color: #fff;
      border-bottom: 1px solid #333;
      padding-bottom: 0.5rem;
    }

    h3 {
      color: #aaa;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.75rem;
    }

    h4 {
      margin: 0 0 0.5rem 0;
      font-size: 0.85rem;
      color: #888;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status.connected {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .status.connected .status-indicator {
      background: #4caf50;
      box-shadow: 0 0 8px #4caf50;
    }

    .status.disconnected {
      background: rgba(158, 158, 158, 0.15);
      border: 1px solid rgba(158, 158, 158, 0.3);
    }

    .status.disconnected .status-indicator {
      background: #9e9e9e;
    }

    .instructions {
      color: #888;
      font-style: italic;
    }

    section {
      margin-bottom: 1.5rem;
    }

    .axes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .axis-group {
      background: rgba(255, 255, 255, 0.05);
      padding: 1rem;
      border-radius: 8px;
    }

    .axis-display {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .axis-value {
      display: flex;
      justify-content: space-between;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.9rem;
    }

    .label {
      color: #888;
    }

    .value {
      color: #666;
      transition: color 0.1s;
    }

    .value.active {
      color: #00bcd4;
    }

    .visual-3d {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.75rem;
      justify-content: center;
      align-items: center;
    }

    .visual-plane {
      width: 60px;
      height: 60px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      position: relative;
      border: 2px solid #333;
    }

    .plane-label {
      position: absolute;
      top: -18px;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.65rem;
      color: #666;
      text-transform: uppercase;
    }

    .position-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      background: #00bcd4;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: transform 0.05s ease-out;
      box-shadow: 0 0 8px rgba(0, 188, 212, 0.5);
    }

    .z-bar {
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
    }

    .z-track {
      width: 20px;
      height: 60px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 4px;
      position: relative;
      border: 2px solid #333;
    }

    .z-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 14px;
      height: 14px;
      background: #00bcd4;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      transition: transform 0.05s ease-out;
      box-shadow: 0 0 8px rgba(0, 188, 212, 0.5);
    }

    .buttons-section {
      background: rgba(255, 255, 255, 0.05);
      padding: 1rem;
      border-radius: 8px;
    }

    .buttons-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      min-height: 2rem;
      align-items: center;
    }

    .button-indicator {
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .button-indicator.pressed {
      background: #ff9800;
      color: #000;
      animation: pulse 0.3s ease-out;
    }

    .no-buttons {
      color: #666;
      font-style: italic;
    }

    @keyframes pulse {
      0% {
        transform: scale(1.1);
      }
      100% {
        transform: scale(1);
      }
    }
  `,
  imports: [DecimalPipe],
})
export class GamepadDebuggerComponent {
  private readonly gamepadService = inject(GamepadService);

  protected readonly state = this.gamepadService.state;

  protected readonly isConnected = computed(() => this.state().connected);
  protected readonly gamepadId = computed(() => this.state().id);
  protected readonly axes = computed(() => this.state().axes);

  protected readonly pressedButtons = computed(() => {
    const buttons = this.state().buttons;
    return Object.entries(buttons)
      .filter(([, pressed]) => pressed)
      .map(([index]) => parseInt(index, 10));
  });
}
