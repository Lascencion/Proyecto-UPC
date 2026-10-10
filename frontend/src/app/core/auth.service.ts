import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ActionKey, AppModuleKey, Session } from './models';

const TOKEN_KEY = 'qa_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly session = signal<Session | null>(null);
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => !!this.session());

  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /** Recupera la sesión guardada al iniciar la aplicación. */
  async restore(): Promise<void> {
    if (!this.token) return;
    try {
      this.session.set(await firstValueFrom(this.http.get<Session>('/api/auth/me')));
    } catch {
      this.clear();
    }
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<Session & { accessToken: string }>('/api/auth/login', { email, password }),
    );
    localStorage.setItem(TOKEN_KEY, res.accessToken);
    this.session.set({ user: res.user, permissions: res.permissions });
  }

  /** Recarga usuario y permisos (p. ej. después de cambiar la matriz de permisos). */
  async refresh(): Promise<void> {
    this.session.set(await firstValueFrom(this.http.get<Session>('/api/auth/me')));
  }

  logout(): void {
    this.clear();
    this.router.navigateByUrl('/login');
  }

  private clear(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* almacenamiento no disponible */
    }
    this.session.set(null);
  }

  can(module: AppModuleKey, action: ActionKey): boolean {
    return (this.session()?.permissions[module] ?? []).includes(action);
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.patch('/api/auth/password', { currentPassword, newPassword });
  }
}
