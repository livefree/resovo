import type {
  DoubanCelebrity,
  DoubanDetailsResponse,
  DoubanRecommendation,
  DoubanSubjectDetails,
} from '../core/details.types.js';

export interface SnakeCaseDoubanCelebrity extends DoubanCelebrity {}

export interface SnakeCaseDoubanRecommendation extends DoubanRecommendation {}

export interface SnakeCaseDoubanDetailsData {
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
  episode_length?: number;
  movie_duration?: number;
  first_aired?: string;
  plot_summary?: string;
  celebrities: SnakeCaseDoubanCelebrity[];
  recommendations: SnakeCaseDoubanRecommendation[];
  actors: SnakeCaseDoubanCelebrity[];
  backdrop?: string;
  trailerUrl?: string;
}

export interface SnakeCaseDoubanDetailsResponse {
  code: number;
  message: string;
  data?: SnakeCaseDoubanDetailsData;
}

function toSnakeCaseData(details: DoubanSubjectDetails): SnakeCaseDoubanDetailsData {
  return {
    id: details.id,
    title: details.title,
    poster: details.poster,
    rate: details.rate,
    year: details.year,
    directors: details.directors,
    screenwriters: details.screenwriters,
    cast: details.cast,
    genres: details.genres,
    countries: details.countries,
    languages: details.languages,
    episodes: details.episodes,
    episode_length: details.episodeLength,
    movie_duration: details.movieDuration,
    first_aired: details.firstAired,
    plot_summary: details.plotSummary,
    celebrities: details.celebrities,
    recommendations: details.recommendations,
    actors: details.actors,
    backdrop: details.backdrop,
    trailerUrl: details.trailerUrl,
  };
}

export function toSnakeCaseDetailsResponse(
  response: DoubanDetailsResponse,
): SnakeCaseDoubanDetailsResponse {
  return {
    code: response.code,
    message: response.message,
    data: response.data ? toSnakeCaseData(response.data) : undefined,
  };
}
