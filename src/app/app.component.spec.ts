import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed, async } from '@angular/core/testing';

import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [AppComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA]
    }).compileComponents();
  }));

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    expect(fixture.debugElement.componentInstance).toBeTruthy();
  });

  it('should apply the light theme by default', () => {
    window.localStorage.removeItem('passgen.theme');
    TestBed.createComponent(AppComponent);
    expect(document.documentElement.getAttribute('data-theme')).toEqual('light');
  });
});
