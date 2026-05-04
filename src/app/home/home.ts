import {
  Component,
  OnDestroy,
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
import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL, SOCKET_ORIGIN } from '../core/api-base';
import { clearClientAuthSession, isClientMarkedConnected } from '../core/client-session';
import { PostsService } from '../services/posts.service';
import type { CERISoNetPost, CERISoNetPostComment } from '../../shared/models/cerisonet-post';

const PAGE_SIZE = 12;


type FeedSortId = 'recent' | 'oldest' | 'likes' | 'comments' | 'mine';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.html',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly postsService = inject(PostsService);
  private readonly toastr = inject(ToastrService);

  private socket: Socket | null = null;

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
  readonly likeSubmitting = signal<string | null>(null);

  /** Nombre de posts actuellement rendus (scroll infini). */
  readonly visibleCount = signal(PAGE_SIZE);

  /** Recherche + tri appliqués en local sur le fil chargé. */
  readonly feedSearch = signal('');
  readonly feedSort = signal<FeedSortId>('recent');

  readonly filteredAndSortedPosts = computed(() => {
    const source = this.posts();
    let list = [...source];
    const sort = this.feedSort();
    const uid = this.currentUserId();

    if (sort === 'mine') {
      list = uid != null ? list.filter((p) => p.createdBy === uid) : [];
    }

    const q = this.feedSearch().trim();
    if (q) {
      list = list.filter((p) => this.postMatchesSearch(p, q));
    }

    const orderIndex = (p: CERISoNetPost) => source.findIndex((x) => x._id === p._id);
    if (sort === 'oldest') {
      list.reverse();
    } else if (sort === 'likes') {
      list.sort((a, b) => b.likes - a.likes || orderIndex(a) - orderIndex(b));
    } else if (sort === 'comments') {
      list.sort(
        (a, b) =>
          (b.comments?.length ?? 0) - (a.comments?.length ?? 0) ||
          orderIndex(a) - orderIndex(b),
      );
    }

    return list;
  });

  readonly displayedPosts = computed(() =>
    this.filteredAndSortedPosts().slice(0, this.visibleCount()),
  );

  readonly postsById = computed(() => {
    const m = new Map<string, CERISoNetPost>();
    for (const p of this.posts()) {
      m.set(p._id, p);
    }
    return m;
  });

  readonly hasMoreInFeed = computed(
    () => this.visibleCount() < this.filteredAndSortedPosts().length,
  );

  readonly hiddenCount = computed(() =>
    Math.max(0, this.filteredAndSortedPosts().length - this.visibleCount()),
  );

  constructor() {
    effect((onCleanup) => {
      const sentinel = this.loadMoreSentinel();
      if (!sentinel || !this.hasMoreInFeed() || this.feedLoading()) {
        return;
      }

      const el = sentinel.nativeElement;
      const scrollObserver = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            this.loadMoreChunk();
          }
        },
        { root: null, rootMargin: '280px', threshold: 0 },
      );
      scrollObserver.observe(el);
      onCleanup(() => scrollObserver.disconnect());
    });
  }

  ngOnInit(): void {
    if (!isClientMarkedConnected()) {
      void this.router.navigate(['/auth']);
      return;
    }
    const rawId = localStorage.getItem('userId');
    const uid = rawId != null ? Number(rawId) : NaN;
    if (Number.isFinite(uid)) {
      this.currentUserId.set(uid);
    }
    this.connectSocket();
    this.loadFeed();
  }

  ngOnDestroy(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private connectSocket(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    const s = io(SOCKET_ORIGIN, { withCredentials: true });
    this.socket = s;
    s.on('infoSocket', (msg: unknown) => {
      const text = typeof msg === 'string' ? msg : '';
      if (text) {
        this.toastr.info(text);
      }
    });

    s.on(
      'postLikeUpdated',
      (data: {
        postId?: string;
        likes?: number;
        actorId?: number;
        pseudo?: string;
        removing?: boolean;
      }) => {
        const postId = typeof data?.postId === 'string' ? data.postId : '';
        const likes = typeof data?.likes === 'number' ? data.likes : null;
        if (!postId || likes == null) {
          return;
        }
        const actorId = data.actorId;
        const removing = data.removing === true;
        const myId = this.currentUserId();
        this.posts.update((list) =>
          list.map((p) => {
            if (p._id !== postId) {
              return p;
            }
            let likedByMe = p.likedByMe ?? false;
            if (typeof actorId === 'number' && myId != null && actorId === myId) {
              likedByMe = !removing;
            }
            return { ...p, likes, likedByMe };
          }),
        );

        if (typeof actorId === 'number' && myId != null && actorId === myId) {
          if (removing) {
            this.toastr.info(
              `Vous avez retiré votre j’aime sur le post « ${postId} » via socket.`,
            );
          } else {
            this.toastr.info(`Vous avez liké le post « ${postId} » via socket.`);
          }
        }

        const pseudo = typeof data.pseudo === 'string' ? data.pseudo.trim() : '';
        if (
          pseudo &&
          typeof actorId === 'number' &&
          actorId !== myId &&
          !removing
        ) {
          this.toastr.info(`${pseudo} a aimé une publication.`);
        }
      },
    );
  }

  private loadFeed(): void {
    this.feedLoading.set(true);
    this.feedError.set(null);
    this.postsService.getAll().subscribe({
      next: (list) => {
        this.posts.set(list);
        this.feedSearch.set('');
        this.feedSort.set('recent');
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
    const total = this.filteredAndSortedPosts().length;
    this.visibleCount.update((n) => Math.min(n + PAGE_SIZE, total));
  }

  private postMatchesSearch(post: CERISoNetPost, rawQuery: string): boolean {
    const tokens = rawQuery
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      return true;
    }
    const author = post.author?.pseudo?.trim() ?? '';
    const tags = (post.hashtags ?? []).join(' ');
    const comments = (post.comments ?? []).map((c) => c.text).join(' ');
    const shared = this.getSharedPost(post);
    const sharedAuthor = shared?.author?.pseudo?.trim() ?? '';
    const sharedBody = shared?.body ?? '';
    const hay = [post.body, author, tags, comments, sharedAuthor, sharedBody].join('\n').toLowerCase();
    return tokens.every((t) => hay.includes(t));
  }

  onFeedSearchChange(value: string): void {
    this.feedSearch.set(value);
    this.resetVisibleWindow();
  }

  setFeedSort(id: FeedSortId): void {
    this.feedSort.set(id);
    this.resetVisibleWindow();
  }

  private resetVisibleWindow(): void {
    const n = this.filteredAndSortedPosts().length;
    this.visibleCount.set(Math.min(PAGE_SIZE, Math.max(n, 0)));
  }

  isFeedSortActive(id: FeedSortId): boolean {
    return this.feedSort() === id;
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

  toggleLikePost(postId: string): void {
    if (this.likeSubmitting()) {
      return;
    }
    this.likeSubmitting.set(postId);
    this.postsService.toggleLike(postId).subscribe({
      next: (post) => {
        this.mergePost(post);
        this.likeSubmitting.set(null);
      },
      error: (err: { error?: { error?: string } }) => {
        this.likeSubmitting.set(null);
        this.toastr.error(err?.error?.error ?? 'Impossible de mettre à jour le j’aime.');
      },
    });
  }

  isLikingPost(postId: string): boolean {
    return this.likeSubmitting() === postId;
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
        const total = this.filteredAndSortedPosts().length;
        this.visibleCount.update((n) => Math.min(total, Math.max(n, 1)));
        this.composeBody = '';
        this.publishSubmitting.set(false);
        this.toastr.success('Publication envoyée.');
        this.socket?.emit('activite', { kind: 'publish' });
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

  getSharedPost(post: CERISoNetPost): CERISoNetPost | null {
    if (!post.shared) {
      return null;
    }
    const sharedPost = this.postsById().get(post.shared) ?? null;
    if (!sharedPost || sharedPost._id === post._id) {
      return null;
    }
    return sharedPost;
  }

  logout(): void {
    this.http
      .post<{ ok?: boolean }>(`${API_BASE_URL}/auth/logout`, {}, { withCredentials: true })
      .subscribe({
        next: () => this.finishLogout(),
        error: () => this.finishLogout(),
      });
  }

  private finishLogout(): void {
    clearClientAuthSession();
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    void this.router.navigate(['/auth']);
  }
}
