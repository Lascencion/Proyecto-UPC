import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
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
 * Se usa en el diálogo del listado y es de solo consulta (los códigos no son enlaces).
 */
@Component({
  selector: 'app-traceability-panel',
  imports: [MatIconModule, MatProgressBarModule, MatTooltipModule],
  templateUrl: './traceability-panel.component.html',
  styleUrl: './traceability-panel.component.scss',
})
export class TraceabilityPanelComponent {
  private readonly api = inject(ApiService);

  readonly type = input.required<string>();
  readonly id = input.required<string>();

  readonly data = signal<Traceability | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly icons = TYPE_ICONS;
  readonly groups = computed(() => {
    const d = this.data();
    if (!d) return [];
    // El propio tipo solo se muestra si tiene registros relacionados.
    return d.groups.filter((g) => g.type !== d.record.type || g.items.length);
  });
  readonly total = computed(() => this.groups().reduce((n, g) => n + g.items.length, 0));
  readonly hasIndirect = computed(() => this.groups().some((g) => g.items.some((i) => i.relation === 'indirecta')));

  constructor() {
    effect(() => {
      const target = { type: this.type(), id: this.id() };
      untracked(() => this.show(target));
    });
  }

  private async show(target: { type: string; id: string }): Promise<void> {
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

  relationText(item: TraceItem): string {
    return item.relation === 'directa' ? 'Relación directa' : `Relación indirecta, a través de ${item.via}`;
  }
}
