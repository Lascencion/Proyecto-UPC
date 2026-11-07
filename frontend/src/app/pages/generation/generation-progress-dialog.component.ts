import { Component, inject, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GenerationRequest, GenerationStep } from '../../core/models';

const ORDER: GenerationStep[] = ['contexto', 'instruccion', 'respuesta', 'completado'];

/** Muestra el avance de la generación consultando su estado cada segundo y medio. */
@Component({
  selector: 'app-generation-progress-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule],
  template: `
    <h2 mat-dialog-title>Generando casos de prueba</h2>
    <mat-dialog-content>
      <ul class="steps">
        @for (s of steps(); track s.key) {
          <li [class.done]="s.state === 'done'" [class.active]="s.state === 'active'">
            <mat-icon>{{ s.state === 'done' ? 'check_circle' : s.state === 'active' ? 'radio_button_checked' : 'radio_button_unchecked' }}</mat-icon>
            {{ s.label }}
          </li>
        }
      </ul>
      @if (request()?.status === 'ERROR') {
        <p class="error-box">{{ request()?.error }}</p>
      } @else {
        <mat-progress-bar mode="indeterminate" />
        <p class="muted small">Puede tardar hasta un minuto. Los casos quedarán guardados en «Mis generaciones».</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (request()?.status === 'ERROR') {
        <button mat-button (click)="ref.close('detalle')">Ver solicitud</button>
        <button mat-flat-button (click)="ref.close()">Volver a intentar</button>
      } @else {
        <button mat-button (click)="ref.close('detalle')">Seguir en segundo plano</button>
      }
    </mat-dialog-actions>
  `,
  styles: `
    .steps {
      list-style: none;
      padding: 0;
      margin: 0 0 16px;
      li {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 0;
        color: var(--mat-sys-on-surface-variant);
      }
      li.done mat-icon {
        color: var(--app-success);
      }
      li.active {
        color: var(--mat-sys-on-surface);
        font-weight: 500;
      }
      li.active mat-icon {
        color: var(--mat-sys-primary);
      }
    }
    .small {
      font-size: 13px;
    }
  `,
})
export class GenerationProgressDialogComponent implements OnDestroy {
  readonly data = inject<{ id: string; contextCount: number }>(MAT_DIALOG_DATA);
  readonly ref = inject(MatDialogRef<GenerationProgressDialogComponent, 'detalle' | 'listo' | undefined>);
  private readonly api = inject(ApiService);
  readonly request = signal<GenerationRequest | null>(null);
  private timer = setInterval(() => this.poll(), 1500);

  constructor() {
    this.poll();
  }

  steps() {
    const current = this.request()?.step ?? 'contexto';
    const idx = ORDER.indexOf(current);
    const labels: [GenerationStep, string][] = [
      ['contexto', `Contexto recuperado: ${this.data.contextCount} registro(s) seleccionado(s)`],
      ['instruccion', 'Instrucción para el LLM construida'],
      ['respuesta', 'Esperando la respuesta del LLM'],
    ];
    return labels.map(([key, label], i) => ({
      key,
      label,
      state: i < idx || current === 'completado' ? 'done' : i === idx ? 'active' : 'pending',
    }));
  }

  private async poll(): Promise<void> {
    try {
      const detail = await firstValueFrom(this.api.getGeneration(this.data.id));
      this.request.set(detail.request);
      if (detail.request.status !== 'GENERANDO') clearInterval(this.timer);
      if (detail.request.status === 'GENERADO') this.ref.close('listo');
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
