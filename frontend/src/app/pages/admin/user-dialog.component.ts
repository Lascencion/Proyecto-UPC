import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Role, User } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

export const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ANALISTA_QA', label: 'Analista QA' },
  { value: 'LIDER_QA', label: 'Líder QA' },
  { value: 'ADMIN', label: 'Administrador' },
];

@Component({
  selector: 'app-user-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <h2 mat-dialog-title>{{ user ? 'Editar usuario' : 'Nuevo usuario' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="user-form" (ngSubmit)="save()" class="stack">
        <mat-form-field>
          <mat-label>Nombre completo</mat-label>
          <input matInput formControlName="name" required />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Correo</mat-label>
          <input matInput type="email" formControlName="email" required [readonly]="!!user" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role" required>
            @for (r of roles; track r.value) {
              <mat-option [value]="r.value">{{ r.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field>
          <mat-label>{{ user ? 'Nueva contraseña (opcional)' : 'Contraseña' }}</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>Mínimo 8 caracteres.</mat-hint>
        </mat-form-field>
        @if (user) {
          <mat-slide-toggle formControlName="active">Usuario activo</mat-slide-toggle>
        }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancelar</button>
      <button mat-flat-button type="submit" form="user-form" [disabled]="form.invalid || saving()">Guardar</button>
    </mat-dialog-actions>
  `,
})
export class UserDialogComponent {
  readonly user = inject<User | null>(MAT_DIALOG_DATA);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly ref = inject(MatDialogRef<UserDialogComponent>);
  readonly roles = ROLE_OPTIONS;
  readonly saving = signal(false);

  readonly form = new FormGroup({
    name: new FormControl(this.user?.name ?? '', { nonNullable: true, validators: [Validators.required, Validators.minLength(2)] }),
    email: new FormControl(this.user?.email ?? '', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    role: new FormControl<Role>(this.user?.role ?? 'ANALISTA_QA', { nonNullable: true, validators: Validators.required }),
    password: new FormControl('', {
      nonNullable: true,
      validators: this.user ? [Validators.minLength(8)] : [Validators.required, Validators.minLength(8)],
    }),
    active: new FormControl(this.user?.active ?? true, { nonNullable: true }),
  });

  async save(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    try {
      if (this.user) {
        await firstValueFrom(
          this.api.updateUser(this.user.id, { name: v.name, role: v.role, active: v.active, ...(v.password ? { password: v.password } : {}) }),
        );
      } else {
        await firstValueFrom(this.api.createUser({ name: v.name, email: v.email, role: v.role, password: v.password }));
      }
      this.notify.success('Usuario guardado.');
      this.ref.close(true);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }
}
