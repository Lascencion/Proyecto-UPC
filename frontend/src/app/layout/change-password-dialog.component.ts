import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/auth.service';
import { NotifyService } from '../core/notify.service';

@Component({
  selector: 'app-change-password-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Cambiar contraseña</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="stack" (ngSubmit)="save()" id="pwd-form">
        <mat-form-field>
          <mat-label>Contraseña actual</mat-label>
          <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Nueva contraseña</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-hint>Mínimo 8 caracteres.</mat-hint>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="submit" form="pwd-form" [disabled]="form.invalid || saving()">Guardar</button>
    </mat-dialog-actions>
  `,
})
export class ChangePasswordDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject(MatDialogRef<ChangePasswordDialogComponent>);
  readonly saving = signal(false);

  readonly form = new FormGroup({
    currentPassword: new FormControl('', { nonNullable: true, validators: Validators.required }),
    newPassword: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const { currentPassword, newPassword } = this.form.getRawValue();
      await firstValueFrom(this.auth.changePassword(currentPassword, newPassword));
      this.notify.success('Contraseña actualizada.');
      this.ref.close();
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }
}
