export const CONFIG_FILE_PLACEHOLDER = JSON.stringify(
  {
    crawler_sites: {
      example: {
        name: '示例资源站',
        api: 'https://api.example.com/api.php/provide/vod',
        detail: '可选备注',
        type: 'vod',
        format: 'json',
        weight: 50,
        is_adult: false,
      },
    },
  },
  null,
  2,
)
