import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FieldDefinition, FlowModule, KnowledgeRecord, Project } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { displayValue } from '../../shared/display';

@Component({
  selector: 'app-knowledge-list',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './knowledge-list.component.html',
  styleUrl: './knowledge-list.component.scss',
})
export class KnowledgeListComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Tipo de información (parámetro de la ruta). */
  readonly type = input.required<string>();

  readonly definitions = toSignal(this.api.definitions(), { initialValue: [] });
  readonly definition = computed(() => this.definitions().find((d) => d.type === this.type()));
  readonly tabIndex = computed(() => this.definitions().findIndex((d) => d.type === this.type()));
  readonly columns = computed<FieldDefinition[]>(() => this.definition()?.fields.filter((f) => f.listColumn) ?? []);
  readonly displayedColumns = computed(() => [...this.columns().map((c) => c.key), 'module', 'origin', 'updatedAt', 'actions']);

  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly records = signal<KnowledgeRecord[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);

  project = this.route.snapshot.queryParamMap.get('project') ?? '';
  module = '';
  origin = '';
  search = '';
  page = 0;
  pageSize = 20;
  sort: Sort = { active: 'code', direction: 'asc' };

  private readonly search$ = new Subject<void>();
  readonly display = displayValue;

  constructor() {
    this.api.projects().subscribe({ next: (p) => this.projects.set(p), error: (e) => this.notify.error(e) });
    if (this.project) this.loadModules();
    this.search$.pipe(debounceTime(350)).subscribe(() => this.reload());
    // Recarga al cambiar de tipo (pestañas).
    effect(() => {
      this.type();
      untracked(() => {
        this.page = 0;
        this.sort = { active: 'code', direction: 'asc' };
        this.load();
      });
    });
  }

  onSearch(): void {
    this.search$.next();
  }

  async loadModules(): Promise<void> {
    this.modules.set(this.project ? await firstValueFrom(this.api.modules(this.project)) : []);
  }

  async onProjectChange(): Promise<void> {
    this.module = '';
    await this.loadModules();
    this.reload();
  }

  reload(): void {
    this.page = 0;
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.api.listRecords(this.type(), {
          project: this.project,
          module: this.module,
          origin: this.origin,
          search: this.search,
          page: this.page,
          pageSize: this.pageSize,
          sort: this.sort.direction ? this.sort.active : 'code',
          direction: this.sort.direction || 'asc',
        }),
      );
      this.records.set(res.items);
      this.total.set(res.total);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loading.set(false);
    }
  }

  onPage(e: PageEvent): void {
    this.page = e.pageIndex;
    this.pageSize = e.pageSize;
    this.load();
  }

  onSort(s: Sort): void {
    this.sort = s;
    this.reload();
  }

  selectTab(index: number): void {
    const def = this.definitions()[index];
    if (def && def.type !== this.type()) this.router.navigate(['/conocimiento', def.type], { queryParamsHandling: 'preserve' });
  }

  open(record: KnowledgeRecord): void {
    this.router.navigate(['/conocimiento', this.type(), record.id]);
  }

  async remove(record: KnowledgeRecord, event: Event): Promise<void> {
    event.stopPropagation();
    const def = this.definition()!;
    const ok = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: `Eliminar ${def.label.toLowerCase()}`,
            message: `¿Eliminar ${record['code']} - ${record[def.titleField]}? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
          },
        })
        .afterClosed(),
    );
    if (!ok) return;
    try {
      await firstValueFrom(this.api.deleteRecord(this.type(), record.id));
      this.notify.success('Registro eliminado.');
      this.load();
    } catch (e) {
      this.notify.error(e);
    }
  }
}
