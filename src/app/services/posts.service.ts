import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../core/api-base';
import type { CERISoNetPost } from '../../shared/models/cerisonet-post';

@Injectable({ providedIn: 'root' })
export class PostsService {
  private readonly http = inject(HttpClient);

  getAll(): Observable<CERISoNetPost[]> {
    return this.http
      .get<{ posts: CERISoNetPost[] }>(`${API_BASE_URL}/posts`, {
        withCredentials: true,
      })
      .pipe(map((r) => r.posts ?? []));
  }
}
