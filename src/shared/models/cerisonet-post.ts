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

export interface CERISoNetPost {
  _id: string;
  date: string;
  hour: string;
  body: string;
  createdBy: number;
  images?: CERISoNetPostImages;
  likes: number;
  hashtags: string[];
  comments: CERISoNetPostComment[];
  shared?: string;
}

export type CERISoNetPostDraft = Omit<CERISoNetPost, '_id'>;