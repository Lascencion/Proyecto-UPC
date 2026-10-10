import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { User } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { UserDialogComponent } from './user-dialog.component';

@Component({
  selector: 'app-users',
  imports: [DatePipe, MatTableModule, MatButtonModule, MatIconModule, MatTooltipModule],
  template: `
    <header class="page-header">
      <div>
        <h1>Usuarios</h1>
        <p class="muted">Cree usuarios y asígneles un rol. Los permisos de cada rol se configuran en "Permisos por rol".</p>
      </div>
      @if (auth.can('ADMIN', 'CREATE')) {
        <button mat-flat-button (click)="open()"><mat-icon>person_add</mat-icon> Nuevo usuario</button>
      }
    </header>
    <div class="table-wrapper">
      <table mat-table [dataSource]="users()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>Nombre</th>
          <td mat-cell *matCellDef="let u">{{ u.name }}</td>
        </ng-container>
        <ng-container matColumnDef="email">
          <th mat-header-cell *matHeaderCellDef>Correo</th>
          <td mat-cell *matCellDef="let u">{{ u.email }}</td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>Rol</th>
          <td mat-cell *matCellDef="let u"><span class="tag">{{ u.roleLabel }}</span></td>
        </ng-container>
        <ng-container matColumnDef="active">
          <th mat-header-cell *matHeaderCellDef>Estado</th>
          <td mat-cell *matCellDef="let u">
            <span class="row-status" [class.valid]="u.active" [class.excluded]="!u.active">{{ u.active ? 'Activo' : 'Inactivo' }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="lastLoginAt">
          <th mat-header-cell *matHeaderCellDef>Último acceso</th>
          <td mat-cell *matCellDef="let u">{{ u.lastLoginAt ? (u.lastLoginAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef></th>
          <td mat-cell *matCellDef="let u" class="actions-cell">
            @if (auth.can('ADMIN', 'EDIT')) {
              <button mat-icon-button matTooltip="Editar" (click)="open(u)"><mat-icon>edit</mat-icon></button>
            }
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let u; columns: columns"></tr>
      </table>
    </div>
  `,
  styles: `
    .actions-cell {
      text-align: right;
    }
  `,
})
export class UsersComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  readonly users = signal<User[]>([]);
  readonly columns = ['name', 'email', 'role', 'active', 'lastLoginAt', 'actions'];

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    try {
      this.users.set(await firstValueFrom(this.api.users()));
    } catch (e) {
      this.notify.error(e);
    }
  }

  async open(user?: User): Promise<void> {
    const saved = await firstValueFrom(this.dialog.open(UserDialogComponent, { data: user ?? null, width: '460px' }).afterClosed());
    if (saved) this.load();
  }
}
