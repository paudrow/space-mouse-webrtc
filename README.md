# SpaceMouse WebRTC

Stream 6-DOF SpaceMouse input over WebRTC for low-latency remote control applications.

## Overview

This project captures input from a 3Dconnexion SpaceMouse (6 degrees of freedom: 3 translation + 3 rotation axes), serializes it into a compact binary format, and transmits it over a WebRTC DataChannel. The current implementation uses a loopback connection for testing, but the architecture is designed to support real peer-to-peer connections.

### Why WebRTC?

WebRTC DataChannels provide:
- **Low latency**: Direct peer-to-peer connections minimize round-trip time
- **UDP-like behavior**: Configurable for unreliable/unordered delivery (ideal for real-time control)
- **NAT traversal**: Built-in ICE framework handles network address translation
- **Encryption**: All WebRTC traffic is encrypted by default (DTLS)

### Why Binary Serialization?

We serialize pose data as 32 raw bytes instead of JSON because:
- **Minimal overhead**: No parsing, no string conversion, no field names
- **Consistent size**: Every packet is exactly 32 bytes
- **Fast encoding/decoding**: Direct memory operations via `DataView`

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  SpaceMouse     │────▶│  Binary Packet   │────▶│  WebRTC         │
│  (Gamepad API)  │     │  (32 bytes)      │     │  DataChannel    │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                       │                        │
        │                       │                        │
  SpaceMouseService      pose-serializer.ts       WebRTCLoopbackService
  (polls at 60fps)       packPose/unpackPose      (loopback for testing)
```

### Layers

1. **Input Layer** (`SpaceMouseService`)
   - Polls the browser's Gamepad API at 60fps
   - Applies deadzone filtering to reduce noise
   - Exposes state as an Angular signal

2. **Serialization Layer** (`pose-serializer.ts`)
   - Packs 6 axes + timestamp into 32 bytes
   - Uses little-endian `Float64` for timestamp, `Float32` for axes

3. **Transport Layer** (`WebRTCLoopbackService`)
   - Creates a local WebRTC loopback for testing
   - Configures DataChannel for real-time: `{ ordered: false, maxRetransmits: 0 }`
   - Tracks latency metrics (current + rolling average)

## Binary Packet Format

| Bytes   | Type    | Field     | Description                    |
|---------|---------|-----------|--------------------------------|
| 0-7     | Float64 | timestamp | `performance.now()` at send    |
| 8-11    | Float32 | tx        | X translation (left/right)     |
| 12-15   | Float32 | ty        | Y translation (up/down)        |
| 16-19   | Float32 | tz        | Z translation (forward/back)   |
| 20-23   | Float32 | rx        | Pitch rotation                 |
| 24-27   | Float32 | ry        | Yaw rotation                   |
| 28-31   | Float32 | rz        | Roll rotation                  |

**Total: 32 bytes per packet**

The timestamp uses `Float64` for high precision (microsecond-level), while axes use `Float32` since SpaceMouse values are normalized to [-1, 1] and don't need more precision.

## SpaceMouse Connection

The SpaceMouse is accessed via the **Gamepad API**, not WebHID. This is intentional:

- **Gamepad API**: Works through the 3Dconnexion driver, which handles the low-level HID communication. No special permissions required, just plug and play.
- **WebHID**: Requires the 3Dconnexion driver to be unloaded on macOS due to exclusive device access. Not practical for most users.

The SpaceMouse reports 6 axes through the Gamepad API:
- Axes 0-2: Translation (TX, TY, TZ)
- Axes 3-5: Rotation (RX, RY, RZ)

A deadzone filter is applied to prevent noise when the device is at rest.

## WebRTC Configuration

The DataChannel is configured for real-time streaming:

```typescript
{
  ordered: false,     // Don't wait for out-of-order packets
  maxRetransmits: 0   // Don't retransmit lost packets
}
```

This gives UDP-like behavior—if a packet is lost, we skip it rather than waiting. For control input, the latest state is always more important than a stale one.

## Project Structure

```
src/app/
├── components/
│   ├── spacemouse-debugger/    # SpaceMouse input visualization
│   └── webrtc-debugger/        # WebRTC connection status and stats
├── services/
│   ├── spacemouse.service.ts   # SpaceMouse input polling
│   └── webrtc-loopback.service.ts  # WebRTC loopback transport
└── utils/
    ├── deadzone.ts             # Input filtering utilities
    └── pose-serializer.ts      # Binary pack/unpack functions
```

## Setup

### Prerequisites

- Node.js 18+
- A 3Dconnexion SpaceMouse (tested with SpaceMouse Compact)
- 3Dconnexion driver installed

### Installation

```bash
npm install
```

### Development

```bash
npm start
```

Navigate to `http://localhost:4200`. Connect your SpaceMouse and move it to see the input values. Click "Connect Loopback" in the WebRTC panel to test the full pipeline.

### Testing

```bash
npm test
```

Note: Some WebRTC tests are skipped in Node.js since `RTCPeerConnection` is only available in browsers. These tests run when using a browser-based test runner.

## Design Decisions

### Why Angular Signals?

Signals provide fine-grained reactivity without Zone.js overhead. The SpaceMouse polling runs outside Angular's zone (`runOutsideAngular`) to avoid triggering change detection 60 times per second. Signals are only updated when there's a meaningful change.

### Why OnPush Change Detection?

All components use `ChangeDetectionStrategy.OnPush` to prevent unnecessary re-renders. Combined with signals, this ensures optimal performance even with high-frequency updates.

### Why Loopback for Testing?

The loopback pattern (pc1 → pc2 on same machine) lets us develop and test the full WebRTC pipeline without needing a signaling server or second machine. The same code structure works for real connections—just replace the ICE candidate exchange with proper signaling.

### Pointer Lock

The app offers pointer lock (mouse capture) when using the SpaceMouse. This prevents accidental mouse movements from interfering with 3D navigation workflows.

## Future Work

- Real WebRTC signaling (WebSocket or other)
- TURN server support for NAT traversal
- Multiple SpaceMouse support
- Jitter and packet loss metrics
