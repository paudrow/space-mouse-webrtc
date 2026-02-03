import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpaceMouseDebuggerComponent } from './components/spacemouse-debugger/spacemouse-debugger.component';
import { WebRTCDebuggerComponent } from './components/webrtc-debugger/webrtc-debugger.component';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, SpaceMouseDebuggerComponent, WebRTCDebuggerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('space-mouse-webrtc');
}
