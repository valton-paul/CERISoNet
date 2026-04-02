import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { API_BASE_URL } from '../core/api-base';
import { PostsService } from '../services/posts.service';
import type { CERISoNetPost } from '../../shared/models/cerisonet-post';

const FEED_PREVIEW = 20;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly postsService = inject(PostsService);

  /** Tous les posts renvoyés par l’API. */
  readonly posts = signal<CERISoNetPost[]>([]);
  readonly feedLoading = signal(false);
  readonly feedError = signal<string | null>(null);

  readonly displayedPosts = computed(() => this.posts().slice(0, FEED_PREVIEW));
  readonly hiddenCount = computed(() => Math.max(0, this.posts().length - FEED_PREVIEW));

  ngOnInit(): void {

    const meUrl = `${API_BASE_URL}/auth/me`;
    this.http
      .get<{ connected: boolean }>(meUrl, { withCredentials: true })
      .subscribe({
        next: (response) => {
          if (!response.connected) {
            void this.router.navigate(['/auth']);
            return;
          }
          this.loadFeed();
        },
        error: () => {
          void this.router.navigate(['/auth']);
        },
      });
  }

  private loadFeed(): void {
    this.feedLoading.set(true);
    this.feedError.set(null);
    this.postsService.getAll().subscribe({
      next: (list) => {
        this.posts.set(list);
        this.feedLoading.set(false);
      },
      error: () => {
        this.feedError.set('Impossible de charger le fil d’actualité.');
        this.feedLoading.set(false);
      },
    });
  }

  logout(): void {
    void this.router.navigate(['/auth']);
  }
}
