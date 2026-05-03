import {
  Component,
  OnInit,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { API_BASE_URL } from '../core/api-base';
import { PostsService } from '../services/posts.service';
import type { CERISoNetPost, CERISoNetPostComment } from '../../shared/models/cerisonet-post';

/** Nombre de posts affichés au départ, puis ajoutés à chaque fin de scroll. */
const PAGE_SIZE = 12;

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly postsService = inject(PostsService);
  private readonly toastr = inject(ToastrService);

  private readonly loadMoreSentinel = viewChild<ElementRef<HTMLElement>>('loadMoreSentinel');

  /** Tous les posts renvoyés par l’API. */
  readonly posts = signal<CERISoNetPost[]>([]);
  readonly feedLoading = signal(false);
  readonly feedError = signal<string | null>(null);

  composeBody = '';
  readonly publishSubmitting = signal(false);

  /** Utilisateur connecté (pour afficher « Supprimer » sur ses commentaires). */
  readonly currentUserId = signal<number | null>(null);
  readonly commentDraft = signal<Record<string, string>>({});
  readonly commentSubmitting = signal<string | null>(null);
  readonly commentDeleting = signal<string | null>(null);

  /** Nombre de posts actuellement rendus (scroll infini). */
  readonly visibleCount = signal(PAGE_SIZE);

  readonly displayedPosts = computed(() => this.posts().slice(0, this.visibleCount()));

  readonly hasMoreInFeed = computed(() => this.visibleCount() < this.posts().length);

  readonly hiddenCount = computed(() =>
    Math.max(0, this.posts().length - this.visibleCount()),
  );

  constructor() {
    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel();
      if (!sentinel || !this.hasMoreInFeed() || this.feedLoading()) {
        return;
      }

      const el = sentinel.nativeElement;
      const io = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.loadMoreChunk();
          }
        },
        { root: null, rootMargin: '280px', threshold: 0 },
      );
      io.observe(el);
      onCleanup(() => io.disconnect());
    });
  }

  ngOnInit(): void {

    const meUrl = `${API_BASE_URL}/auth/me`;
    this.http
      .get<{ connected: boolean; userId?: number }>(meUrl, { withCredentials: true })
      .subscribe({
        next: (response) => {
          if (!response.connected) {
            void this.router.navigate(['/auth']);
            return;
          }
          if (typeof response.userId === 'number' && Number.isFinite(response.userId)) {
            this.currentUserId.set(response.userId);
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
        this.visibleCount.set(Math.min(PAGE_SIZE, list.length));
        this.feedLoading.set(false);
      },
      error: () => {
        this.feedError.set('Impossible de charger le fil d’actualité.');
        this.feedLoading.set(false);
      },
    });
  }

  private loadMoreChunk(): void {
    const total = this.posts().length;
    this.visibleCount.update((n) => Math.min(n + PAGE_SIZE, total));
  }

  patchCommentDraft(postId: string, value: string): void {
    this.commentDraft.update((m) => ({ ...m, [postId]: value }));
  }

  submitComment(postId: string): void {
    const text = (this.commentDraft()[postId] ?? '').trim();
    if (!text || this.commentSubmitting()) {
      return;
    }
    this.commentSubmitting.set(postId);
    this.postsService.addComment(postId, text).subscribe({
      next: (post) => {
        this.mergePost(post);
        this.commentDraft.update((m) => {
          const { [postId]: _, ...rest } = m;
          return rest;
        });
        this.commentSubmitting.set(null);
        this.toastr.success('Commentaire publié.');
      },
      error: (err: { error?: { error?: string } }) => {
        this.commentSubmitting.set(null);
        this.toastr.error(err?.error?.error ?? 'Impossible d’ajouter le commentaire.');
      },
    });
  }

  removeMyComment(postId: string, commentId: string | undefined): void {
    if (!commentId) {
      return;
    }
    const key = `${postId}:${commentId}`;
    this.commentDeleting.set(key);
    this.postsService.deleteComment(postId, commentId).subscribe({
      next: (post) => {
        this.mergePost(post);
        this.commentDeleting.set(null);
        this.toastr.success('Commentaire supprimé.');
      },
      error: (err: { error?: { error?: string } }) => {
        this.commentDeleting.set(null);
        this.toastr.error(err?.error?.error ?? 'Impossible de supprimer le commentaire.');
      },
    });
  }

  canDeleteComment(c: CERISoNetPostComment): boolean {
    const uid = this.currentUserId();
    return uid != null && c.commentedBy === uid && !!c._id;
  }

  isSubmittingComment(postId: string): boolean {
    return this.commentSubmitting() === postId;
  }

  isDeletingComment(postId: string, commentId: string | undefined): boolean {
    if (!commentId) {
      return false;
    }
    return this.commentDeleting() === `${postId}:${commentId}`;
  }

  private mergePost(post: CERISoNetPost): void {
    this.posts.update((list) => list.map((p) => (p._id === post._id ? post : p)));
  }

  publish(): void {
    const text = this.composeBody.trim();
    if (!text || this.publishSubmitting()) {
      return;
    }
    this.publishSubmitting.set(true);
    this.postsService.create(text).subscribe({
      next: (post) => {
        this.posts.update((list) => [post, ...list]);
        this.visibleCount.update((n) =>
          Math.min(this.posts().length, Math.max(n, 1)),
        );
        this.composeBody = '';
        this.publishSubmitting.set(false);
        this.toastr.success('Publication envoyée.');
      },
      error: (err: { error?: { error?: string } }) => {
        this.publishSubmitting.set(false);
        this.toastr.error(err?.error?.error ?? 'Impossible de publier.');
      },
    });
  }

  /** Initiales pour l’avatar (pseudo PostgreSQL ou repli sur l’id). */
  authorInitials(post: CERISoNetPost): string {
    const pseudo = post.author?.pseudo?.trim();
    if (pseudo && pseudo.length > 0) {
      return pseudo.length >= 2 ? pseudo.slice(0, 2) : pseudo.charAt(0) + pseudo.charAt(0);
    }
    if (post.shared) {
      return 'PT';
    }
    return String(post.createdBy ?? 0).slice(0, 2);
  }

  authorDisplayName(post: CERISoNetPost): string {
    const pseudo = post.author?.pseudo?.trim();
    if (pseudo) {
      return pseudo;
    }
    if (post.shared) {
      return 'Partage';
    }
    return `Utilisateur #${post.createdBy ?? 0}`;
  }

  logout(): void {
    void this.router.navigate(['/auth']);
  }
}
