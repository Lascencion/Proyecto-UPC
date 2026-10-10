import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom, Observable } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FlowModule, Project } from '../../core/models';
import { NotifyService } from '../../core/notify.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { NameDialogComponent, NameDialogData } from './name-dialog.component';

@Component({
  selector: 'app-catalogs',
  imports: [MatCardModule, MatButtonModule, MatIconModule, MatListModule, MatSlideToggleModule, MatTooltipModule],
  templateUrl: './catalogs.component.html',
  styleUrl: './catalogs.component.scss',
})
export class CatalogsComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);
  private readonly dialog = inject(MatDialog);

  readonly projects = signal<Project[]>([]);
  readonly modules = signal<FlowModule[]>([]);
  readonly selectedId = signal<string | null>(null);
  readonly selected = computed(() => this.projects().find((p) => p.id === this.selectedId()) ?? null);

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    try {
      const projects = await firstValueFrom(this.api.projects());
      this.projects.set(projects);
      if (!projects.some((p) => p.id === this.selectedId())) this.select(projects[0]?.id ?? null);
    } catch (e) {
      this.notify.error(e);
    }
  }

  async select(id: string | null): Promise<void> {
    this.selectedId.set(id);
    this.modules.set(id ? await firstValueFrom(this.api.modules(id)) : []);
  }

  private ask(data: NameDialogData) {
    return firstValueFrom(
      this.dialog.open(NameDialogComponent, { data, width: '480px' }).afterClosed(),
    ) as Promise<{ name: string; description: string } | undefined>;
  }

  private async exec<T>(obs: Observable<T>, message: string): Promise<T | undefined> {
    try {
      const res = await firstValueFrom(obs);
      this.notify.success(message);
      return res;
    } catch (e) {
      this.notify.error(e);
      return undefined;
    }
  }

  async editProject(project?: Project): Promise<void> {
    const value = await this.ask({ title: project ? 'Editar proyecto' : 'Nuevo proyecto', ...project });
    if (!value) return;
    const saved = await this.exec(this.api.saveProject(value, project?.id), 'Proyecto guardado.');
    if (saved) {
      await this.loadProjects();
      if (!project) this.select(saved.id);
    }
  }

  async toggleProject(project: Project): Promise<void> {
    await this.exec(this.api.saveProject({ active: !project.active }, project.id), project.active ? 'Proyecto desactivado.' : 'Proyecto activado.');
    await this.loadProjects();
  }

  async deleteProject(project: Project): Promise<void> {
    if (!(await this.confirmDelete(`el proyecto "${project.name}" y sus módulos`))) return;
    if (await this.exec(this.api.deleteProject(project.id), 'Proyecto eliminado.')) await this.loadProjects();
  }

  async editModule(module?: FlowModule): Promise<void> {
    const project = this.selected();
    if (!project) return;
    const value = await this.ask({ title: module ? 'Editar módulo / flujo' : `Nuevo módulo / flujo en ${project.name}`, ...module });
    if (!value) return;
    const body = module ? value : { ...value, project: project.id };
    if (await this.exec(this.api.saveModule(body, module?.id), 'Módulo guardado.')) this.select(project.id);
  }

  async toggleModule(module: FlowModule): Promise<void> {
    await this.exec(this.api.saveModule({ active: !module.active }, module.id), module.active ? 'Módulo desactivado.' : 'Módulo activado.');
    this.select(this.selectedId());
  }

  async deleteModule(module: FlowModule): Promise<void> {
    if (!(await this.confirmDelete(`el módulo "${module.name}"`))) return;
    if (await this.exec(this.api.deleteModule(module.id), 'Módulo eliminado.')) this.select(this.selectedId());
  }

  private confirmDelete(what: string): Promise<boolean> {
    return firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          data: {
            title: 'Eliminar',
            message: `¿Eliminar ${what}? Solo es posible si no tiene información registrada; de lo contrario, desactívelo.`,
            confirmText: 'Eliminar',
            danger: true,
          },
        })
        .afterClosed(),
    );
  }
}
