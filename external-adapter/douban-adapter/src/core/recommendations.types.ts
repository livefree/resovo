export interface DoubanRecommendationItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  type: 'movie' | 'tv';
}

export interface DoubanRecommendationsResponse {
  code: number;
  message: string;
  list: DoubanRecommendationItem[];
}

export interface DoubanGetRecommendationsOptions {
  kind: 'movie' | 'tv';
  start?: number;
  limit?: number;
  category?: string | null;
  format?: string | null;
  region?: string | null;
  year?: string | null;
  platform?: string | null;
  sort?: string | null;
  label?: string | null;
  noCache?: boolean;
}
