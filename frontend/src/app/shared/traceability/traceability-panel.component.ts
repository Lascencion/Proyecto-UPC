import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EntityType, TraceItem, Traceability } from '../../core/models';

export const TYPE_ICONS: Record<EntityType, string> = {
  requirements: 'description',
  'user-stories': 'person',
  'business-rules': 'gavel',
  'test-cases': 'fact_check',
  defects: 'bug_report',
};

/**
 * Trazabilidad de un registro (mejora de HU08): muestra en ambos sentidos los
 * requerimientos, historias, reglas, casos de prueba y defectos relacionados.
 * En modo `inline` (diálogo) al elegir un registro se muestra su trazabilidad en el
 * mismo panel; en modo `route` se abre la página del registro.
 */
@Component({
  selector: 'app-traceability-panel',
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './traceability-panel.component.html',
  styleUrl: './traceability-panel.component.scss',
})
export class TraceabilityPanelComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly type = input.required<string>();
  readonly id = input.required<string>();
  readonly mode = input<'route' | 'inline'>('route');

  /** Registro mostrado (en modo inline puede cambiar al navegar dentro del panel). */
  readonly current = signal<{ type: string; id: string } | null>(null);
  readonly data = signal<Traceability | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** Historial para volver atrás dentro del panel. */
  readonly history = signal<{ type: string; id: string }[]>([]);

  readonly icons = TYPE_ICONS;
  readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    // El propio tipo solo se muestra si tiene registros relacionados.
    return d.groups.filter((g) => g.type !== d.record.type || g.items.length);
  });
  readonly total = computed(() => this.groups().reduce((n, g) => n + g.items.length, 0));
  readonly coverage = computed(() => Object.entries(this.data()?.scenarioCoverage ?? {}));

  constructor() {
    effect(() => {
      const target = { type: this.type(), id: this.id() };
      untracked(() => {
        this.history.set([]);
        this.show(target);
      });
    });
  }

  private async show(target: { type: string; id: string }): Promise<void> {
    this.current.set(target);
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(await firstValueFrom(this.api.traceability(target.type, target.id)));
    } catch {
      this.data.set(null);
      this.error.set('No se pudo obtener la trazabilidad del registro.');
    } finally {
      this.loading.set(false);
    }
  }

  open(item: TraceItem): void {
    if (this.mode() === 'route') {
      this.router.navigate(['/conocimiento', item.type, item.id]);
      return;
    }
    this.history.update((h) => [...h, this.current()!]);
    this.show({ type: item.type, id: item.id });
  }

  back(): void {
    const h = this.history();
    if (!h.length) return;
    this.history.set(h.slice(0, -1));
    this.show(h[h.length - 1]);
  }

  relationText(item: TraceItem): string {
    return item.relation === 'directa' ? 'Relación directa' : `Relación indirecta, a través de ${item.via}`;
  }
}
