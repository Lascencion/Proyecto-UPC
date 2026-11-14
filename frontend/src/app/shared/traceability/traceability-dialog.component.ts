import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TraceabilityPanelComponent } from './traceability-panel.component';

/** Consulta de la trazabilidad de un registro (desde el listado o desde su ficha). */
@Component({
  selector: 'app-traceability-dialog',
  imports: [MatDialogModule, MatButtonModule, TraceabilityPanelComponent],
  template: `
    <h2 mat-dialog-title>Trazabilidad</h2>
    <mat-dialog-content>
      <app-traceability-panel [type]="data.type" [id]="data.id" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class TraceabilityDialogComponent {
  readonly data = inject<{ type: string; id: string }>(MAT_DIALOG_DATA);

  static open(dialog: MatDialog, type: string, id: string) {
    return dialog.open(TraceabilityDialogComponent, { data: { type, id }, width: '960px', maxWidth: '95vw' });
  }
}
