import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.html'
})
export class AuthComponent {
  username = '';
  password = '';

  constructor(private http: HttpClient) {}

  onSubmit() {
    const apiUrl = 'https://localhost:3121/api/auth/login';

    this.http.post(apiUrl, {
      username: this.username,
      password: this.password
    }, { responseType: 'text' }).subscribe({
      next: (response) => {
        console.log("response: " + response);
      },
      error: (err) => {
        console.error(err);
      }
    });
  }
}

