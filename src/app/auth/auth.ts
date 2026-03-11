import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './auth.html'
})
export class AuthComponent {
  mail = '';
  password = '';

  constructor(
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService
  ) {}

  onSubmit() {
    const apiUrl = 'https://localhost:3121/api/auth/login';

    this.http.post<{
      success: boolean;
      message?: string;
      error?: string;
      lastLogin?: string;
      username?: string;
      userId?: number;
      mail?: string;
    }>(
      apiUrl,
      {
        mail: this.mail,
        password: this.password
      },
      {
        withCredentials: true
      }
    ).subscribe({
      next: (response) => {
        if (response.success) {

          localStorage.setItem('username', response.username || '');
          localStorage.setItem('userId', response.userId?.toString() || '');
          localStorage.setItem('mail', response.mail || '');
          localStorage.setItem('lastLogin', response.lastLogin || '');
          localStorage.setItem('connected', 'true');

          this.toastr.success('Connexion réussie ! Dernière connexion le ' + response.lastLogin);
          this.router.navigate(['/home']);
        } else {
          this.toastr.error(response.error || 'Identifiant ou mot de passe incorrect');
        }
      },
      error: (err) => {
        this.toastr.error(err?.error?.error || 'Erreur de connexion au serveur');
      }
    });
  }
}

