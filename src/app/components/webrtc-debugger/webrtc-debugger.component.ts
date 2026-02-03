import { Component, inject, computed, ChangeDetectionStrategy } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { WebRTCLoopbackService } from '../../services/webrtc-loopback.service';

@Component({
  selector: 'app-webrtc-debugger',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="webrtc-debugger">
      <h2>WebRTC Loopback</h2>

      <div class="connection-controls">
        <div class="status" [class]="connectionState()">
          <span class="status-indicator"></span>
          {{ connectionStateLabel() }}
        </div>

        @if (connectionState() === 'disconnected' || connectionState() === 'failed') {
          <button class="connect-btn" (click)="connect()">
            Connect Loopback
          </button>
        } @else if (connectionState() === 'connected') {
          <button class="disconnect-btn" (click)="disconnect()">
            Disconnect
          </button>
        }
      </div>

      @if (connectionState() === 'connected') {
        <div class="stats">
          <div class="stat">
            <span class="stat-label">Packets Sent:</span>
            <span class="stat-value">{{ packetsSent() }}</span>
          </div>
          <div class="stat">
            <span class="stat-label">Packets Received:</span>
            <span class="stat-value">{{ packetsReceived() }}</span>
          </div>
        </div>

        <div class="latency-stats">
          <div class="latency-item">
            <span class="latency-label">Latency:</span>
            <span class="latency-value" [class.good]="latencyMs() !== null && latencyMs()! < 5" [class.ok]="latencyMs() !== null && latencyMs()! >= 5 && latencyMs()! < 20" [class.bad]="latencyMs() !== null && latencyMs()! >= 20">
              @if (latencyMs() !== null) {
                {{ latencyMs() | number: '1.2-2' }} ms
              } @else {
                --
              }
            </span>
          </div>
          <div class="latency-item">
            <span class="latency-label">Avg Latency:</span>
            <span class="latency-value">
              @if (avgLatencyMs() !== null) {
                {{ avgLatencyMs() | number: '1.2-2' }} ms
              } @else {
                --
              }
            </span>
          </div>
        </div>

        @if (receivedPose()) {
          <section class="received-data">
            <h3>Received Pose Data</h3>
            <div class="pose-grid">
              <div class="pose-group">
                <h4>Translation</h4>
                <div class="pose-value">
                  <span class="label">TX:</span>
                  <span class="value" [class.active]="receivedPose()!.tx !== 0">
                    {{ receivedPose()!.tx | number: '1.3-3' }}
                  </span>
                </div>
                <div class="pose-value">
                  <span class="label">TY:</span>
                  <span class="value" [class.active]="receivedPose()!.ty !== 0">
                    {{ receivedPose()!.ty | number: '1.3-3' }}
                  </span>
                </div>
                <div class="pose-value">
                  <span class="label">TZ:</span>
                  <span class="value" [class.active]="receivedPose()!.tz !== 0">
                    {{ receivedPose()!.tz | number: '1.3-3' }}
                  </span>
                </div>
              </div>

              <div class="pose-group">
                <h4>Rotation</h4>
                <div class="pose-value">
                  <span class="label">RX:</span>
                  <span class="value" [class.active]="receivedPose()!.rx !== 0">
                    {{ receivedPose()!.rx | number: '1.3-3' }}
                  </span>
                </div>
                <div class="pose-value">
                  <span class="label">RY:</span>
                  <span class="value" [class.active]="receivedPose()!.ry !== 0">
                    {{ receivedPose()!.ry | number: '1.3-3' }}
                  </span>
                </div>
                <div class="pose-value">
                  <span class="label">RZ:</span>
                  <span class="value" [class.active]="receivedPose()!.rz !== 0">
                    {{ receivedPose()!.rz | number: '1.3-3' }}
                  </span>
                </div>
              </div>
            </div>
          </section>
        } @else {
          <p class="no-data">Waiting for pose data...</p>
        }
      }
    </div>
  `,
  styles: `
    .webrtc-debugger {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 1.5rem;
      max-width: 600px;
      margin: 1rem auto;
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

    .connection-controls {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .status.disconnected {
      background: rgba(158, 158, 158, 0.15);
      border: 1px solid rgba(158, 158, 158, 0.3);
    }

    .status.disconnected .status-indicator {
      background: #9e9e9e;
    }

    .status.connecting {
      background: rgba(255, 193, 7, 0.15);
      border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .status.connecting .status-indicator {
      background: #ffc107;
      animation: pulse 1s infinite;
    }

    .status.connected {
      background: rgba(76, 175, 80, 0.15);
      border: 1px solid rgba(76, 175, 80, 0.3);
    }

    .status.connected .status-indicator {
      background: #4caf50;
      box-shadow: 0 0 8px #4caf50;
    }

    .status.failed {
      background: rgba(244, 67, 54, 0.15);
      border: 1px solid rgba(244, 67, 54, 0.3);
    }

    .status.failed .status-indicator {
      background: #f44336;
    }

    .connect-btn,
    .disconnect-btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 6px;
      font-size: 0.9rem;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .connect-btn {
      background: #00bcd4;
      color: #000;
    }

    .connect-btn:hover {
      background: #00acc1;
    }

    .disconnect-btn {
      background: rgba(255, 255, 255, 0.1);
      color: #aaa;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .disconnect-btn:hover {
      background: rgba(244, 67, 54, 0.2);
      border-color: rgba(244, 67, 54, 0.4);
      color: #f44336;
    }

    .stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 0.5rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }

    .latency-stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 1rem;
      padding: 0.75rem;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
    }

    .latency-item {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }

    .latency-label {
      color: #888;
    }

    .latency-value {
      font-family: 'SF Mono', 'Consolas', monospace;
      font-weight: 600;
      color: #aaa;
    }

    .latency-value.good {
      color: #4caf50;
    }

    .latency-value.ok {
      color: #ffc107;
    }

    .latency-value.bad {
      color: #f44336;
    }

    .stat {
      display: flex;
      gap: 0.5rem;
    }

    .stat-label {
      color: #888;
    }

    .stat-value {
      color: #00bcd4;
      font-family: 'SF Mono', 'Consolas', monospace;
    }

    .received-data {
      background: rgba(255, 255, 255, 0.05);
      padding: 1rem;
      border-radius: 8px;
    }

    .pose-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1rem;
    }

    .pose-group {
      background: rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      border-radius: 6px;
    }

    .pose-value {
      display: flex;
      justify-content: space-between;
      font-family: 'SF Mono', 'Consolas', monospace;
      font-size: 0.85rem;
      padding: 0.25rem 0;
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

    .no-data {
      color: #666;
      font-style: italic;
      text-align: center;
      padding: 1rem;
    }

    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.5;
      }
    }
  `,
  imports: [DecimalPipe],
})
export class WebRTCDebuggerComponent {
  private readonly webrtcService = inject(WebRTCLoopbackService);

  protected readonly connectionState = this.webrtcService.connectionState;
  protected readonly receivedPose = this.webrtcService.receivedPose;
  protected readonly packetsSent = this.webrtcService.packetsSent;
  protected readonly packetsReceived = this.webrtcService.packetsReceived;
  protected readonly latencyMs = this.webrtcService.latencyMs;
  protected readonly avgLatencyMs = this.webrtcService.avgLatencyMs;

  protected readonly connectionStateLabel = computed(() => {
    switch (this.connectionState()) {
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting...';
      case 'connected':
        return 'Connected';
      case 'failed':
        return 'Connection Failed';
    }
  });

  async connect(): Promise<void> {
    await this.webrtcService.connect();
  }

  disconnect(): void {
    this.webrtcService.disconnect();
  }
}
