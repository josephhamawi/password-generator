import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'generate', pathMatch: 'full' },
  {
    path: 'generate',
    loadChildren: () => import('./generate/generate.module').then(m => m.GeneratePageModule)
  },
  { path: '**', redirectTo: 'generate' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
