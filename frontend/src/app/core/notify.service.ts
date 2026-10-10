import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FieldIssue } from './models';

/** Extrae el mensaje legible de un error de la API. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) return 'No se pudo conectar con el servidor.';
    const body = err.error;
    if (body && typeof body === 'object') {
      const message = Array.isArray(body.message) ? body.message.join(' ') : body.message;
      if (message) return message;
    }
    return `Error ${err.status}: ${err.statusText}`;
  }
  return (err as Error)?.message ?? 'Ocurrió un error inesperado.';
}

/** Errores por campo enviados por la API ({ errors: [{ field, message }] }). */
export function fieldErrors(err: unknown): FieldIssue[] {
  return err instanceof HttpErrorResponse && Array.isArray(err.error?.errors) ? err.error.errors : [];
}

@Injectable({ providedIn: 'root' })
export class NotifyService {
  private readonly snack = inject(MatSnackBar);

  success(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 4000, panelClass: 'snack-success' });
  }

  warn(message: string): void {
    this.snack.open(message, 'Cerrar', { duration: 8000, panelClass: 'snack-warn' });
  }

  error(err: unknown): void {
    this.snack.open(errorMessage(err), 'Cerrar', { duration: 8000, panelClass: 'snack-error' });
  }
}
