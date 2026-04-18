export interface DoubanComment {
  username: string;
  userId: string;
  avatar: string;
  rating: number;
  time: string;
  location: string;
  content: string;
  usefulCount: number;
}

export interface DoubanCommentsData {
  comments: DoubanComment[];
  start: number;
  limit: number;
  count: number;
}

export interface DoubanCommentsResponse {
  code: number;
  message: string;
  data?: DoubanCommentsData;
}

export interface DoubanGetCommentsOptions {
  start?: number;
  limit?: number;
  sort?: 'new_score' | 'time';
  noCache?: boolean;
}
