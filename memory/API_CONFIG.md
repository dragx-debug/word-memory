# API 配置说明

## 配置状态总览（2026-03-29）

| API | 状态 | 用途 | 免费额度 |
|-----|------|------|----------|
| 有道词典 API | ✅ 已配置 | 高质量中英翻译 | 每小时 1000 次 |
| NewsAPI | ✅ 已配置 | BBC/卫报真实新闻例句 | 每天 100 次 |
| Free Dictionary API | ✅ 无需配置 | 音标、英文释义 | 无限制 |
| MyMemory API | ✅ 自动备用 | 翻译例句 | 每天 1000 次 |
| Wordnik API | ⚠️ 测试 key | 更多例句 | 可能失效 |

---

## 1. 有道智云词典 API（已配置）

### 当前配置
```javascript
YOUDAO_CONFIG = {
    appKey: '045ae08c37f2f941',
    appSecret: '0d342IKOgr3ZWBgkNcUaqlk5ZLCN2tSe',
};
```

### 如需重新申请
1. 访问 https://ai.youdao.com/
2. 注册账号 → 创建应用 → 选择"文本翻译"
3. 替换上述配置即可

---

## 2. NewsAPI（已配置）

### 当前配置
```javascript
NEWS_API_CONFIG = {
    apiKey: 'fd57ba257a4d4ce4968143fd7796a03c',
    sources: 'bbc-news,the-guardian,national-geographic,cnn,time'
};
```

### 功能说明
- 从 **BBC News**、**The Guardian**、**National Geographic**、**CNN**、**Time** 获取真实新闻
- 搜索包含目标单词的近期新闻
- 提取真实句子作为例句
- 显示新闻来源，确保真实性

### 如需重新申请
1. 访问 https://newsapi.org/
2. 使用邮箱注册
3. 获取 API key 并替换上述配置

### 免费额度
- 每天 100 次请求
- 只能获取最近约 1 个月内的新闻

---

## 3. 其他 API（无需配置）

### Free Dictionary API
- 用途：获取单词音标、英文释义、基础例句
- 状态：直接使用，无需配置
- 限制：部分单词缺少例句

### MyMemory API
- 用途：翻译例句（有道 API 失败时自动降级）
- 状态：自动备用，无需配置
- 限制：每天约 1000 次请求

### Wordnik API
- 用途：获取更多真实例句
- 状态：内置测试 key，可能随时失效
- 注意：如果失效，系统会自动使用其他来源

---

## 故障排查

### 翻译不工作
1. 打开浏览器控制台（F12）
2. 查看错误信息
3. 常见原因：
   - 有道 API key 错误 → 检查 appKey 和 appSecret
   - 网络问题 → 系统会自动降级到 MyMemory API
   - 超过配额 → 等待下一小时或切换到备用 API

### NewsAPI 不返回例句
- 该单词近期可能没有相关新闻
- 免费版只能获取最近 1 个月的新闻
- 系统会自动降级使用其他例句来源

---

## 隐私说明
- 所有 API key 仅保存在您的本地文件中
- 不会被上传到任何服务器
- 翻译结果会缓存在浏览器 localStorage 中
- 缓存 key：`youdao_[句子]`、`mymemory_[句子]`、`news_[单词]`
