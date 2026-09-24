import { Component, ViewChild } from '@angular/core';

import { ThemeService, ThemeChoice } from '../theme.service';
import { GeneratorPanelComponent } from '../panels/generator-panel.component';
import { WordsPanelComponent } from '../panels/words-panel.component';

type TabId = 'generate' | 'vault' | 'words' | 'profile' | 'specs' | 'blog';

@Component({
  selector: 'app-generate',
  templateUrl: './generate.page.html',
  styleUrls: ['./generate.page.scss']
})
export class GeneratePage {
  tab: TabId = 'generate';

  tabs: Array<{ id: TabId; label: string }> = [
    { id: 'generate', label: 'Generate' },
    { id: 'vault', label: 'Vault' },
    { id: 'words', label: 'Words' },
    { id: 'profile', label: 'Profile' },
    { id: 'specs', label: 'Specs' },
    { id: 'blog', label: 'Blog' }
  ];

  @ViewChild(GeneratorPanelComponent, { static: true })
  generator: GeneratorPanelComponent;

  @ViewChild(WordsPanelComponent, { static: true })
  wordsPanel: WordsPanelComponent;

  constructor(private theme: ThemeService) { }

  /**
   * The generator panel is no longer rebuilt on every tab change, so profile
   * and spec edits made on the other tabs are pulled in on the way back.
   */
  select(id: TabId): void {
    this.tab = id;
    if (id === 'words' && this.wordsPanel && !this.wordsPanel.loading) {
      // The list only decrypts once the vault is open, so re-read on the way in.
      this.wordsPanel.reload();
    }
    if (id === 'generate' && this.generator && !this.generator.loading) {
      this.generator.refresh();
      this.generator.generate();
    }
  }

  get themeChoice(): ThemeChoice { return this.theme.choice; }

  setTheme(choice: ThemeChoice): void { this.theme.set(choice); }
}
