import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html'
})
export class HomeComponent implements OnInit {

  constructor(private router: Router, private http: HttpClient) {}

  ngOnInit(): void {
    const apiUrl = 'https://localhost:3121/api/auth/me';

    this.http
      .get<{ connected: boolean }>(apiUrl, { withCredentials: true })
      .subscribe({
        next: (response) => {
          if (!response.connected) {
            this.router.navigate(['/auth']);
          }
        },
        error: () => {
          this.router.navigate(['/auth']);
        },
      });
  }

  logout() {
    this.router.navigate(['/auth']);
  }
}

