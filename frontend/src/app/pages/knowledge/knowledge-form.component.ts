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
import { EntityDefinition, EntityType, FlowModule, KnowledgeRecord, Project, RefOptions } from '../../core/models';
import { fieldErrors, NotifyService } from '../../core/notify.service';
import { today } from '../../shared/display';
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
  /** Valor con el que se construye el formulario. */
  readonly formSeed = signal<Record<string, unknown> | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly refOptions = signal<RefOptions>({});
  readonly codePreview = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly scopeErrors = signal<Record<string, string>>({});

  project = '';
  module = '';

  constructor() {
    this.api.projects(true).subscribe({ next: (p) => this.projects.set(p), error: (e) => this.notify.error(e) });
    effect(() => {
      const id = this.id();
      const def = this.definition();
      if (!def) return;
      untracked(() => (id ? this.load(id) : this.startNew(def)));
    });
  }

  /** Registro nuevo: las fechas se proponen con el día de hoy (editables). */
  private startNew(def: EntityDefinition): void {
    this.record.set(null);
    this.formSeed.set(Object.fromEntries(def.fields.filter((f) => f.type === 'date').map((f) => [f.key, today()])));
    if (this.project) this.loadProjectData();
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const record = await firstValueFrom(this.api.getRecord(this.type(), id));
      this.project = record.project.id;
      this.module = record.module.id;
      this.record.set(record);
      this.formSeed.set(record);
      await this.loadProjectData();
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

  /** Módulos, registros relacionables y código sugerido del proyecto elegido. */
  async loadProjectData(): Promise<void> {
    const def = this.definition();
    if (!this.project || !def) {
      this.modules.set([]);
      this.refOptions.set({});
      this.codePreview.set(null);
      return;
    }
    const project = this.project;
    const refTypes = [...new Set(def.fields.filter((f) => f.refType).map((f) => f.refType!))];
    try {
      const [modules, options, next] = await Promise.all([
        firstValueFrom(this.api.modules(project)),
        Promise.all(refTypes.map((t) => firstValueFrom(this.api.recordOptions(t, project)))),
        this.isNew() ? firstValueFrom(this.api.nextCode(def.type, project)) : Promise.resolve(null),
      ]);
      if (project !== this.project) return; // el usuario cambió de proyecto mientras cargaba
      this.modules.set(modules);
      this.refOptions.set(Object.fromEntries(refTypes.map((t, i) => [t, options[i]])) as Partial<Record<EntityType, never>>);
      this.codePreview.set(next?.code ?? null);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async onProjectChange(): Promise<void> {
    this.module = '';
    await this.loadProjectData();
  }

  back(): void {
    this.router.navigate(['/conocimiento', this.type()]);
  }

  async save(): Promise<void> {
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
      const action = id ? 'actualizado' : 'registrado';
      if (res.warnings.length) {
        this.notify.warn(`${label} ${res.record['code']} ${action} con observaciones: ${res.warnings.map((w) => w.message).join(' ')}`);
      } else {
        this.notify.success(`${label} ${res.record['code']} ${action}.`);
      }
      this.back();
    } catch (e) {
      const errors = fieldErrors(e);
      form.applyServerErrors(errors);
      this.scopeErrors.set(
        Object.fromEntries(errors.filter((x) => x.field === 'project' || x.field === 'module').map((x) => [x.field!, x.message])),
      );
      this.notify.error(e);
    } finally {
      this.saving.set(false);
    }
  }
}
