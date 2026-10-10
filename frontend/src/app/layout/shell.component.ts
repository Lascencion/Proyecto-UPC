import { BreakpointObserver } from '@angular/cdk/layout';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ChangePasswordDialogComponent } from './change-password-dialog.component';

const KNOWLEDGE_ICONS: Record<string, string> = {
  requirements: 'description',
  'business-rules': 'rule',
  'test-cases': 'fact_check',
  defects: 'bug_report',
};

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly dialog = inject(MatDialog);

  readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 960px)')
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  private readonly definitions = toSignal(this.api.definitions().pipe(catchError(() => of([]))), { initialValue: [] });
  readonly knowledgeLinks = computed(() =>
    this.definitions().map((d) => ({ type: d.type, label: d.labelPlural, icon: KNOWLEDGE_ICONS[d.type] ?? 'article' })),
  );

  changePassword(): void {
    this.dialog.open(ChangePasswordDialogComponent, { width: '420px' });
  }
}
