import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Router, RouterLink } from '@angular/router';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { GenerationRequest, Project } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { GENERATION_STATUS_LABELS } from '../../shared/display';

@Component({
  selector: 'app-generation-list',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatProgressBarModule,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>Mis generaciones</h1>
        <p class="muted">Solicitudes de generación de casos de prueba y su estado.</p>
      </div>
      @if (auth.can('GENERATION', 'CREATE')) {
        <a mat-flat-button routerLink="/generacion/nueva"><mat-icon>auto_awesome</mat-icon> Nueva generación</a>
      }
    </header>

    <section class="filters">
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Buscar</mat-label>
        <mat-icon matPrefix>search</mat-icon>
        <input matInput [(ngModel)]="search" (ngModelChange)="search$.next()" placeholder="Código o requerimiento" />
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Proyecto</mat-label>
        <mat-select [(ngModel)]="project" (selectionChange)="load()">
          <mat-option value="">Todos</mat-option>
          @for (p of projects(); track p.id) {
            <mat-option [value]="p.id">{{ p.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field subscriptSizing="dynamic">
        <mat-label>Estado</mat-label>
        <mat-select [(ngModel)]="status" (selectionChange)="load()">
          <mat-option value="">Todos</mat-option>
          <mat-option value="GENERADO">Generado</mat-option>
          <mat-option value="GENERANDO">Generando</mat-option>
          <mat-option value="ERROR">Error</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-slide-toggle [(ngModel)]="mine" (change)="load()">Solo mis solicitudes</mat-slide-toggle>
    </section>

    <div class="table-wrapper">
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      }
      <table mat-table [dataSource]="items()" class="clickable-rows">
        <ng-container matColumnDef="code">
          <th mat-header-cell *matHeaderCellDef>Código</th>
          <td mat-cell *matCellDef="let g" class="code-cell">{{ g.code }}</td>
        </ng-container>
        <ng-container matColumnDef="requirement">
          <th mat-header-cell *matHeaderCellDef>Requerimiento</th>
          <td mat-cell *matCellDef="let g">{{ g.requirement.code ? g.requirement.code + ' · ' : '' }}{{ g.requirement.title }}</td>
        </ng-container>
        <ng-container matColumnDef="module">
          <th mat-header-cell *matHeaderCellDef>Proyecto / módulo</th>
          <td mat-cell *matCellDef="let g"><div>{{ g.module?.name }}</div><small class="muted">{{ g.project?.name }}</small></td>
        </ng-container>
        <ng-container matColumnDef="cases">
          <th mat-header-cell *matHeaderCellDef>Casos</th>
          <td mat-cell *matCellDef="let g">{{ g.caseCount }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>Estado</th>
          <td mat-cell *matCellDef="let g"><span class="gen-status gen-{{ g.status }}">{{ labels[g.status] }}</span></td>
        </ng-container>
        <ng-container matColumnDef="user">
          <th mat-header-cell *matHeaderCellDef>Generado por</th>
          <td mat-cell *matCellDef="let g">
            <div>{{ g.createdBy?.name }}</div><small class="muted">{{ g.createdAt | date: 'dd/MM/yyyy HH:mm' }}</small>
          </td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let g; columns: columns" (click)="open(g)"></tr>
        <tr class="mat-row" *matNoDataRow>
          <td class="mat-cell empty" [attr.colspan]="columns.length">{{ loading() ? 'Cargando…' : 'Aún no hay generaciones.' }}</td>
        </tr>
      </table>
    </div>
  `,
  styles: `
    .filters {
      display: grid;
      grid-template-columns: 2fr 1fr 1fr auto;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    .code-cell {
      font-weight: 600;
      white-space: nowrap;
    }
    .empty {
      padding: 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 800px) {
      .filters {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class GenerationListComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  readonly items = signal<GenerationRequest[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly loading = signal(false);
  readonly labels = GENERATION_STATUS_LABELS;
  readonly columns = ['code', 'requirement', 'module', 'cases', 'status', 'user'];
  readonly search$ = new Subject<void>();

  search = '';
  project = '';
  status = '';
  mine = false;

  ngOnInit(): void {
    this.search$.pipe(debounceTime(350)).subscribe(() => this.load());
    this.api.projects().subscribe({ next: (p) => this.projects.set(p) });
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      this.items.set(
        await firstValueFrom(this.api.generations({ search: this.search, project: this.project, status: this.status, mine: this.mine || undefined })),
      );
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  open(g: GenerationRequest): void {
    this.router.navigate(['/generacion', g.id]);
  }
}
