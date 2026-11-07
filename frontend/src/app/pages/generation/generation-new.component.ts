import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { debounceTime, firstValueFrom, Subject } from 'rxjs';
import { ApiService } from '../../core/api.service';
import {
  ContextCandidate,
  FlowModule,
  Project,
  RecordOption,
  RequirementInput,
  SCENARIO_TYPES,
  TECHNIQUES,
} from '../../core/models';
import { fieldErrors, NotifyService } from '../../core/notify.service';
import { ENTITY_TYPE_LABELS } from '../../shared/display';
import { GenerationProgressDialogComponent } from './generation-progress-dialog.component';

const MAX_CONTEXT = 15;

@Component({
  selector: 'app-generation-new',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatRadioModule,
    MatCheckboxModule,
    MatTableModule,
    MatTooltipModule,
    MatProgressBarModule,
  ],
  templateUrl: './generation-new.component.html',
  styleUrl: './generation-new.component.scss',
})
export class GenerationNewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  readonly scenarioOptions = SCENARIO_TYPES;
  readonly techniqueOptions = TECHNIQUES;
  readonly typeLabels = ENTITY_TYPE_LABELS;
  readonly maxContext = MAX_CONTEXT;

  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly requirements = signal<RecordOption[]>([]);
  readonly requirement = signal<RequirementInput | null>(null);
  readonly candidates = signal<ContextCandidate[]>([]);
  readonly searchResults = signal<ContextCandidate[]>([]);
  readonly searched = signal(false);
  readonly simulated = signal(false);
  readonly loadingContext = signal(false);
  readonly submitting = signal(false);
  readonly selectedCount = computed(() => this.candidates().filter((c) => c.selected).length);

  project = '';
  module = '';
  source: 'registrado' | 'nuevo' = 'registrado';
  requirementCode = '';
  newTitle = '';
  newDescription = '';
  newCriteria = '';
  search = '';
  scenarioTypes = new Set(SCENARIO_TYPES);
  techniques: string[] = ['Partición de equivalencia', 'Análisis de valores límite'];
  maxCases = 10;
  instructions = '';

  private readonly search$ = new Subject<string>();
  readonly columns = ['selected', 'code', 'type', 'title', 'score'];

  async ngOnInit(): Promise<void> {
    this.search$.pipe(debounceTime(300)).subscribe((q) => this.runSearch(q));
    try {
      const [projects, config] = await Promise.all([
        firstValueFrom(this.api.projects(true)),
        firstValueFrom(this.api.generationConfig()),
      ]);
      this.projects.set(projects);
      this.simulated.set(config.simulated);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async onProjectChange(): Promise<void> {
    this.module = '';
    this.requirementCode = '';
    this.requirement.set(null);
    this.candidates.set([]);
    if (!this.project) return;
    const [modules, requirements] = await Promise.all([
      firstValueFrom(this.api.modules(this.project, true)),
      firstValueFrom(this.api.recordOptions('requirements', this.project)),
    ]);
    this.modules.set(modules);
    this.requirements.set(requirements);
  }

  onSourceChange(): void {
    this.requirement.set(null);
    this.candidates.set([]);
  }

  /** HU09: recupera la información histórica relacionada con el requerimiento. */
  async loadContext(): Promise<void> {
    if (!this.project) return;
    const body: Parameters<ApiService['generationContext']>[0] = { project: this.project, module: this.module || undefined };
    if (this.source === 'registrado') {
      if (!this.requirementCode) return;
      body.requirementCode = this.requirementCode;
    } else {
      if (!this.newTitle.trim() || !this.newDescription.trim()) {
        this.notify.warn('Ingrese el título y la descripción del requerimiento.');
        return;
      }
      body.requirement = { title: this.newTitle, description: this.newDescription, acceptanceCriteria: this.criteriaList() };
    }
    this.loadingContext.set(true);
    try {
      const res = await firstValueFrom(this.api.generationContext(body));
      this.requirement.set(res.requirement);
      this.candidates.set(res.candidates);
    } catch (e) {
      this.notify.error(e);
    } finally {
      this.loadingContext.set(false);
    }
  }

  private criteriaList(): string[] {
    return this.newCriteria.split('\n').map((c) => c.trim()).filter(Boolean);
  }

  toggle(candidate: ContextCandidate, checked: boolean): void {
    if (checked && this.selectedCount() >= MAX_CONTEXT) {
      this.notify.warn(`El contexto admite como máximo ${MAX_CONTEXT} registros.`);
      return;
    }
    this.candidates.update((list) => list.map((c) => (c === candidate ? { ...c, selected: checked } : c)));
  }

  onSearch(q: string): void {
    this.search$.next(q);
  }

  private async runSearch(q: string): Promise<void> {
    this.searched.set(false);
    if (!q.trim() || !this.project) {
      this.searchResults.set([]);
      return;
    }
    const existing = new Set(this.candidates().map((c) => `${c.type}:${c.code}`));
    const res = await firstValueFrom(this.api.searchGenerationRecords(this.project, q));
    this.searchResults.set(
      res.filter((r) => !existing.has(`${r.type}:${r.code}`) && !(r.type === 'requirements' && r.code === this.requirementCode)),
    );
    this.searched.set(true);
  }

  addRecord(record: ContextCandidate): void {
    if (this.selectedCount() >= MAX_CONTEXT) {
      this.notify.warn(`El contexto admite como máximo ${MAX_CONTEXT} registros.`);
      return;
    }
    this.candidates.update((list) => [...list, { ...record, selected: true }]);
    this.search = '';
    this.searchResults.set([]);
  }

  toggleScenario(type: string, checked: boolean): void {
    if (checked) this.scenarioTypes.add(type);
    else this.scenarioTypes.delete(type);
  }

  canGenerate(): boolean {
    return !!this.project && !!this.module && !!this.requirement() && this.scenarioTypes.size > 0 && this.maxCases >= 1 && this.maxCases <= 20;
  }

  /** HU10: envía la solicitud y muestra el avance de la generación. */
  async generate(): Promise<void> {
    if (!this.canGenerate()) {
      this.notify.warn('Complete el requerimiento, el módulo y al menos un tipo de escenario.');
      return;
    }
    const context = this.candidates().filter((c) => c.selected).map((c) => ({ type: c.type, code: c.code }));
    const body: Record<string, unknown> = {
      project: this.project,
      module: this.module,
      context,
      scenarioTypes: SCENARIO_TYPES.filter((t) => this.scenarioTypes.has(t)),
      techniques: this.techniques,
      maxCases: this.maxCases,
      instructions: this.instructions,
    };
    if (this.source === 'registrado') body['requirementCode'] = this.requirementCode;
    else body['requirement'] = { title: this.newTitle, description: this.newDescription, acceptanceCriteria: this.criteriaList() };

    this.submitting.set(true);
    try {
      const res = await firstValueFrom(this.api.createGeneration(body));
      const result = await firstValueFrom(
        this.dialog
          .open(GenerationProgressDialogComponent, {
            data: { id: res.request.id, contextCount: context.length },
            width: '520px',
            disableClose: true,
          })
          .afterClosed(),
      );
      if (result) this.router.navigate(['/generacion', res.request.id]);
    } catch (e) {
      const errors = fieldErrors(e);
      if (errors.length) this.notify.warn(errors.map((x) => x.message).join(' '));
      else this.notify.error(e);
    } finally {
      this.submitting.set(false);
    }
  }

  cancel(): void {
    this.router.navigateByUrl('/generacion');
  }
}
