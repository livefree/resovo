import type {
  DoubanCelebrity,
  DoubanDetailsResponse,
  DoubanRecommendation,
} from './details.types.js';
import { normalizeSubjectId } from './details.helpers.js';
import { DoubanError } from './errors.js';

function extractLinkedNames(fragment: string): string[] {
  const links = fragment.match(/<a[^>]*>([^<]+)<\/a>/g);
  if (!links) {
    return [];
  }

  return links
    .map((link) => {
      const match = link.match(/>([^<]+)</);
      return match ? match[1].trim() : '';
    })
    .filter(Boolean);
}

function toSecureUrl(url: string): string {
  return url.replace(/^http:/, 'https:');
}

function toLargeAvatarUrl(url: string): string {
  return url
    .replace(/\/s\//, '/l/')
    .replace(/\/m\//, '/l/')
    .replace('/s_ratio/', '/l_ratio/')
    .replace('/m_ratio/', '/l_ratio/')
    .replace('/small/', '/large/')
    .replace('/medium/', '/large/');
}

function parseCelebrities(html: string): DoubanCelebrity[] {
  const celebrities: DoubanCelebrity[] = [];
  const celebritiesSection = html.match(
    /<div id="celebrities"[\s\S]*?<ul class="celebrities-list[^"]*">([\s\S]*?)<\/ul>/,
  );

  if (!celebritiesSection) {
    return celebrities;
  }

  const celebrityItems = celebritiesSection[1].match(
    /<li class="celebrity">[\s\S]*?<\/li>/g,
  );

  if (!celebrityItems) {
    return celebrities;
  }

  celebrityItems.forEach((item) => {
    const linkMatch = item.match(
      /<a href="https:\/\/www\.douban\.com\/(personage|celebrity)\/(\d+)\/[^"]*"\s+title="([^"]+)"/,
    );

    let avatarUrl = '';
    const bgMatch = item.match(/background-image:\s*url\(([^)]+)\)/);
    if (bgMatch) {
      avatarUrl = bgMatch[1].replace(/^['"]|['"]$/g, '');
    }

    if (!avatarUrl) {
      const imgMatch = item.match(/<img[^>]*src="([^"]+)"/);
      if (imgMatch) {
        avatarUrl = imgMatch[1];
      }
    }

    if (!avatarUrl) {
      const dataSrcMatch = item.match(/data-src="([^"]+)"/);
      if (dataSrcMatch) {
        avatarUrl = dataSrcMatch[1];
      }
    }

    const roleMatch = item.match(/<span class="role"[^>]*>([^<]+)<\/span>/);

    if (!linkMatch || !avatarUrl) {
      return;
    }

    avatarUrl = toSecureUrl(avatarUrl.trim());
    const isDefaultAvatar =
      avatarUrl.includes('personage-default') ||
      avatarUrl.includes('celebrity-default') ||
      avatarUrl.includes('has_douban');

    if (isDefaultAvatar) {
      return;
    }

    const largeUrl = toLargeAvatarUrl(avatarUrl);

    celebrities.push({
      id: linkMatch[2],
      name: linkMatch[3].split(' ')[0],
      avatar: avatarUrl,
      role: roleMatch ? roleMatch[1].trim() : '',
      avatars: {
        small: largeUrl
          .replace('/l/', '/s/')
          .replace('/l_ratio/', '/s_ratio/')
          .replace('/large/', '/small/'),
        medium: largeUrl
          .replace('/l/', '/m/')
          .replace('/l_ratio/', '/m_ratio/')
          .replace('/large/', '/medium/'),
        large: largeUrl,
      },
    });
  });

  return celebrities;
}

function parseRecommendations(html: string): DoubanRecommendation[] {
  const recommendations: DoubanRecommendation[] = [];
  const recommendationsSection = html.match(
    /<div id="recommendations">[\s\S]*?<div class="recommendations-bd">([\s\S]*?)<\/div>/,
  );

  if (!recommendationsSection) {
    return recommendations;
  }

  const recommendItems = recommendationsSection[1].match(/<dl>[\s\S]*?<\/dl>/g);
  if (!recommendItems) {
    return recommendations;
  }

  recommendItems.forEach((item) => {
    const idMatch = item.match(/\/subject\/(\d+)\//);
    const titleMatch = item.match(/alt="([^"]+)"/);
    const posterMatch = item.match(/<img src="([^"]+)"/);
    const rateMatch = item.match(/<span class="subject-rate">([^<]+)<\/span>/);

    if (!idMatch || !titleMatch || !posterMatch) {
      return;
    }

    recommendations.push({
      id: idMatch[1],
      title: titleMatch[1],
      poster: posterMatch[1],
      rate: rateMatch ? rateMatch[1] : '',
    });
  });

  return recommendations;
}

function parseBackdrop(html: string): string | undefined {
  const photosSection = html.match(
    /<div[^>]*id="related-pic"[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/,
  );

  if (!photosSection) {
    return undefined;
  }

  const photoMatch = photosSection[1].match(
    /https:\/\/img[0-9]\.doubanio\.com\/view\/photo\/[a-z_]*\/public\/p[0-9]+\.jpg/,
  );

  if (!photoMatch) {
    return undefined;
  }

  return photoMatch[0]
    .replace(/^http:/, 'https:')
    .replace('/view/photo/s/', '/view/photo/l/')
    .replace('/view/photo/m/', '/view/photo/l/')
    .replace('/view/photo/sqxs/', '/view/photo/l/');
}

export function parseDoubanDetailsHtml(
  html: string,
  subjectId: string,
): DoubanDetailsResponse {
  const normalizedId = normalizeSubjectId(subjectId);

  try {
    const titleMatch = html.match(
      /<h1[^>]*>[\s\S]*?<span[^>]*property="v:itemreviewed"[^>]*>([^<]+)<\/span>/,
    );
    const posterMatch = html.match(
      /<a[^>]*class="nbgnbg"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/,
    );
    const ratingMatch = html.match(
      /<strong[^>]*class="ll rating_num"[^>]*property="v:average">([^<]+)<\/strong>/,
    );
    const yearMatch = html.match(/<span[^>]*class="year">[(]([^)]+)[)]<\/span>/);

    const directorMatch = html.match(
      /<span class=['"]pl['"]>导演<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/,
    );
    const writerMatch = html.match(
      /<span class=['"]pl['"]>编剧<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/,
    );
    const castMatch = html.match(
      /<span class=['"]pl['"]>主演<\/span>:\s*<span class=['"]attrs['"]>(.*?)<\/span>/,
    );

    const genreMatches = html.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/g);
    const genres =
      genreMatches?.map((match) => {
        const result = match.match(/<span[^>]*property="v:genre">([^<]+)<\/span>/);
        return result ? result[1] : '';
      }).filter(Boolean) || [];

    const countryMatch = html.match(
      /<span[^>]*class="pl">制片国家\/地区:<\/span>([^<]+)/,
    );
    const languageMatch = html.match(/<span[^>]*class="pl">语言:<\/span>([^<]+)/);

    let firstAired = '';
    const firstAiredMatch = html.match(
      /<span class="pl">首播:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>([^<]*)<\/span>/,
    );
    if (firstAiredMatch) {
      firstAired = firstAiredMatch[1];
    } else {
      const releaseDateMatch = html.match(
        /<span class="pl">上映日期:<\/span>\s*<span[^>]*property="v:initialReleaseDate"[^>]*content="([^"]*)"[^>]*>([^<]*)<\/span>/,
      );
      if (releaseDateMatch) {
        firstAired = releaseDateMatch[1];
      }
    }

    const episodesMatch = html.match(/<span[^>]*class="pl">集数:<\/span>([^<]+)/);
    const singleEpisodeDurationMatch = html.match(
      /<span[^>]*class="pl">单集片长:<\/span>([^<]+)/,
    );
    const movieDurationMatch = html.match(/<span[^>]*class="pl">片长:<\/span>([^<]+)/);

    let episodeLength: number | undefined;
    let movieDuration: number | undefined;
    if (singleEpisodeDurationMatch) {
      episodeLength = parseInt(singleEpisodeDurationMatch[1].trim(), 10) || undefined;
    } else if (movieDurationMatch) {
      movieDuration = parseInt(movieDurationMatch[1].trim(), 10) || undefined;
    }

    const summaryMatch =
      html.match(/<span[^>]*class="all hidden">([\s\S]*?)<\/span>/) ||
      html.match(/<span[^>]*property="v:summary"[^>]*>([\s\S]*?)<\/span>/);
    let plotSummary = '';
    if (summaryMatch) {
      plotSummary = summaryMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
        .replace(/\n{3,}/g, '\n\n');
    }

    const celebrities = parseCelebrities(html);
    const recommendations = parseRecommendations(html);

    return {
      code: 200,
      message: '获取成功',
      data: {
        id: normalizedId,
        title: titleMatch ? titleMatch[1].trim() : '',
        poster: posterMatch ? toSecureUrl(posterMatch[1]) : '',
        rate: ratingMatch ? ratingMatch[1] : '',
        year: yearMatch ? yearMatch[1] : '',
        directors: directorMatch ? extractLinkedNames(directorMatch[1]) : [],
        screenwriters: writerMatch ? extractLinkedNames(writerMatch[1]) : [],
        cast: castMatch ? extractLinkedNames(castMatch[1]) : [],
        genres,
        countries: countryMatch
          ? countryMatch[1]
              .trim()
              .split('/')
              .map((country) => country.trim())
              .filter(Boolean)
          : [],
        languages: languageMatch
          ? languageMatch[1]
              .trim()
              .split('/')
              .map((language) => language.trim())
              .filter(Boolean)
          : [],
        episodes: episodesMatch
          ? parseInt(episodesMatch[1].trim(), 10) || undefined
          : undefined,
        episodeLength,
        movieDuration,
        firstAired,
        plotSummary,
        celebrities,
        recommendations,
        actors: celebrities.filter((celebrity) => !celebrity.role.includes('导演')),
        backdrop: parseBackdrop(html),
        trailerUrl: undefined,
      },
    };
  } catch (error) {
    throw new DoubanError(
      `Failed to parse Douban details HTML: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      'PARSE_ERROR',
    );
  }
}
