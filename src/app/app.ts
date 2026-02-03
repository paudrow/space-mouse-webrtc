import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GamepadDebuggerComponent } from './components/gamepad-debugger/gamepad-debugger.component';
import { WebRTCDebuggerComponent } from './components/webrtc-debugger/webrtc-debugger.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, GamepadDebuggerComponent, WebRTCDebuggerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('space-mouse-webrtc');
}
