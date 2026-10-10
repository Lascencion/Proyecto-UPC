import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { DuplicateAction, FieldIssue, FlowModule, ImportBatch, Project } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { BATCH_STATUS_LABELS } from '../../shared/display';

const ACCEPTED = ['.xlsx', '.csv', '.docx'];
const MAX_FILES = 10;
const MAX_SIZE = 10 * 1024 * 1024;

@Component({
  selector: 'app-import-upload',
  imports: [
    FormsModule,
    RouterLink,
    DatePipe,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatProgressBarModule,
    MatTableModule,
    MatMenuModule,
    MatExpansionModule,
  ],
  templateUrl: './import-upload.component.html',
  styleUrl: './import-upload.component.scss',
})
export class ImportUploadComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly router = inject(Router);

  readonly definitions = toSignal(this.api.definitions(), { initialValue: [] });
  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly files = signal<File[]>([]);
  readonly batches = signal<ImportBatch[]>([]);
  readonly uploading = signal(false);
  readonly dragging = signal(false);
  readonly uploadIssues = signal<FieldIssue[]>([]);
  readonly statusLabels = BATCH_STATUS_LABELS;
  readonly accept = ACCEPTED.join(',');

  project = '';
  defaultModule = '';
  duplicateStrategy: DuplicateAction = 'skip';

  async ngOnInit(): Promise<void> {
    try {
      this.projects.set(await firstValueFrom(this.api.projects(true)));
      this.batches.set(await firstValueFrom(this.api.imports()));
    } catch (e) {
      this.notify.error(e);
    }
  }

  async onProjectChange(): Promise<void> {
    this.defaultModule = '';
    this.modules.set(this.project ? await firstValueFrom(this.api.modules(this.project, true)) : []);
  }

  onFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.addFiles(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    this.addFiles(Array.from(event.dataTransfer?.files ?? []));
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  private addFiles(list: File[]): void {
    const rejected: string[] = [];
    const current = [...this.files()];
    for (const f of list) {
      const ext = f.name.toLowerCase().slice(f.name.lastIndexOf('.'));
      if (!ACCEPTED.includes(ext)) rejected.push(`${f.name}: formato no soportado`);
      else if (f.size > MAX_SIZE) rejected.push(`${f.name}: supera 10 MB`);
      else if (current.some((c) => c.name === f.name && c.size === f.size)) continue;
      else current.push(f);
    }
    if (current.length > MAX_FILES) {
      rejected.push(`Máximo ${MAX_FILES} archivos por carga`);
      current.length = MAX_FILES;
    }
    this.files.set(current);
    if (rejected.length) this.notify.warn(rejected.join(' · '));
  }

  removeFile(index: number): void {
    this.files.update((f) => f.filter((_, i) => i !== index));
  }

  fileNames(b: ImportBatch): string {
    return b.files.map((f) => f.name).join(', ');
  }

  sizeLabel(size: number): string {
    return size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(size / 1024)} KB`;
  }

  async download(format: 'xlsx' | 'docx' | 'csv', type?: string): Promise<void> {
    try {
      await this.api.downloadTemplate(format, type);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async upload(): Promise<void> {
    if (!this.project || !this.defaultModule || !this.files().length) return;
    this.uploading.set(true);
    this.uploadIssues.set([]);
    try {
      const res = await firstValueFrom(this.api.uploadImport(this.files(), this.project, this.defaultModule, this.duplicateStrategy));
      this.notify.success(`Se leyeron ${res.batch.summary['total']} registros. Revíselos antes de confirmar.`);
      this.router.navigate(['/carga-masiva', res.batch.id]);
    } catch (e) {
      if (e instanceof HttpErrorResponse && Array.isArray(e.error?.issues)) this.uploadIssues.set(e.error.issues);
      this.notify.error(e);
    } finally {
      this.uploading.set(false);
    }
  }
}
