import { afterNextRender, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { EntityDefinition, FlowModule, ImportDetail, ImportRow } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { RecordFormComponent } from '../../shared/record-form/record-form.component';

export interface RowEditData {
  batchId: string;
  row: ImportRow;
  definition: EntityDefinition;
  modules: FlowModule[];
}

/** Corrige una fila del lote; mientras tenga errores el diálogo permanece abierto. */
@Component({
  selector: 'app-row-edit-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    RecordFormComponent,
  ],
  template: `
    <h2 mat-dialog-title>Corregir {{ data.definition.label.toLowerCase() }} · fila {{ row().index + 1 }}</h2>
    <mat-dialog-content>
      <p class="muted source">
        <mat-icon inline>description</mat-icon> {{ row().source.fileName }} — {{ row().source.location }}
      </p>
      @if (row().fieldErrors.length) {
        <ul class="error-box">
          @for (e of row().fieldErrors; track $index) {
            <li>{{ e.message }}</li>
          }
        </ul>
      }
      @if (row().fieldWarnings.length) {
        <ul class="warning-box">
          @for (w of row().fieldWarnings; track $index) {
            <li>{{ w.message }}</li>
          }
        </ul>
      }
      <mat-form-field class="module-field">
        <mat-label>Módulo / flujo</mat-label>
        <mat-select [(ngModel)]="module" required>
          @for (m of data.modules; track m.id) {
            <mat-option [value]="m.id">{{ m.name }}</mat-option>
          }
        </mat-select>
        @if (row().moduleName && !module) {
          <mat-hint>En el archivo: "{{ row().moduleName }}" (no existe en el catálogo)</mat-hint>
        }
      </mat-form-field>
      <app-record-form [definition]="data.definition" [value]="seed()" />
    </mat-dialog-content>
    @if (saving()) {
      <mat-progress-bar mode="indeterminate" />
    }
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="result">Cerrar</button>
      <button mat-flat-button (click)="save()" [disabled]="saving()">Aplicar corrección</button>
    </mat-dialog-actions>
  `,
  styles: `
    .source {
      margin-top: 0;
    }
    .module-field {
      width: 50%;
      min-width: 260px;
      margin-bottom: 12px;
    }
  `,
})
export class RowEditDialogComponent {
  readonly data = inject<RowEditData>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject(MatDialogRef<RowEditDialogComponent, ImportDetail | undefined>);
  private readonly recordForm = viewChild.required(RecordFormComponent);

  readonly row = signal(this.data.row);
  readonly seed = signal<Record<string, unknown>>(this.data.row.data);
  readonly saving = signal(false);
  module = this.data.row.module ?? '';
  /** Último estado del lote recibido, para actualizar la página al cerrar. */
  result: ImportDetail | undefined;

  constructor() {
    // Muestra los errores de la fila en los campos correspondientes.
    afterNextRender(() => this.recordForm().applyServerErrors(this.data.row.fieldErrors));
  }

  async save(): Promise<void> {
    this.saving.set(true);
    try {
      const body: Record<string, unknown> = { data: this.recordForm().getValue() };
      if (this.module) body['module'] = this.module;
      const detail = await firstValueFrom(this.api.updateImportRow(this.data.batchId, this.row().id, body));
      this.result = detail;
      const updated = detail.rows.find((r) => r.id === this.row().id)!;
      if (updated.status === 'error') {
        this.row.set(updated);
        this.seed.set(updated.data);
        this.module = updated.module ?? '';
        queueMicrotask(() => this.recordForm().applyServerErrors(updated.fieldErrors));
        this.notify.warn('La fila aún tiene errores.');
      } else {
        this.notify.success('Fila corregida.');
        this.ref.close(detail);
      }
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }
}
