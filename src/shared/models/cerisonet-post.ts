export interface CERISoNetPostImages {
  url: string;
  title: string;
}

export interface CERISoNetPostComment {
  text: string;
  commentedBy: number;
  date: string;
  hour: string;
}

/** Renseigné par l’API via PostgreSQL (fredouil.compte). */
export interface CERISoNetPostAuthor {
  id: number;
  pseudo: string;
  mail: string;
}

export interface CERISoNetPost {
  _id: string;
  date: string;
  hour: string;
  body: string;
  createdBy: number;
  /** Rempli par l’API (PostgreSQL) ; absent ou null si compte introuvable. */
  author?: CERISoNetPostAuthor | null;
  images?: CERISoNetPostImages;
  likes: number;
  hashtags: string[];
  comments: CERISoNetPostComment[];
  shared?: string;
}

export type CERISoNetPostDraft = Omit<CERISoNetPost, '_id' | 'author'>;