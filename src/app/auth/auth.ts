import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.html'
})
export class AuthComponent {
  mail = '';
  password = '';
  successMessage: string | null = null;
  errorMessage: string | null = null;

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    const apiUrl = 'https://localhost:3121/api/auth/login';

    this.http.post<{ success: boolean; message?: string; error?: string }>(apiUrl, {
      mail: this.mail,
      password: this.password
    }).subscribe({
      next: (response) => {
        if (response.success) {
          this.successMessage = response.message || 'Connecté';
          this.errorMessage = null;
          this.router.navigate(['/home']);
        } else {
          this.successMessage = null;
          this.errorMessage = response.error || 'Identifiant ou mot de passe incorrect';
        }
      },
      error: (err) => {
        console.error(err);
        this.successMessage = null;
        this.errorMessage = err?.error?.error || 'Erreur de connexion au serveur';
      }
    });
  }
}

