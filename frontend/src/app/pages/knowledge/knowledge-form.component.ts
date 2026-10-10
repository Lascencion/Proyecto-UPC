import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FieldIssue, FlowModule, KnowledgeRecord, Project } from '../../core/models';
import { fieldErrors, NotifyService } from '../../core/notify.service';
import { RecordFormComponent } from '../../shared/record-form/record-form.component';

@Component({
  selector: 'app-knowledge-form',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    RecordFormComponent,
  ],
  templateUrl: './knowledge-form.component.html',
  styleUrl: './knowledge-form.component.scss',
})
export class KnowledgeFormComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  readonly type = input.required<string>();
  readonly id = input<string>();

  private readonly recordForm = viewChild(RecordFormComponent);

  readonly definitions = toSignal(this.api.definitions(), { initialValue: [] });
  readonly definition = computed(() => this.definitions().find((d) => d.type === this.type()));
  readonly isNew = computed(() => !this.id());
  readonly readonly = computed(() => !this.isNew() && !this.auth.can('KNOWLEDGE', 'EDIT'));

  readonly record = signal<KnowledgeRecord | null>(null);
  /** Valor con el que se (re)construye el formulario; un objeto nuevo lo limpia. */
  readonly formSeed = signal<Record<string, unknown> | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly scopeErrors = signal<Record<string, string>>({});
  readonly warnings = signal<FieldIssue[]>([]);

  project = '';
  module = '';

  constructor() {
    this.api.projects(true).subscribe({ next: (p) => this.projects.set(p), error: (e) => this.notify.error(e) });
    effect(() => {
      const id = this.id();
      this.type();
      untracked(() => (id ? this.load(id) : this.reset()));
    });
  }

  private reset(): void {
    this.record.set(null);
    this.formSeed.set({});
    this.warnings.set([]);
    // Conserva proyecto y módulo para registrar varios seguidos.
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const record = await firstValueFrom(this.api.getRecord(this.type(), id));
      this.project = record.project.id;
      this.module = record.module.id;
      await this.loadModules();
      this.record.set(record);
      this.formSeed.set(record);
    } catch (e) {
      this.notify.error(e);
      this.back();
    } finally {
      this.loading.set(false);
    }
  }

  hasProject(id: string): boolean {
    return this.projects().some((p) => p.id === id);
  }

  async loadModules(): Promise<void> {
    this.modules.set(this.project ? await firstValueFrom(this.api.modules(this.project)) : []);
  }

  async onProjectChange(): Promise<void> {
    this.module = '';
    await this.loadModules();
  }

  back(): void {
    this.router.navigate(['/conocimiento', this.type()]);
  }

  async save(another = false): Promise<void> {
    const form = this.recordForm();
    if (!form) return;
    const scope: Record<string, string> = {};
    if (!this.project) scope['project'] = 'Seleccione el proyecto.';
    if (!this.module) scope['module'] = 'Seleccione el módulo.';
    this.scopeErrors.set(scope);
    const valid = form.validate();
    if (!valid || Object.keys(scope).length) {
      this.notify.warn('Revise los campos marcados.');
      return;
    }
    this.saving.set(true);
    try {
      const body = { ...form.getValue(), project: this.project, module: this.module };
      const id = this.id();
      const res = await firstValueFrom(
        id ? this.api.updateRecord(this.type(), id, body) : this.api.createRecord(this.type(), body),
      );
      const label = this.definition()!.label;
      if (res.warnings.length) {
        this.notify.warn(`${label} guardado con observaciones: ${res.warnings.map((w) => w.message).join(' ')}`);
      } else {
        this.notify.success(`${label} ${res.record['code']} guardado.`);
      }
      if (another) {
        this.formSeed.set({});
        window.scrollTo({ top: 0 });
      } else if (id) {
        this.record.set(res.record);
        this.formSeed.set(res.record);
        this.warnings.set(res.warnings);
      } else {
        this.router.navigate(['/conocimiento', this.type(), res.record.id]);
      }
    } catch (e) {
      const errors = fieldErrors(e);
      form.applyServerErrors(errors);
      const scopeErr = Object.fromEntries(errors.filter((x) => x.field === 'project' || x.field === 'module').map((x) => [x.field!, x.message]));
      this.scopeErrors.set(scopeErr);
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }
}
