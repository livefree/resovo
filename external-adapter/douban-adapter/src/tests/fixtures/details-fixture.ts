export const MOVIE_SUBJECT_ID = '1292052';
export const TV_SUBJECT_ID = '35490175';
export const ANIME_SUBJECT_ID = '27140017';

export const CHALLENGE_HTML = `
<html>
  <body>
    <script>
      const sha512 = true;
      function process(cha) { return cha; }
    </script>
    <div>载入中</div>
  </body>
</html>
`;

export const MOVIE_DETAILS_HTML = `
<html>
  <body>
    <h1>
      <span property="v:itemreviewed">肖申克的救赎</span>
      <span class="year">(1994)</span>
    </h1>
    <a class="nbgnbg"><img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p480747492.jpg" /></a>
    <strong class="ll rating_num" property="v:average">9.7</strong>
    <div id="info">
      <span class="pl">导演</span>: <span class="attrs"><a href="#">弗兰克·德拉邦特</a></span><br/>
      <span class="pl">编剧</span>: <span class="attrs"><a href="#">弗兰克·德拉邦特</a> / <a href="#">斯蒂芬·金</a></span><br/>
      <span class="pl">主演</span>: <span class="attrs"><a href="#">蒂姆·罗宾斯</a> / <a href="#">摩根·弗里曼</a></span><br/>
      <span property="v:genre">剧情</span>
      <span property="v:genre">犯罪</span>
      <span class="pl">制片国家/地区:</span> 美国<br/>
      <span class="pl">语言:</span> 英语<br/>
      <span class="pl">上映日期:</span> <span property="v:initialReleaseDate" content="1994-09-10">1994-09-10</span><br/>
      <span class="pl">片长:</span> 142分钟<br/>
    </div>
    <span property="v:summary">20世纪40年代末，小有成就的银行家安迪因被控杀害妻子及其情人而蒙冤入狱。</span>
  </body>
</html>
`;

export const TV_DETAILS_HTML = `
<html>
  <body>
    <h1>
      <span property="v:itemreviewed">繁花</span>
      <span class="year">(2023)</span>
    </h1>
    <a class="nbgnbg"><img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2913554676.jpg" /></a>
    <strong class="ll rating_num" property="v:average">8.7</strong>
    <div id="info">
      <span class="pl">导演</span>: <span class="attrs"><a href="#">王家卫</a></span><br/>
      <span class="pl">编剧</span>: <span class="attrs"><a href="#">秦雯</a></span><br/>
      <span class="pl">主演</span>: <span class="attrs"><a href="#">胡歌</a> / <a href="#">马伊琍</a></span><br/>
      <span property="v:genre">剧情</span>
      <span property="v:genre">爱情</span>
      <span class="pl">制片国家/地区:</span> 中国大陆<br/>
      <span class="pl">语言:</span> 汉语普通话 / 沪语<br/>
      <span class="pl">首播:</span> <span property="v:initialReleaseDate" content="2023-12-27">2023-12-27</span><br/>
      <span class="pl">集数:</span> 30<br/>
      <span class="pl">单集片长:</span> 45分钟<br/>
    </div>
    <span property="v:summary">九十年代的上海，阿宝变成了宝总，故事围绕时代浪潮中的机会与选择展开。</span>
  </body>
</html>
`;

export const MOVIE_MOBILE_API_DATA = {
  id: MOVIE_SUBJECT_ID,
  title: '肖申克的救赎',
  year: '1994',
  is_tv: false,
  rating: { value: 9.7 },
  pic: {
    large: 'https://img1.doubanio.com/view/photo/l/public/p480747492.jpg',
    normal: 'https://img1.doubanio.com/view/photo/m/public/p480747492.jpg',
  },
  directors: [{ name: '弗兰克·德拉邦特' }],
  actors: [{ id: 'actor-movie', name: '蒂姆·罗宾斯', avatar: { small: '', normal: '', large: '' } }],
  genres: ['剧情', '犯罪'],
  countries: ['美国'],
  languages: ['英语'],
  durations: ['142分钟'],
  pubdate: ['1994-09-10'],
  intro: '20世纪40年代末，小有成就的银行家安迪因被控杀害妻子及其情人而蒙冤入狱。',
  trailers: [{ video_url: 'https://media.example.com/trailer.mp4' }],
};

export const TV_MOBILE_API_DATA = {
  id: TV_SUBJECT_ID,
  title: '繁花',
  year: '2023',
  is_tv: true,
  episodes_count: 30,
  episodes_info: '每集45分钟',
  rating: { value: 8.7 },
  pic: {
    large: 'https://img9.doubanio.com/view/photo/l/public/p2913554676.jpg',
    normal: 'https://img9.doubanio.com/view/photo/m/public/p2913554676.jpg',
  },
  directors: [{ name: '王家卫' }],
  actors: [{ id: 'actor-tv', name: '胡歌', avatar: { small: '', normal: '', large: '' } }],
  genres: ['剧情', '爱情'],
  countries: ['中国大陆'],
  languages: ['汉语普通话', '沪语'],
  durations: ['45分钟'],
  pubdate: ['2023-12-27'],
  intro: '九十年代的上海，阿宝变成了宝总，故事围绕时代浪潮中的机会与选择展开。',
  trailers: [{ video_url: 'https://media.example.com/blossoms-trailer.mp4' }],
};

export const ANIME_MOBILE_API_DATA = {
  id: ANIME_SUBJECT_ID,
  title: '葬送的芙莉莲',
  year: '2023',
  is_tv: true,
  episodes_count: 28,
  episodes_info: '每集24分钟',
  rating: { value: 9.5 },
  pic: {
    large: 'https://img2.doubanio.com/view/photo/l/public/p2899999999.jpg',
    normal: 'https://img2.doubanio.com/view/photo/m/public/p2899999999.jpg',
  },
  directors: [{ name: '斋藤圭一郎' }],
  actors: [{ id: 'actor-anime', name: '种崎敦美', avatar: { small: '', normal: '', large: '' } }],
  genres: ['动画', '奇幻', '冒险'],
  countries: ['日本'],
  languages: ['日语'],
  durations: ['24分钟'],
  pubdate: ['2023-09-29'],
  intro: '打倒魔王之后，精灵魔法使芙莉莲重新踏上理解人与时间的旅程。',
  trailers: [{ video_url: 'https://media.example.com/frieren-trailer.mp4' }],
};

export const SUBJECT_SEARCH_HTML = `
<html>
  <body>
    <script>
      window.__DATA__ = {
        "items": [
          {
            "id": "30444960",
            "title": "繁花",
            "original_title": "Blossoms Shanghai",
            "target_type": "tv",
            "url": "https://movie.douban.com/subject/30444960/",
            "cover_url": "https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2913554676.jpg",
            "rating": { "value": 8.7 },
            "abstract": "2023 / 中国大陆 / 电视剧 / 王家卫 / 胡歌 马伊琍"
          },
          {
            "id": "36221383",
            "title": "繁花",
            "original_title": "Blossoms",
            "target_type": "movie",
            "url": "https://movie.douban.com/subject/36221383/",
            "cover_url": "https://img2.doubanio.com/view/photo/s_ratio_poster/public/p0000000001.jpg",
            "rating": { "value": 6.2 },
            "abstract": "2024 / 中国大陆 / 电影 / 张三 / 李四 王五"
          },
          {
            "id": "1292052",
            "title": "肖申克的救赎",
            "original_title": "The Shawshank Redemption",
            "target_type": "movie",
            "url": "https://movie.douban.com/subject/1292052/",
            "cover_url": "https://img1.doubanio.com/view/photo/s_ratio_poster/public/p480747492.jpg",
            "rating": { "value": 9.7 },
            "abstract": "1994 / 美国 / 电影 / 弗兰克·德拉邦特 / 蒂姆·罗宾斯 摩根·弗里曼"
          }
        ]
      };
    </script>
  </body>
</html>
`;

export const COMMENTS_HTML = `
<html>
  <body>
    <div class="comment-item">
      <div class="avatar">
        <img src="http://img1.doubanio.com/icon/u1000001-1.jpg" />
      </div>
      <span class="comment-info">
        <a href="https://www.douban.com/people/cookieuser/">影迷甲</a>
        <span class="allstar50 rating" title="力荐"></span>
        <span class="comment-time" title="2024-01-03 09:30:00"></span>
        <span class="comment-location">北京</span>
      </span>
      <span class="short">第一条短评<br/>换行内容</span>
      <span class="votes vote-count">128</span>
    </div>
    <div class="comment-item">
      <div class="avatar">
        <img src="https://img2.doubanio.com/icon/u1000002-2.jpg" />
      </div>
      <span class="comment-info">
        <a href="https://www.douban.com/people/another-user/">影迷乙</a>
        <span class="allstar40 rating" title="推荐"></span>
        <span class="comment-time" title="2024-01-02 11:00:00"></span>
      </span>
      <span class="short">第二条短评</span>
      <span class="votes vote-count">7</span>
    </div>
    <div id="paginator"></div>
  </body>
</html>
`;

export const RECOMMENDATIONS_API_DATA = {
  items: [
    {
      id: '1295644',
      title: '这个杀手不太冷',
      year: '1994',
      type: 'movie',
      pic: {
        large: 'https://img3.doubanio.com/view/photo/l/public/p511118051.jpg',
        normal: 'https://img3.doubanio.com/view/photo/m/public/p511118051.jpg',
      },
      rating: { value: 9.4 },
    },
    {
      id: '1292720',
      title: '阿甘正传',
      year: '1994',
      type: 'movie',
      pic: {
        large: 'https://img9.doubanio.com/view/photo/l/public/p2372307693.jpg',
        normal: 'https://img9.doubanio.com/view/photo/m/public/p2372307693.jpg',
      },
      rating: { value: 9.5 },
    },
    {
      id: 'x-book',
      title: '无关图书',
      year: '2024',
      type: 'book',
      pic: {
        large: 'https://img.example.com/book-large.jpg',
        normal: 'https://img.example.com/book-normal.jpg',
      },
      rating: { value: 7.1 },
    },
  ],
};

export const CELEBRITY_WORKS_SEARCH_HTML = `
<html>
  <body>
    <div class="result">
      <a class="title-link" href="https://www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F27119724%2F">
        <span class="title-text">漫长的季节</span>
      </a>
      <img src="https://img1.doubanio.com/view/photo/s_ratio_poster/public/p2889999999.jpg" />
      <span class="rating_nums">9.4</span>
      <span class="subject-cast">原名:漫长的季节 / 辛爽 / 范伟 / 2023</span>
    </div>
    <div class="result">
      <a class="title-link" href="https://www.douban.com/link2/?url=https%3A%2F%2Fmovie.douban.com%2Fsubject%2F35490175%2F">
        <span class="title-text">繁花</span>
      </a>
      <img src="https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2913554676.jpg" />
      <span class="rating_nums">8.7</span>
      <span class="subject-cast">原名:繁花 / 王家卫 / 胡歌 / 2023</span>
    </div>
  </body>
</html>
`;

export const CELEBRITY_WORKS_API_DATA = {
  subjects: [
    {
      id: '1295644',
      title: '这个杀手不太冷',
      cover: 'https://img3.doubanio.com/view/photo/s_ratio_poster/public/p511118051.jpg',
      rate: '9.4',
      url: 'https://movie.douban.com/subject/1295644/',
    },
    {
      id: '1292720',
      title: '阿甘正传',
      cover: 'https://img9.doubanio.com/view/photo/s_ratio_poster/public/p2372307693.jpg',
      rate: '9.5',
      url: 'https://movie.douban.com/subject/1292720/',
    },
  ],
};
