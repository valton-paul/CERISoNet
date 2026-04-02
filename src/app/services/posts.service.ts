import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/api-base';
import type { CERISoNetPost } from '../../shared/models/cerisonet-post';

function normalizePost(raw: CERISoNetPost): CERISoNetPost {
  return {
    ...raw,
    author: raw.author ?? null,
    hashtags: Array.isArray(raw.hashtags) ? raw.hashtags : [],
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    likes: typeof raw.likes === 'number' ? raw.likes : 0,
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
