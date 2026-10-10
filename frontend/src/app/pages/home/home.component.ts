import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Project } from '../../core/models';
import { NotifyService } from '../../core/notify.service';

const ICONS: Record<string, string> = {
  requirements: 'description',
  'business-rules': 'rule',
  'test-cases': 'fact_check',
  defects: 'bug_report',
};

@Component({
  selector: 'app-home',
  imports: [RouterLink, FormsModule, MatCardModule, MatIconModule, MatButtonModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly notify = inject(NotifyService);

  readonly icons = ICONS;
  readonly projects = signal<Project[]>([]);
  readonly summary = signal<{ type: string; label: string; total: number }[]>([]);
  project = '';

  async ngOnInit(): Promise<void> {
    if (!this.auth.can('KNOWLEDGE', 'VIEW')) return;
    try {
      this.projects.set(await firstValueFrom(this.api.projects()));
      await this.loadSummary();
    } catch (e) {
      this.notify.error(e);
    }
  }

  async loadSummary(): Promise<void> {
    this.summary.set(await firstValueFrom(this.api.summary(this.project || undefined)));
  }

  async download(format: 'xlsx' | 'docx'): Promise<void> {
    try {
      await this.api.downloadTemplate(format);
    } catch (e) {
      this.notify.error(e);
    }
  }
}
