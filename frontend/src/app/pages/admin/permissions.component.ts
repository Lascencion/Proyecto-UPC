import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ActionKey, AppModuleKey, ModuleDescriptor, PermissionMap, PermissionMatrix, Role } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

@Component({
  selector: 'app-permissions',
  imports: [MatCardModule, MatCheckboxModule, MatButtonModule, MatIconModule, MatTabsModule, MatTooltipModule],
  templateUrl: './permissions.component.html',
  styleUrl: './permissions.component.scss',
})
export class PermissionsComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);

  readonly matrix = signal<PermissionMatrix | null>(null);
  /** Copia editable de los permisos por rol. */
  readonly draft = signal<Record<string, PermissionMap>>({});
  readonly dirty = signal<Set<Role>>(new Set());
  readonly saving = signal(false);

  async ngOnInit(): Promise<void> {
    try {
      this.setMatrix(await firstValueFrom(this.api.permissionMatrix()));
    } catch (e) {
      this.notify.error(e);
    }
  }

  private setMatrix(m: PermissionMatrix): void {
    this.matrix.set(m);
    this.draft.set(structuredClone(m.permissions));
    this.dirty.set(new Set());
  }

  has(role: Role, module: AppModuleKey, action: ActionKey): boolean {
    return (this.draft()[role]?.[module] ?? []).includes(action);
  }

  /** El rol Administrador siempre conserva el acceso a Administración. */
  locked(role: Role, module: ModuleDescriptor): boolean {
    return role === 'ADMIN' && module.module === 'ADMIN';
  }

  toggle(role: Role, module: AppModuleKey, action: ActionKey, checked: boolean): void {
    this.draft.update((d) => {
      const copy = structuredClone(d);
      const current = new Set(copy[role]?.[module] ?? []);
      if (checked) current.add(action);
      else current.delete(action);
      // Sin "Ver" no tiene sentido el resto de acciones; y cualquier acción implica "Ver".
      if (action === 'VIEW' && !checked) current.clear();
      if (action !== 'VIEW' && checked) current.add('VIEW');
      copy[role] = { ...(copy[role] ?? {}), [module]: [...current] };
      return copy;
    });
    this.dirty.update((s) => new Set(s).add(role));
  }

  async save(role: Role): Promise<void> {
    this.saving.set(true);
    try {
      const m = await firstValueFrom(this.api.updateRolePermissions(role, this.draft()[role] ?? {}));
      const keepDraft = this.draft();
      const stillDirty = new Set(this.dirty());
      stillDirty.delete(role);
      this.matrix.set(m);
      this.draft.set({ ...keepDraft, [role]: structuredClone(m.permissions[role]) });
      this.dirty.set(stillDirty);
      await this.auth.refresh();
      this.notify.success('Permisos actualizados.');
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }

  discard(role: Role): void {
    const m = this.matrix()!;
    this.draft.update((d) => ({ ...d, [role]: structuredClone(m.permissions[role]) }));
    this.dirty.update((s) => {
      const copy = new Set(s);
      copy.delete(role);
      return copy;
    });
  }
}
