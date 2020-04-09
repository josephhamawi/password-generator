import { Router } from '@angular/router';
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';



@Component({
  selector: 'app-generate',
  templateUrl: './generate.page.html',
  styleUrls: ['./generate.page.scss'],
 
})
export class GeneratePage implements OnInit {
  checkboxes = [
    {
      "id": "lowercase",
      "label": "a-z",
      "library": "abcdefghijklmnopqrstuvwxyz",
      "checked": true
    }, {
      "id": "uppercase",
      "label": "A-Z",
      "library": "ABCDEFGHIJKLMNOPWRSTUVWXYZ",
      "checked": true
    }, {
      "id": "numbers",
      "label": "0-9",
      "library": "0123456789",
      "checked": true
    }, {
      "id": "symbols",
      "label": "!-?",
      "library": "!@#$%^&*-_=+\\|:;',.\<>/?~",
      "checked": false
    }
  ]

  dictionary: Array<String>;

  lowercase: Boolean = this.checkboxes[0].checked;
  uppercase: Boolean = this.checkboxes[1].checked;
  numbers: Boolean = this.checkboxes[2].checked;
  symbols: Boolean = this.checkboxes[3].checked;

  passwordLenght: Number = 4;
  buttonLabel: String = "Generate";
  newPassword: String;

  constructor(private Route : Router) { }

  ngOnInit() {
  }

  private updatePasswordLength(event) {
    this.passwordLenght = event.target.value;
  }

  private updateCheckboxValue(event) {
    if (event.target.id == "lowercase")
      this.lowercase = event.target.checked;

    if (event.target.id == "uppercase")
      this.uppercase = event.target.checked;

    if (event.target.id == "numbers")
      this.numbers = event.target.checked;

    if (event.target.id == "symbols")
      this.symbols = event.target.checked;
  }


  private generatePassword() {
    if (this.lowercase === false && this.uppercase === false && this.numbers === false && this.symbols === false) {
      return this.newPassword = "...";
    }

    // Create array from chosen checkboxes
    this.dictionary = [].concat(
      this.lowercase ? this.checkboxes[0].library.split("") : [],
      this.uppercase ? this.checkboxes[1].library.split("") : [],
      this.numbers ? this.checkboxes[2].library.split("") : [],
      this.symbols ? this.checkboxes[3].library.split("") : []
    );


    // Generate random password from array
    var newPassword = "";    for (var i = 0; i < this.passwordLenght; i++) {
      newPassword += this.dictionary[Math.floor(Math.random() * this.dictionary.length)];
    }
    this.newPassword = newPassword;


    // Call copy function

    console.log(this.newPassword);



  }
  // @ViewChild('passwordOutput') password: ElementRef;
  // private copyPassword() {
  //   const inputElement = <HTMLInputElement>this.password.nativeElement;
  //   inputElement.select();
  //   document.execCommand("copy");
  // }
}
