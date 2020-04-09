import { Router } from '@angular/router';
import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-sign-up',
  templateUrl: './sign-up.page.html',
  styleUrls: ['./sign-up.page.scss'],
})
export class SignUpPage implements OnInit {

  constructor(private route: Router) { }

  ngOnInit() {
  }
  onSignUp() {
    this.route.navigateByUrl('login');
  }
}
