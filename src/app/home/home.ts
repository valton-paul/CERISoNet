import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

interface Post {
  id: number;
  author: string;
  initials: string;
  time: string;
  caption: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html'
})
export class HomeComponent {
  posts: Post[] = [
    {
      id: 1,
      author: 'Fourmi',
      initials: 'FO',
      time: 'il y a 2 min',
      caption: 'Premier test de la timeline CERISoNet.'
    },
    {
      id: 2,
      author: 'Chat',
      initials: 'CH',
      time: 'il y a 10 min',
      caption: 'Un autre post pour remplir un peu le fil.'
    }
  ];

  constructor(private router: Router) {}

  logout() {
    this.router.navigate(['/auth']);
  }
}

