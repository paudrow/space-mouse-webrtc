import { Injectable, OnDestroy, inject, NgZone } from '@angular/core';
import { signal } from '@angular/core';
import { SpaceMouseService, SpaceMouseAxes } from './spacemouse.service';
import { packPose, unpackPoseWithTimestamp } from '../utils/pose-serializer';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'failed';

/**
 * WebRTC Loopback Service
 *
 * Creates a local WebRTC connection for testing the data channel transport.
 * In production, pc1 (sender) and pc2 (receiver) would be on different machines.
 */
@Injectable({
  providedIn: 'root',
})
export class WebRTCLoopbackService implements OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly spaceMouseService = inject(SpaceMouseService);

  // Connection state
  readonly connectionState = signal<ConnectionState>('disconnected');

  // Received pose data (from the "receiver" side)
  readonly receivedPose = signal<SpaceMouseAxes | null>(null);

  // Stats
  readonly packetsSent = signal(0);
  readonly packetsReceived = signal(0);

  // Latency tracking
  readonly latencyMs = signal<number | null>(null);
  readonly avgLatencyMs = signal<number | null>(null);
  private latencyHistory: number[] = [];
  private readonly LATENCY_HISTORY_SIZE = 30; // Average over last 30 samples

  // Peer connections
  private pc1: RTCPeerConnection | null = null; // Sender
  private pc2: RTCPeerConnection | null = null; // Receiver

  // Data channel
  private dataChannel: RTCDataChannel | null = null;

  // Gamepad subscription cleanup
  private gamepadEffectCleanup: (() => void) | null = null;

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Establish the WebRTC loopback connection
   */
  async connect(): Promise<void> {
    if (this.connectionState() !== 'disconnected') {
      return;
    }

    this.connectionState.set('connecting');

    try {
      // Create peer connections
      this.pc1 = new RTCPeerConnection();
      this.pc2 = new RTCPeerConnection();

      // Set up ICE candidate exchange (immediate loopback)
      this.pc1.onicecandidate = (event) => {
        if (event.candidate && this.pc2) {
          this.pc2.addIceCandidate(event.candidate);
        }
      };

      this.pc2.onicecandidate = (event) => {
        if (event.candidate && this.pc1) {
          this.pc1.addIceCandidate(event.candidate);
        }
      };

      // Monitor connection state
      this.pc1.onconnectionstatechange = () => {
        this.updateConnectionState();
      };

      this.pc2.onconnectionstatechange = () => {
        this.updateConnectionState();
      };

      // Create the data channel on pc1 (sender)
      this.dataChannel = this.pc1.createDataChannel('controls', {
        ordered: false, // UDP-like behavior
        maxRetransmits: 0, // No retransmits for real-time data
      });

      this.dataChannel.binaryType = 'arraybuffer';

      this.dataChannel.onopen = () => {
        this.ngZone.run(() => {
          this.connectionState.set('connected');
        });
        this.startSendingPose();
      };

      this.dataChannel.onclose = () => {
        this.ngZone.run(() => {
          this.connectionState.set('disconnected');
        });
      };

      this.dataChannel.onerror = () => {
        // Error handling could be added here if needed
      };

      // Handle incoming data channel on pc2 (receiver)
      this.pc2.ondatachannel = (event) => {
        const receiveChannel = event.channel;
        receiveChannel.binaryType = 'arraybuffer';

        receiveChannel.onmessage = (msgEvent) => {
          this.handleReceivedData(msgEvent.data);
        };
      };

      // Create and exchange offer/answer
      const offer = await this.pc1.createOffer();
      await this.pc1.setLocalDescription(offer);
      await this.pc2.setRemoteDescription(offer);

      const answer = await this.pc2.createAnswer();
      await this.pc2.setLocalDescription(answer);
      await this.pc1.setRemoteDescription(answer);
    } catch {
      this.connectionState.set('failed');
      this.disconnect();
    }
  }

  /**
   * Disconnect and clean up
   */
  disconnect(): void {
    this.stopSendingPose();

    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.pc1) {
      this.pc1.close();
      this.pc1 = null;
    }

    if (this.pc2) {
      this.pc2.close();
      this.pc2 = null;
    }

    this.connectionState.set('disconnected');
    this.packetsSent.set(0);
    this.packetsReceived.set(0);
    this.receivedPose.set(null);
    this.latencyMs.set(null);
    this.avgLatencyMs.set(null);
    this.latencyHistory = [];
  }

  /**
   * Manually send a pose (for testing)
   */
  sendPose(axes: SpaceMouseAxes): void {
    if (this.dataChannel?.readyState !== 'open') {
      return;
    }

    const buffer = packPose(axes);
    this.dataChannel.send(buffer);
    this.packetsSent.update((n) => n + 1);
  }

  private updateConnectionState(): void {
    const pc1State = this.pc1?.connectionState;
    const pc2State = this.pc2?.connectionState;

    if (pc1State === 'failed' || pc2State === 'failed') {
      this.ngZone.run(() => {
        this.connectionState.set('failed');
      });
    }
  }

  private startSendingPose(): void {
    // Use an effect-like pattern to send gamepad state changes
    // We'll poll the gamepad signal and send when connected
    let lastTimestamp = 0;

    const sendLoop = () => {
      if (this.connectionState() !== 'connected') {
        return;
      }

      const state = this.spaceMouseService.state();
      if (state.connected && state.timestamp !== lastTimestamp) {
        this.sendPose(state.axes);
        lastTimestamp = state.timestamp;
      }

      requestAnimationFrame(sendLoop);
    };

    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(sendLoop);
    });
  }

  private stopSendingPose(): void {
    if (this.gamepadEffectCleanup) {
      this.gamepadEffectCleanup();
      this.gamepadEffectCleanup = null;
    }
  }

  private handleReceivedData(data: ArrayBuffer): void {
    try {
      const receiveTime = performance.now();
      const { timestamp: sendTime, axes } = unpackPoseWithTimestamp(data);

      // Calculate latency
      const latency = receiveTime - sendTime;

      // Update latency history for averaging
      this.latencyHistory.push(latency);
      if (this.latencyHistory.length > this.LATENCY_HISTORY_SIZE) {
        this.latencyHistory.shift();
      }

      // Calculate average latency
      const avgLatency =
        this.latencyHistory.reduce((sum, l) => sum + l, 0) / this.latencyHistory.length;

      this.ngZone.run(() => {
        this.receivedPose.set(axes);
        this.packetsReceived.update((n) => n + 1);
        this.latencyMs.set(latency);
        this.avgLatencyMs.set(avgLatency);
      });
    } catch {
      // Invalid packet - silently ignore
    }
  }
}
