export type DoubanCelebrityWorksMode = 'search' | 'api';

export interface DoubanCelebrityWorkItem {
  id: string;
  title: string;
  poster: string;
  rate: string;
  url: string;
  source: string;
}

export interface DoubanCelebrityWorksResponse {
  success: boolean;
  celebrityName: string;
  mode: DoubanCelebrityWorksMode;
  works: DoubanCelebrityWorkItem[];
  total: number;
}

export interface DoubanGetCelebrityWorksOptions {
  name: string;
  limit?: number;
  mode?: DoubanCelebrityWorksMode;
  noCache?: boolean;
}
