import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface NameDialogData {
  title: string;
  name?: string;
  description?: string;
}

@Component({
  selector: 'app-name-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="name-form" (ngSubmit)="save()" class="stack">
        <mat-form-field>
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" required />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Descripción</mat-label>
          <textarea matInput formControlName="description" rows="3"></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="submit" form="name-form" [disabled]="form.invalid">Guardar</button>
    </mat-dialog-actions>
  `,
})
export class NameDialogComponent {
  readonly data = inject<NameDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<NameDialogComponent>);
  readonly form = new FormGroup({
    name: new FormControl(this.data.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    description: new FormControl(this.data.description ?? '', { nonNullable: true }),
  });

  save(): void {
    if (this.form.valid) this.ref.close({ ...this.form.getRawValue(), name: this.form.value.name!.trim() });
  }
}
