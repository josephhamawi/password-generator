import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo() {
    return browser.get('/');
  }

  getContentText() {
    return element(by.deepCss('app-root ion-content')).getText();
  }
}
