import { Component, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TraceabilityPanelComponent } from './traceability-panel.component';

/** Consulta rápida de la trazabilidad desde el listado de la base de conocimiento. */
@Component({
  selector: 'app-traceability-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, TraceabilityPanelComponent],
  template: `
    <h2 mat-dialog-title>Trazabilidad</h2>
    <mat-dialog-content>
      <app-traceability-panel [type]="data.type" [id]="data.id" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="openRecord()"><mat-icon>open_in_new</mat-icon> Abrir registro</button>
      <button mat-flat-button mat-dialog-close>Cerrar</button>
    </mat-dialog-actions>
  `,
})
export class TraceabilityDialogComponent {
  readonly data = inject<{ type: string; id: string }>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<TraceabilityDialogComponent>);
  private readonly router = inject(Router);
  private readonly panel = viewChild(TraceabilityPanelComponent);

  openRecord(): void {
    const current = this.panel()?.current() ?? this.data;
    this.ref.close();
    this.router.navigate(['/conocimiento', current.type, current.id]);
  }
}
