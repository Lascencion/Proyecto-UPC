import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, map, Observable, shareReplay } from 'rxjs';
import {
  DuplicateAction,
  EntityDefinition,
  FlowModule,
  ImportBatch,
  ImportDetail,
  KnowledgeRecord,
  Page,
  PermissionMap,
  PermissionMatrix,
  Project,
  Role,
  SaveResult,
  User,
} from './models';

function params(values: Record<string, unknown>): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(values)) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private definitions$?: Observable<EntityDefinition[]>;

  // ----- Base de conocimiento -----
  definitions(): Observable<EntityDefinition[]> {
    this.definitions$ ??= this.http.get<EntityDefinition[]>('/api/knowledge/definitions').pipe(shareReplay(1));
    return this.definitions$;
  }

  definition(type: string): Observable<EntityDefinition | undefined> {
    return this.definitions().pipe(map((defs) => defs.find((d) => d.type === type)));
  }

  summary(project?: string) {
    return this.http.get<{ type: string; label: string; total: number }[]>('/api/knowledge/summary', {
      params: params({ project }),
    });
  }

  listRecords(type: string, query: Record<string, unknown>) {
    return this.http.get<Page<KnowledgeRecord>>(`/api/knowledge/${type}`, { params: params(query) });
  }

  getRecord(type: string, id: string) {
    return this.http.get<KnowledgeRecord>(`/api/knowledge/${type}/${id}`);
  }

  createRecord(type: string, body: Record<string, unknown>) {
    return this.http.post<SaveResult>(`/api/knowledge/${type}`, body);
  }

  updateRecord(type: string, id: string, body: Record<string, unknown>) {
    return this.http.put<SaveResult>(`/api/knowledge/${type}/${id}`, body);
  }

  deleteRecord(type: string, id: string) {
    return this.http.delete(`/api/knowledge/${type}/${id}`);
  }

  // ----- Catálogos -----
  projects(activeOnly = false) {
    return this.http.get<Project[]>('/api/catalogs/projects', { params: params({ activeOnly }) });
  }

  saveProject(body: Partial<Project>, id?: string) {
    return id
      ? this.http.patch<Project>(`/api/catalogs/projects/${id}`, body)
      : this.http.post<Project>('/api/catalogs/projects', body);
  }

  deleteProject(id: string) {
    return this.http.delete(`/api/catalogs/projects/${id}`);
  }

  modules(project?: string, activeOnly = false) {
    return this.http.get<FlowModule[]>('/api/catalogs/modules', { params: params({ project, activeOnly }) });
  }

  saveModule(body: Partial<FlowModule>, id?: string) {
    return id
      ? this.http.patch<FlowModule>(`/api/catalogs/modules/${id}`, body)
      : this.http.post<FlowModule>('/api/catalogs/modules', body);
  }

  deleteModule(id: string) {
    return this.http.delete(`/api/catalogs/modules/${id}`);
  }

  // ----- Carga masiva -----
  uploadImport(files: File[], project: string, defaultModule: string, duplicateStrategy: DuplicateAction) {
    const form = new FormData();
    files.forEach((f) => form.append('files', f, f.name));
    form.append('project', project);
    form.append('defaultModule', defaultModule);
    form.append('duplicateStrategy', duplicateStrategy);
    return this.http.post<ImportDetail>('/api/imports', form);
  }

  imports(project?: string) {
    return this.http.get<ImportBatch[]>('/api/imports', { params: params({ project }) });
  }

  getImport(id: string) {
    return this.http.get<ImportDetail>(`/api/imports/${id}`);
  }

  setDuplicateStrategy(id: string, duplicateStrategy: DuplicateAction) {
    return this.http.patch<ImportDetail>(`/api/imports/${id}`, { duplicateStrategy });
  }

  updateImportRow(id: string, rowId: string, body: Record<string, unknown>) {
    return this.http.patch<ImportDetail>(`/api/imports/${id}/rows/${rowId}`, body);
  }

  confirmImport(id: string) {
    return this.http.post<ImportDetail>(`/api/imports/${id}/confirm`, {});
  }

  cancelImport(id: string) {
    return this.http.post<ImportDetail>(`/api/imports/${id}/cancel`, {});
  }

  /** Descarga una plantilla (requiere el token, por eso no se usa un enlace directo). */
  async downloadTemplate(format: 'xlsx' | 'docx' | 'csv', type?: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.get(`/api/templates/${format}`, { params: params({ type }), observe: 'response', responseType: 'blob' }),
    );
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `plantilla.${format}`;
    const url = URL.createObjectURL(res.body!);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ----- Administración -----
  users() {
    return this.http.get<User[]>('/api/users');
  }

  createUser(body: { email: string; name: string; password: string; role: Role }) {
    return this.http.post<User>('/api/users', body);
  }

  updateUser(id: string, body: Partial<{ name: string; role: Role; active: boolean; password: string }>) {
    return this.http.patch<User>(`/api/users/${id}`, body);
  }

  permissionMatrix() {
    return this.http.get<PermissionMatrix>('/api/permissions');
  }

  updateRolePermissions(role: Role, permissions: PermissionMap) {
    return this.http.put<PermissionMatrix>(`/api/permissions/${role}`, { permissions });
  }
}
