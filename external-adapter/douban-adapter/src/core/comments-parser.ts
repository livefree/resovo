import type { DoubanComment } from './comments.types.js';

export function parseDoubanCommentsHtml(html: string): DoubanComment[] {
  const comments: DoubanComment[] = [];
  const commentItemRegex =
    /<div class="comment-item"[^>]*>([\s\S]*?)(?=<div class="comment-item"|<div id="paginator"|$)/g;

  let match: RegExpExecArray | null;
  while ((match = commentItemRegex.exec(html)) !== null) {
    const item = match[0];

    const userLinkMatch = item.match(
      /<span class="comment-info">[\s\S]*?<a href="https:\/\/www\.douban\.com\/people\/([^/]+)\/">([^<]+)<\/a>/,
    );
    const username = userLinkMatch ? userLinkMatch[2].trim() : '';
    const userId = userLinkMatch ? userLinkMatch[1] : '';

    const avatarMatch = item.match(
      /<div class="avatar">[\s\S]*?<img src="([^"]+)"/,
    );
    const avatar = avatarMatch ? avatarMatch[1].replace(/^http:/, 'https:') : '';

    const ratingMatch = item.match(/<span class="allstar(\d)0 rating"/);
    const rating = ratingMatch ? parseInt(ratingMatch[1], 10) : 0;

    const timeMatch = item.match(/<span class="comment-time"[^>]*title="([^"]+)"/);
    const time = timeMatch ? timeMatch[1] : '';

    const locationMatch = item.match(
      /<span class="comment-location">([^<]+)<\/span>/,
    );
    const location = locationMatch ? locationMatch[1].trim() : '';

    const contentMatch = item.match(/<span class="short">([\s\S]*?)<\/span>/);
    const content = contentMatch
      ? contentMatch[1]
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim()
      : '';

    const usefulMatch = item.match(/<span class="votes vote-count">(\d+)<\/span>/);
    const usefulCount = usefulMatch ? parseInt(usefulMatch[1], 10) : 0;

    if (username && content) {
      comments.push({
        username,
        userId,
        avatar,
        rating,
        time,
        location,
        content,
        usefulCount,
      });
    }
  }

  return comments;
}
