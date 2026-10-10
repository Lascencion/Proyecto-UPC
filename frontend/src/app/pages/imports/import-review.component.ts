import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { FlowModule, ImportBatch, ImportDetail, ImportRow, RowStatus } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { BATCH_STATUS_LABELS, ROW_RESULT_LABELS, ROW_STATUS_LABELS } from '../../shared/display';
import { RowEditDialogComponent, RowEditData } from './row-edit-dialog.component';

@Component({
  selector: 'app-import-review',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSelectModule,
    MatFormFieldModule,
    MatTooltipModule,
    MatProgressBarModule,
    MatExpansionModule,
  ],
  templateUrl: './import-review.component.html',
  styleUrl: './import-review.component.scss',
})
export class ImportReviewComponent {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  readonly definitions = toSignal(this.api.definitions(), { initialValue: [] });
  readonly detail = signal<ImportDetail | null>(null);
  readonly modules = signal<FlowModule[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);

  readonly statusFilter = signal<'all' | RowStatus>('all');
  readonly typeFilter = signal<string>('all');
  readonly pageIndex = signal(0);
  readonly pageSize = signal(25);

  readonly statusLabels: Record<string, string> = ROW_STATUS_LABELS;
  readonly batchLabels = BATCH_STATUS_LABELS;
  readonly resultLabels = ROW_RESULT_LABELS;

  readonly batch = computed(() => this.detail()?.batch ?? null);
  readonly editable = computed(() => this.batch()?.status === 'EN_REVISION');
  readonly columns = computed(() => [
    'index',
    'type',
    'reference',
    ...(this.editable() ? [] : ['finalCode']),
    'title',
    'module',
    'source',
    'status',
    'issues',
    ...(this.editable() ? ['actions'] : ['result']),
  ]);

  readonly filteredRows = computed(() => {
    const rows = this.detail()?.rows ?? [];
    return rows.filter(
      (r) => (this.statusFilter() === 'all' || r.status === this.statusFilter()) && (this.typeFilter() === 'all' || r.type === this.typeFilter()),
    );
  });
  readonly pagedRows = computed(() => {
    const start = this.pageIndex() * this.pageSize();
    return this.filteredRows().slice(start, start + this.pageSize());
  });
  readonly typesInBatch = computed(() => {
    const types = new Set((this.detail()?.rows ?? []).map((r) => r.type));
    return this.definitions().filter((d) => types.has(d.type));
  });
  readonly moduleNames = computed(() => new Map(this.modules().map((m) => [m.id, m.name])));

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const detail = await firstValueFrom(this.api.getImport(id));
      this.modules.set(await firstValueFrom(this.api.modules(detail.batch.project.id)));
      this.detail.set(detail);
    } catch (e) {
      this.notify.error(e);
      this.router.navigateByUrl('/carga-masiva');
    } finally {
      this.loading.set(false);
    }
  }

  fileNames(b: ImportBatch): string {
    return b.files.map((f) => f.name).join(', ');
  }

  definitionOf(type: string) {
    return this.definitions().find((d) => d.type === type);
  }

  title(row: ImportRow): string {
    const def = this.definitionOf(row.type);
    return def ? String(row.data[def.titleField] ?? '') : '';
  }

  moduleLabel(row: ImportRow): string {
    if (row.module) return this.moduleNames().get(row.module) ?? '—';
    return row.moduleName ? `${row.moduleName} (no existe)` : '—';
  }

  setStatusFilter(value: 'all' | RowStatus): void {
    this.statusFilter.set(value);
    this.pageIndex.set(0);
  }

  setTypeFilter(value: string): void {
    this.typeFilter.set(value);
    this.pageIndex.set(0);
  }

  onPage(e: PageEvent): void {
    this.pageIndex.set(e.pageIndex);
    this.pageSize.set(e.pageSize);
  }

  private async run(action: () => Promise<ImportDetail>, success?: string): Promise<void> {
    this.busy.set(true);
    try {
      this.detail.set(await action());
      if (success) this.notify.success(success);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.busy.set(false);
    }
  }

  edit(row: ImportRow): void {
    const definition = this.definitionOf(row.type);
    if (!definition || !this.editable()) return;
    this.dialog
      .open<RowEditDialogComponent, RowEditData, ImportDetail | undefined>(RowEditDialogComponent, {
        data: { batchId: this.id(), row, definition, modules: this.modules() },
        width: '960px',
        maxWidth: '95vw',
        autoFocus: false,
      })
      .afterClosed()
      .subscribe((detail) => detail && this.detail.set(detail));
  }

  toggleExcluded(row: ImportRow): void {
    this.run(() => firstValueFrom(this.api.updateImportRow(this.id(), row.id, { excluded: !row.excluded })));
  }

  async confirm(): Promise<void> {
    const detail = this.detail()!;
    const active = detail.rows.filter((r) => !r.excluded);
    const ok = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Confirmar carga',
            message:
              `Se registrarán ${active.length} registro(s) en la base de conocimiento. ` +
              'El sistema asignará a cada uno su código definitivo y actualizará las relaciones entre ellos.' +
              (detail.batch.summary['excluded'] ? `\n• ${detail.batch.summary['excluded']} fila(s) excluida(s) no se guardarán` : ''),
            confirmText: 'Guardar',
          },
        })
        .afterClosed(),
    );
    if (ok) this.run(() => firstValueFrom(this.api.confirmImport(this.id())), 'Carga confirmada.');
  }

  async cancel(): Promise<void> {
    const ok = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Cancelar carga',
            message: 'Se descartarán todas las filas del lote. No se guardará nada en la base de conocimiento.',
            confirmText: 'Descartar lote',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (ok) this.run(() => firstValueFrom(this.api.cancelImport(this.id())), 'Lote cancelado.');
  }
}
