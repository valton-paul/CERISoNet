import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/api-base';
import type { CERISoNetPost } from '../../shared/models/cerisonet-post';

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

function normalizePost(raw: CERISoNetPost): CERISoNetPost {
  return {
    ...raw,
    createdBy: normalizeCreatedBy(raw.createdBy as unknown),
    author: raw.author ?? null,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    likes: typeof raw.likes === 'number' ? raw.likes : 0,
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
}
