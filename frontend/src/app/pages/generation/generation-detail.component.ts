import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, OnDestroy, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { GenerationDetail, SCENARIO_TYPES } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ENTITY_TYPE_LABELS, GENERATION_STATUS_LABELS } from '../../shared/display';

@Component({
  selector: 'app-generation-detail',
  imports: [RouterLink, DatePipe, DecimalPipe, MatButtonModule, MatIconModule, MatExpansionModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './generation-detail.component.html',
  styleUrl: './generation-detail.component.scss',
})
export class GenerationDetailComponent implements OnDestroy {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);

  readonly id = input.required<string>();
  readonly detail = signal<GenerationDetail | null>(null);
  readonly statusLabels = GENERATION_STATUS_LABELS;
  readonly typeLabels = ENTITY_TYPE_LABELS;
  private timer?: ReturnType<typeof setInterval>;

  /** Cantidad de casos por tipo de escenario. */
  readonly byScenario = computed(() => {
    const cases = this.detail()?.cases ?? [];
    return SCENARIO_TYPES.map((t) => ({ type: t, count: cases.filter((c) => c.scenarioType === t).length })).filter(
      (x) => x.count || this.detail()?.request.params.scenarioTypes.includes(x.type),
    );
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    clearInterval(this.timer);
    try {
      const detail = await firstValueFrom(this.api.getGeneration(id));
      this.detail.set(detail);
      // Si aún se está generando, se actualiza cada dos segundos.
      if (detail.request.status === 'GENERANDO') {
        this.timer = setInterval(async () => {
          const d = await firstValueFrom(this.api.getGeneration(id));
          this.detail.set(d);
          if (d.request.status !== 'GENERANDO') clearInterval(this.timer);
        }, 2000);
      }
    } catch (e) {
      this.notify.error(e);
    }
  }

  seconds(ms?: number): string {
    return ms ? (ms / 1000).toFixed(1) : '—';
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
