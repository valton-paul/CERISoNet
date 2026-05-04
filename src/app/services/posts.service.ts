import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/api-base';
import type { CERISoNetPost, CERISoNetPostComment } from '../../shared/models/cerisonet-post';

function normalizeCreatedBy(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) {
    return v;
  }
  return 0;
}

/** `images` peut être `{}`, `[]` ou absent côté Mongo. */
function normalizeImages(raw: unknown): CERISoNetPost['images'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return undefined;
  }
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== 'string' || !url.trim()) {
    return undefined;
  }
  const title = (raw as { title?: unknown }).title;
  return {
    url: url.trim(),
    title: typeof title === 'string' ? title : '',
  };
}

function normalizeComment(raw: unknown): CERISoNetPostComment {
  const o = raw as Record<string, unknown>;
  return {
    _id: o['_id'] != null ? String(o['_id']) : undefined,
    text: typeof o['text'] === 'string' ? o['text'] : '',
    commentedBy: normalizeCreatedBy(o['commentedBy']),
    date: typeof o['date'] === 'string' ? o['date'] : '',
    hour: typeof o['hour'] === 'string' ? o['hour'] : '',
  };
}

function normalizePost(raw: CERISoNetPost): CERISoNetPost {
  return {
    ...raw,
    createdBy: normalizeCreatedBy(raw.createdBy as unknown),
    author: raw.author ?? null,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
    comments: Array.isArray(raw.comments)
      ? raw.comments.map((c) => normalizeComment(c))
      : [],
    likes: typeof raw.likes === 'number' ? raw.likes : 0,
    likedByMe: typeof raw.likedByMe === 'boolean' ? raw.likedByMe : false,
    images: normalizeImages(raw.images as unknown),
  };
}

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CERISoNetPost[]> {
    return this.http
      .get<{ posts: CERISoNetPost[] }>(`${API_BASE_URL}/posts`, {
        withCredentials: true,
      })
      .pipe(map((r) => (r.posts ?? []).map((p) => normalizePost(p))));
  }

  create(body: string): Observable<CERISoNetPost> {
    return this.http
      .post<{ post: CERISoNetPost }>(
        `${API_BASE_URL}/posts`,
        { body },
        { withCredentials: true },
      )
      .pipe(map((r) => normalizePost(r.post)));
  }

  addComment(postId: string, text: string): Observable<CERISoNetPost> {
    return this.http
      .post<{ post: CERISoNetPost }>(
        `${API_BASE_URL}/posts/${encodeURIComponent(postId)}/comments`,
        { text },
        { withCredentials: true },
      )
      .pipe(map((r) => normalizePost(r.post)));
  }

  deleteComment(postId: string, commentId: string): Observable<CERISoNetPost> {
    return this.http
      .delete<{ post: CERISoNetPost }>(
        `${API_BASE_URL}/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(commentId)}`,
        { withCredentials: true },
      )
      .pipe(map((r) => normalizePost(r.post)));
  }

  toggleLike(postId: string): Observable<CERISoNetPost> {
    return this.http
      .post<{ post: CERISoNetPost }>(
        `${API_BASE_URL}/posts/${encodeURIComponent(postId)}/like`,
        {},
        { withCredentials: true },
      )
      .pipe(map((r) => normalizePost(r.post)));
  }

  deletePost(postId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE_URL}/posts/${encodeURIComponent(postId)}`,
      { withCredentials: true },
    );
  }
}
