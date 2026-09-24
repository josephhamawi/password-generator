import { AppPage } from './app.po';

describe('PassGen', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('shows the generator on load', () => {
    page.navigateTo();
    expect(page.getContentText()).toContain('PassGen');
  });
});
