import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { GeneratePageRoutingModule } from './generate-routing.module';
import { GeneratePage } from './generate.page';

import { BrandLogoComponent } from '../shared/brand-logo.component';
import { GeneratorPanelComponent } from '../panels/generator-panel.component';
import { VaultPanelComponent } from '../panels/vault-panel.component';
import { WordsPanelComponent } from '../panels/words-panel.component';
import { ProfilePanelComponent } from '../panels/profile-panel.component';
import { SpecsPanelComponent } from '../panels/specs-panel.component';
import { BlogPanelComponent } from '../panels/blog-panel.component';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, GeneratePageRoutingModule],
  declarations: [
    GeneratePage,
    BrandLogoComponent,
    GeneratorPanelComponent,
    VaultPanelComponent,
    WordsPanelComponent,
    ProfilePanelComponent,
    SpecsPanelComponent,
    BlogPanelComponent
  ]
})
export class GeneratePageModule {}
