export interface DoubanPersonAvatarSet {
  small: string;
  medium: string;
  large: string;
}

export interface DoubanCelebrity {
  id: string;
  name: string;
  avatar: string;
  role: string;
  avatars?: DoubanPersonAvatarSet;
}

export interface DoubanRecommendation {
  id: string;
  title: string;
  poster: string;
  rate: string;
}

export interface DoubanSubjectDetails {
  id: string;
  title: string;
  poster: string;
  rate: string;
  year: string;
  directors: string[];
  screenwriters: string[];
  cast: string[];
  genres: string[];
  countries: string[];
  languages: string[];
  episodes?: number;
  episodeLength?: number;
  movieDuration?: number;
  firstAired?: string;
  plotSummary?: string;
  celebrities: DoubanCelebrity[];
  recommendations: DoubanRecommendation[];
  actors: DoubanCelebrity[];
  backdrop?: string;
  trailerUrl?: string;
}

export interface DoubanDetailsResponse {
  code: number;
  message: string;
  data?: DoubanSubjectDetails;
}

export interface DoubanGetByIdOptions {
  noCache?: boolean;
}

export interface DoubanMobileApiMediaData {
  trailerUrl?: string;
  backdrop?: string;
}
