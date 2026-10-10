import { Routes } from '@angular/router';
import { authGuard, loginGuard, permissionGuard } from './core/guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'inicio' },
      { path: 'inicio', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
      {
        path: 'conocimiento/:type',
        canActivate: [permissionGuard('KNOWLEDGE', 'VIEW')],
        loadComponent: () => import('./pages/knowledge/knowledge-list.component').then((m) => m.KnowledgeListComponent),
      },
      {
        path: 'conocimiento/:type/nuevo',
        canActivate: [permissionGuard('KNOWLEDGE', 'CREATE')],
        loadComponent: () => import('./pages/knowledge/knowledge-form.component').then((m) => m.KnowledgeFormComponent),
      },
      {
        path: 'conocimiento/:type/:id',
        canActivate: [permissionGuard('KNOWLEDGE', 'VIEW')],
        loadComponent: () => import('./pages/knowledge/knowledge-form.component').then((m) => m.KnowledgeFormComponent),
      },
      {
        path: 'carga-masiva',
        canActivate: [permissionGuard('KNOWLEDGE', 'BULK_UPLOAD')],
        loadComponent: () => import('./pages/imports/import-upload.component').then((m) => m.ImportUploadComponent),
      },
      {
        path: 'carga-masiva/:id',
        canActivate: [permissionGuard('KNOWLEDGE', 'BULK_UPLOAD')],
        loadComponent: () => import('./pages/imports/import-review.component').then((m) => m.ImportReviewComponent),
      },
      {
        path: 'catalogos',
        canActivate: [permissionGuard('CATALOGS', 'VIEW')],
        loadComponent: () => import('./pages/catalogs/catalogs.component').then((m) => m.CatalogsComponent),
      },
      {
        path: 'admin/usuarios',
        canActivate: [permissionGuard('ADMIN', 'VIEW')],
        loadComponent: () => import('./pages/admin/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'admin/permisos',
        canActivate: [permissionGuard('ADMIN', 'VIEW')],
        loadComponent: () => import('./pages/admin/permissions.component').then((m) => m.PermissionsComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
