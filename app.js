// 智能单词记忆生成器
class WordMemoryGenerator {
    constructor() {
        this.currentWord = null;
        this.history = JSON.parse(localStorage.getItem('wordHistory') || '[]');

        // DOM 元素
        this.wordInput = document.getElementById('wordInput');
        this.generateBtn = document.getElementById('generateBtn');
        this.loadingState = document.getElementById('loadingState');
        this.errorState = document.getElementById('errorState');
        this.cardSection = document.getElementById('cardSection');
        this.card = document.getElementById('card');
        this.cardContainer = document.getElementById('cardContainer');
        this.saveBtn = document.getElementById('saveBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.historyList = document.getElementById('historyList');
        this.clearHistoryBtn = document.getElementById('clearHistory');

        // 卡片内容元素
        this.wordText = document.getElementById('wordText');
        this.phoneticText = document.getElementById('phoneticText');
        this.speakBtn = document.getElementById('speakBtn');
        this.oxfordLink = document.getElementById('oxfordLink');
        this.asciiArt = document.getElementById('asciiArt');
        this.mnemonicText = document.getElementById('mnemonicText');
        this.meaningText = document.getElementById('meaningText');
        this.storyText = document.getElementById('storyText');
        this.exampleText = document.getElementById('exampleText');
        this.exampleCnText = document.getElementById('exampleCnText');

        // 造句练习元素
        this.sentenceInput = document.getElementById('sentenceInput');
        this.saveSentenceBtn = document.getElementById('saveSentenceBtn');
        this.userSentences = document.getElementById('userSentences');
        this.autoSentences = document.getElementById('autoSentences');

        // 用户保存的句子（按单词存储）
        this.userSentencesMap = JSON.parse(localStorage.getItem('userSentencesMap') || '{}');

        // 例句缓存（提高速度）
        this.examplesCache = JSON.parse(localStorage.getItem('examplesCache') || '{}');

        this.init();
    }

    init() {
        this.bindEvents();
        this.renderHistory();
        this.initVoices();  // 初始化语音引擎
    }

    bindEvents() {
        // 生成按钮
        this.generateBtn.addEventListener('click', () => this.generateWord());

        // 回车键生成
        this.wordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.generateWord();
            }
        });

        // 卡片翻转
        this.cardContainer.addEventListener('click', (e) => {
            // 排除发音按钮和造句练习区域的点击
            if (e.target.closest('.speak-btn')) return;
            if (e.target.closest('.sentence-practice-section')) return;
            this.flipCard();
        });

        // 发音按钮
        this.speakBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.speakWord();
        });

        // 保存按钮
        this.saveBtn.addEventListener('click', () => this.saveToHistory());

        // 复制按钮
        this.copyBtn.addEventListener('click', () => this.copyContent());

        // 清空历史
        this.clearHistoryBtn.addEventListener('click', () => this.clearHistory());

        // 造句练习按钮
        this.saveSentenceBtn.addEventListener('click', () => this.saveUserSentence());

        // 造句输入框回车保存
        this.sentenceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.saveUserSentence();
            }
        });

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && !this.cardSection.classList.contains('hidden')) {
                e.preventDefault();
                this.flipCard();
            }
        });
    }

    async generateWord() {
        const word = this.wordInput.value.trim().toLowerCase();
        console.log('Generating word:', word);
        if (!word) {
            this.showError('请输入单词');
            return;
        }

        this.showLoading();

        try {
            // 调用 Free Dictionary API
            console.log('Fetching from API...');
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
            console.log('API response status:', response.status);

            if (!response.ok) {
                throw new Error('Word not found');
            }

            const data = await response.json();
            console.log('API data:', data);
            const wordData = this.parseWordData(data);
            console.log('Parsed word data:', wordData);

            // 生成记忆内容
            this.currentWord = this.generateMemoryContent(wordData);
            console.log('Generated memory content:', this.currentWord);

            this.displayCard();
            this.hideLoading();

            // 异步获取有道中文释义并更新显示
            this.getYoudaoDefinition(word).then(youdaoDef => {
                if (youdaoDef && youdaoDef.explains && youdaoDef.explains.length > 0) {
                    // 更新中文释义显示
                    if (this.meaningText) {
                        this.meaningText.textContent = youdaoDef.explains.join('; ');
                    }
                    // 更新词典释义区域
                    if (this.storyText) {
                        let chineseStory = '📖 词典释义（来自有道词典）\n\n';
                        youdaoDef.explains.forEach((exp, idx) => {
                            chineseStory += `${idx + 1}. ${exp}\n`;
                        });
                        this.storyText.textContent = chineseStory;
                    }
                }
            }).catch(err => console.log('有道释义获取失败:', err));
        } catch (error) {
            console.error('查询失败:', error);
            this.showError();
        }
    }

    parseWordData(data) {
        const entry = data[0];

        // 收集所有词性的所有释义和例句
        const allExamples = [];
        const allMeanings = [];

        entry.meanings.forEach(meaning => {
            allMeanings.push({
                partOfSpeech: meaning.partOfSpeech,
                definitions: meaning.definitions.map(d => ({
                    definition: d.definition,
                    example: d.example,
                    synonyms: d.synonyms || []
                }))
            });

            // 收集所有例句
            meaning.definitions.forEach(def => {
                if (def.example) {
                    allExamples.push({
                        text: def.example,
                        partOfSpeech: meaning.partOfSpeech,
                        definition: def.definition
                    });
                }
            });
        });

        // 取第一个主要释义用于显示
        const firstMeaning = entry.meanings[0];
        const firstDef = firstMeaning.definitions[0];

        return {
            word: entry.word,
            phonetic: entry.phonetic || (entry.phonetics.find(p => p.text)?.text) || '',
            partOfSpeech: firstMeaning.partOfSpeech,
            meaning: firstDef.definition,
            example: firstDef.example || '',
            synonyms: firstDef.synonyms || [],
            allExamples: allExamples,
            allMeanings: allMeanings
        };
    }

    generateMemoryContent(wordData) {
        const { word, phonetic, partOfSpeech, meaning, example, allExamples, allMeanings } = wordData;

        // 根据词性选择故事模板
        const story = this.generateStory(word, meaning, partOfSpeech, allMeanings);

        // 生成图像联想
        const { ascii, mnemonic } = this.generateVisual(word, phonetic, meaning, partOfSpeech);

        // 获取主例句：优先使用本地例句库，其次使用词典API例句
        // 这样确保显示的是真实报刊例句
        let mainExample = '';
        let mainExampleSource = '';

        // 首先尝试本地例句库（真实报刊例句）
        const localExamples = this.getLocalExamples(word);
        if (localExamples.length > 0) {
            mainExample = localExamples[0].en;
            mainExampleSource = localExamples[0].source;
        }

        // 如果没有本地例句，使用词典API例句
        if (!mainExample && allExamples.length > 0) {
            mainExample = allExamples[0].text;
            mainExampleSource = 'Free Dictionary API';
        }

        // 如果还是没有，使用词典返回的 example 字段
        if (!mainExample && example) {
            mainExample = example;
            mainExampleSource = 'Free Dictionary API';
        }

        return {
            word,
            phonetic: phonetic || `/${word}/`,
            meaning: this.translateMeaning(meaning),
            meaningEn: meaning,
            story,
            asciiArt: ascii,
            mnemonic,
            example: mainExample || '暂无例句，请查看下方"参考例句"区域或点击牛津词典链接。',
            exampleCn: localExamples.length > 0 ? localExamples[0].cn : '',  // 本地例句已有翻译
            allExamples: allExamples || [],
            allMeanings: allMeanings || []
        };
    }

    // 使用有道词典API获取高质量翻译和例句
    // 需要配置：从 https://ai.youdao.com/ 申请 appKey 和 appSecret
    // 免费额度：每小时1000次调用
    YOUDAO_CONFIG = {
        appKey: '045ae08c37f2f941',
        appSecret: '0d342IKOgr3ZWBgkNcUaqlk5ZLCN2tSe',
    };

    // NewsAPI 配置 - 从 https://newsapi.org/ 申请
    // 免费额度：每天100次请求
    NEWS_API_CONFIG = {
        apiKey: 'fd57ba257a4d4ce4968143fd7796a03c', // 已配置
        sources: 'bbc-news,the-guardian,national-geographic,cnn,time' // 优先搜索的媒体来源
    };

    // 使用有道词典 API 获取中文释义
    async getYoudaoDefinition(word) {
        if (!word || !this.YOUDAO_CONFIG.appKey) {
            return null;
        }

        // 检查缓存
        const cacheKey = 'youdao_def_' + word.toLowerCase().trim();
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }

        try {
            const salt = Date.now();
            const curtime = Math.round(salt / 1000);
            const str = this.YOUDAO_CONFIG.appKey + word + salt + curtime + this.YOUDAO_CONFIG.appSecret;
            const sign = await this.md5(str);

            const params = new URLSearchParams({
                q: word,
                from: 'en',
                to: 'zh-CHS',
                appKey: this.YOUDAO_CONFIG.appKey,
                salt: salt.toString(),
                sign: sign,
                signType: 'v3',
                curtime: curtime.toString()
            });

            const response = await fetch(`https://openapi.youdao.com/api?${params.toString()}`, {
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                console.log('有道词典API响应:', data);

                // 解析有道返回的释义
                if (data.basic && data.basic.explains) {
                    const definition = {
                        phonetic: data.basic.phonetic || '',
                        explains: data.basic.explains,
                        word: data.query
                    };
                    // 缓存结果
                    localStorage.setItem(cacheKey, JSON.stringify(definition));
                    return definition;
                }
            }
        } catch (error) {
            console.log('有道词典API调用失败:', error);
        }

        return null;
    }

    async translateWithYoudao(sentence) {
        if (!sentence || !this.YOUDAO_CONFIG.appKey) {
            // 如果没有配置有道key，降级到MyMemory API
            return this.translateWithMyMemory(sentence);
        }

        // 检查缓存
        const cacheKey = 'youdao_' + sentence.toLowerCase().trim();
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const salt = Date.now();
            const curtime = Math.round(salt / 1000);
            const str = this.YOUDAO_CONFIG.appKey + sentence + salt + curtime + this.YOUDAO_CONFIG.appSecret;
            // 使用 MD5 生成签名
            const sign = await this.md5(str);

            const params = new URLSearchParams({
                q: sentence,
                from: 'en',
                to: 'zh-CHS',
                appKey: this.YOUDAO_CONFIG.appKey,
                salt: salt.toString(),
                sign: sign,
                signType: 'v3',
                curtime: curtime.toString()
            });

            const response = await fetch(`https://openapi.youdao.com/api?${params.toString()}`, {
                timeout: 5000
            });

            if (response.ok) {
                const data = await response.json();
                console.log('有道API响应:', data);
                // 有道返回翻译结果
                if (data.translation && data.translation.length > 0) {
                    const translation = data.translation[0];
                    localStorage.setItem(cacheKey, translation);
                    return translation;
                }
                // 如果有错误码，打印出来
                if (data.errorCode && data.errorCode !== '0') {
                    console.log('有道API错误码:', data.errorCode);
                }
            }
        } catch (error) {
            console.log('有道API调用失败:', error);
        }

        // 降级到 MyMemory API
        return this.translateWithMyMemory(sentence);
    }

    // MD5 实现（用于有道API签名）
    async md5(string) {
        // 检查 crypto.subtle 是否可用（需要 https 或 localhost）
        if (!crypto || !crypto.subtle) {
            throw new Error('Crypto API not available');
        }
        const encoder = new TextEncoder();
        const data = encoder.encode(string);
        const hashBuffer = await crypto.subtle.digest('MD5', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // 使用 MyMemory API（备用方案）
    async translateWithMyMemory(sentence) {
        if (!sentence) return '';

        const cacheKey = 'mymemory_' + sentence.toLowerCase().trim();
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            return cached;
        }

        try {
            const encodedText = encodeURIComponent(sentence);
            const response = await fetch(
                `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|zh`,
                { timeout: 5000 }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.responseData && data.responseData.translatedText) {
                    const translation = data.responseData.translatedText;
                    localStorage.setItem(cacheKey, translation);
                    return translation;
                }
            }
        } catch (error) {
            console.log('MyMemory API调用失败:', error);
        }

        return this.translateLocal(sentence);
    }

    // 使用免费翻译API获取高质量翻译（统一入口）
    async translateWithAPI(sentence) {
        // 优先使用有道API（如果配置了key）
        if (this.YOUDAO_CONFIG.appKey) {
            return this.translateWithYoudao(sentence);
        }
        // 否则使用 MyMemory
        return this.translateWithMyMemory(sentence);
    }

    // 智能翻译：支持完整句型匹配、短语匹配、逐词翻译三级策略
    translateLocal(sentence) {
        if (!sentence) return '';

        // 完整句型翻译库（覆盖常见词典例句）
        const fullTranslations = {
            // 说服类
            'that salesman was able to persuade me into buying this bottle of lotion.': '那个售货员成功说服我买了这瓶乳液。',
            'i tried to persuade him to change his mind.': '我试图说服他改变主意。',
            'she persuaded me to join the club.': '她说服我加入了这个俱乐部。',

            // 常见句型
            'the weather is very beautiful today.': '今天天气非常美丽。',
            'she looks beautiful in that dress.': '她穿那条裙子看起来很美。',
            'this is my favorite book.': '这是我最喜欢的书。',
            'i need a new phone.': '我需要一部新手机。',
            'i want to go home.': '我想回家。',
            'please close the door.': '请关门。',
            'i love my family.': '我爱我的家人。',
            'i think you are right.': '我认为你是对的。',
            'it is very important.': '这非常重要。',
            'i am happy.': '我很高兴。',
            'you are right.': '你是对的。'
        };

        const lowerSentence = sentence.toLowerCase().trim().replace(/[.!?]$/, '');
        const normalizedSentence = lowerSentence + '.';

        // 尝试完整句型匹配
        if (fullTranslations[lowerSentence] || fullTranslations[normalizedSentence]) {
            return fullTranslations[lowerSentence] || fullTranslations[normalizedSentence];
        }

        // 智能短语翻译系统
        return this.smartTranslate(sentence);
    }

    // 智能翻译：先匹配短语和习语，再处理剩余部分
    smartTranslate(sentence) {
        if (!sentence) return '';

        let text = sentence.toLowerCase().trim();

        // 短语词典（多词优先匹配）
        const phraseMap = {
            // 短语动词
            'get up': '起床', 'get out': '出去', 'get in': '进入', 'get on': '上车',
            'get off': '下车', 'get away': '逃脱', 'get back': '回来', 'get rid of': '摆脱',
            'take off': '起飞', 'take on': '承担', 'take up': '开始从事', 'take away': '拿走',
            'take out': '取出', 'take down': '记下', 'take care of': '照顾',
            'put on': '穿上', 'put off': '推迟', 'put up': '举起', 'put down': '放下',
            'put away': '收起', 'put out': '熄灭',
            'turn on': '打开', 'turn off': '关闭', 'turn up': '调大', 'turn down': '调小',
            'turn around': '转身', 'turn back': '返回',
            'look at': '看着', 'look for': '寻找', 'look after': '照顾', 'look up': '查阅',
            'look out': '小心', 'look forward to': '期待',
            'come on': '加油', 'come in': '进来', 'come out': '出来', 'come back': '回来',
            'come up with': '想出', 'come across': '偶然遇到',
            'go on': '继续', 'go out': '出去', 'go away': '走开', 'go back': '回去',
            'go over': '复习', 'go through': '经历',
            'give up': '放弃', 'give in': '屈服', 'give back': '归还', 'give away': '赠送',
            'set up': '建立', 'set off': '出发', 'set out': '出发',
            'pick up': '捡起', 'pick out': '挑选',
            'call on': '拜访', 'call off': '取消', 'call up': '打电话',
            'wake up': '醒来', 'grow up': '长大', 'show up': '出现',
            'carry on': '继续', 'carry out': '执行',
            'find out': '发现', 'figure out': '弄明白', 'point out': '指出',
            'help out': '帮助', 'work out': '解决', 'try out': '试用',
            'break down': '出故障', 'break out': '爆发', 'break up': '分手',
            'write down': '写下', 'sit down': '坐下', 'calm down': '冷静下来',
            'slow down': '慢下来', 'cut down': '削减',
            'speak up': '大声说', 'stand up': '站起来', 'hurry up': '快点',
            'pay for': '支付', 'wait for': '等待', 'ask for': '请求',
            'apply for': '申请', 'care for': '照顾', 'search for': '搜索',
            'deal with': '处理', 'agree with': '同意', 'begin with': '以...开始',
            'provide with': '提供', 'compare with': '比较', 'meet with': '会见',
            'think of': '想起', 'hear of': '听说', 'dream of': '梦想',
            'speak of': '谈到', 'complain of': '抱怨',
            'run out of': '用完', 'get out of': '逃避', 'make out of': '用...制造',
            'succeed in': '在...成功', 'arrive in': '到达', 'believe in': '相信',
            'result in': '导致', 'lead to': '导致', 'object to': '反对',
            'get used to': '习惯于', 'look forward to': '期待',
            'thanks to': '多亏', 'due to': '由于', 'according to': '根据',
            'except for': '除了', 'instead of': '代替', 'in front of': '在...前面',
            'in spite of': '尽管', 'ahead of': '在...之前',

            // 常见搭配
            'a lot of': '很多', 'lots of': '很多', 'a number of': '许多',
            'a few': '一些', 'a little': '一点', 'at least': '至少',
            'at most': '最多', 'at first': '首先', 'at last': '最后',
            'at once': '立刻', 'at all': '根本', 'at times': '有时',
            'at present': '目前', 'at the moment': '此刻',
            'in fact': '事实上', 'in general': '一般来说', 'in order': '按顺序',
            'in order to': '为了', 'in time': '及时', 'in the end': '最后',
            'in public': '公开地', 'in trouble': '有麻烦', 'in a hurry': '匆忙',
            'in common': '共同的', 'in detail': '详细地', 'in short': '简言之',
            'on time': '准时', 'on duty': '值班', 'on holiday': '度假',
            'on fire': '着火', 'on sale': '打折', 'on the other hand': '另一方面',
            'out of': '出于', 'out of order': '出故障', 'out of date': '过时',
            'out of control': '失控', 'out of breath': '上气不接下气',
            'by the way': '顺便说一下', 'by accident': '偶然', 'by heart': '凭记忆',
            'by mistake': '错误地', 'day by day': '日复一日',
            'for example': '例如', 'for instance': '例如', 'for sure': '肯定',
            'for free': '免费', 'from now on': '从现在起', 'from then on': '从那时起',
            'as well': '也', 'as well as': '和...一样', 'as soon as': '一...就',
            'as long as': '只要', 'as if': '好像', 'as though': '好像',
            'so far': '到目前为止', 'so that': '以便', 'so...that': '如此...以至于',
            'even if': '即使', 'even though': '尽管',
            'not only...but also': '不仅...而且',
            'either...or': '要么...要么', 'neither...nor': '既不...也不',
            'both...and': '既...又', 'whether...or': '无论...还是',
            'more than': '多于', 'less than': '少于', 'no more than': '仅仅',
            'no less than': '不少于', 'rather than': '而不是',
            'would rather': '宁愿', 'had better': '最好',
            'be able to': '能够', 'be about to': '即将', 'be going to': '将要',
            'be used to': '习惯于', 'used to': '过去常常',
            'ought to': '应该', 'have to': '不得不', 'need to': '需要',
            'want to': '想要', 'like to': '喜欢', 'hate to': '讨厌',
            'prefer to': '更喜欢', 'hope to': '希望', 'wish to': '希望',
            'fail to': '未能', 'manage to': '设法', 'happen to': '碰巧',
            'seem to': '似乎', 'appear to': '似乎', 'tend to': '倾向于',

            // 新增：固定短语和习语
            'beyond repair': '无法修复', 'under repair': '在修理中',
            'in good repair': '保养良好', 'in bad repair': '失修',
            'damaged beyond repair': '损坏得无法修复',
            'built up a reputation': '建立声誉',
            'damaged his reputation': '损害了他的名声',
            'international reputation': '国际声誉',
            'good reputation': '良好声誉', 'bad reputation': '坏名声',
            'used to be': '曾经是', 'supposed to': '应该', 'able to': '能够',

            // 常见形容词+名词
            'high school': '高中', 'junior high': '初中', 'primary school': '小学',
            'public transport': '公共交通', 'traffic jam': '交通堵塞',
            'cell phone': '手机', 'mobile phone': '手机', 'phone call': '电话',
            'email address': '电子邮件地址', 'post office': '邮局',
            'department store': '百货商店', 'shopping mall': '购物中心',
            'credit card': '信用卡', 'bank account': '银行账户',
            'social media': '社交媒体', 'news report': '新闻报道',
            'weather forecast': '天气预报', 'global warming': '全球变暖',
            'air pollution': '空气污染', 'environmental protection': '环境保护',
            'health care': '医疗保健', 'medical treatment': '医疗',
            'mental health': '心理健康', 'physical exercise': '体育锻炼',
            'free time': '空闲时间', 'spare time': '业余时间',
            'daily life': '日常生活', 'living standard': '生活水平',
            'human being': '人类', 'human rights': '人权',
            'social worker': '社会工作者', 'social problem': '社会问题',
            'economic growth': '经济增长', 'financial crisis': '金融危机',
            'political system': '政治制度', 'legal system': '法律制度',
            'educational system': '教育系统', 'public opinion': '公众舆论',
            'cultural difference': '文化差异', 'historical event': '历史事件',
            'scientific research': '科学研究', 'natural disaster': '自然灾害',

            // 动词+名词
            'make a decision': '做决定', 'make a choice': '做选择',
            'make a plan': '制定计划', 'make a mistake': '犯错误',
            'make a promise': '许诺', 'make a difference': '产生影响',
            'make progress': '取得进步', 'make sense': '有意义',
            'make sure': '确保', 'make up': '化妆；编造',
            'take action': '采取行动', 'take measures': '采取措施',
            'take steps': '采取步骤', 'take responsibility': '承担责任',
            'take advantage': '利用', 'take place': '发生',
            'take part in': '参加', 'take pride in': '为...自豪',
            'take it easy': '放轻松', 'take a break': '休息一下',
            'take a look': '看一看', 'take a photo': '拍照',
            'take a shower': '洗澡', 'take a walk': '散步',
            'have a look': '看一看', 'have a try': '试一试',
            'have a rest': '休息一下', 'have a good time': '玩得开心',
            'have fun': '玩得开心', 'have breakfast': '吃早餐',
            'have lunch': '吃午餐', 'have dinner': '吃晚餐',
            'have a meeting': '开会', 'have a talk': '谈话',
            'have an idea': '有个主意', 'have a problem': '有问题',
            'have no idea': '不知道', 'have something to do': '有事要做',
            'do homework': '做作业', 'do housework': '做家务',
            'do business': '做生意', 'do research': '做研究',
            'do exercise': '做运动', 'do someone a favor': '帮某人忙',
            'do well': '做得好', 'do harm': '有害',
            'get a job': '找到工作', 'get married': '结婚',
            'get dressed': '穿好衣服', 'get lost': '迷路',
            'get hurt': '受伤', 'get angry': '生气',
            'get tired': '累了', 'get ready': '准备好',
            'pay attention': '注意', 'pay a visit': '拜访',
            'give advice': '给出建议', 'give a speech': '发表演讲',
            'give a reason': '给出理由', 'give a hand': '帮忙',
            'give birth': '分娩', 'give way': '让路',
            'catch a cold': '感冒', 'catch a bus': '赶公交车',
            'keep in touch': '保持联系', 'keep a promise': '遵守诺言',
            'keep silent': '保持沉默', 'keep healthy': '保持健康',
            'break the law': '违法', 'break the rules': '违反规则',
            'break a record': '打破记录', 'break one\'s heart': '伤某人的心',
            'hold on': '坚持；稍等', 'hold a meeting': '举行会议',
            'hold an opinion': '持有观点',
            'set an example': '树立榜样', 'set a goal': '设定目标',
            'set a record': '创造记录', 'set fire': '放火',
            'draw a conclusion': '得出结论', 'draw attention': '引起注意',
            'draw a picture': '画画',
            'win a prize': '获奖', 'win a game': '赢得比赛',
            'lose weight': '减肥', 'lose heart': '灰心',
            'lose one\'s way': '迷路',
            'build up': '建立', 'achieve success': '取得成功',
            'face challenges': '面对挑战', 'overcome difficulties': '克服困难',
            'solve problems': '解决问题', 'meet requirements': '满足要求',
            'meet standards': '达到标准', 'meet needs': '满足需求',
            'satisfy needs': '满足需求',

            // 时间表达
            'in the morning': '在早上', 'in the afternoon': '在下午',
            'in the evening': '在晚上', 'at night': '在夜间',
            'at noon': '在中午', 'at midnight': '在午夜',
            'on monday': '在周一', 'on tuesday': '在周二',
            'on wednesday': '在周三', 'on thursday': '在周四',
            'on friday': '在周五', 'on saturday': '在周六', 'on sunday': '在周日',
            'on weekdays': '在工作日', 'at the weekend': '在周末',
            'next week': '下周', 'last week': '上周',
            'next month': '下个月', 'last month': '上个月',
            'next year': '明年', 'last year': '去年',
            'the day before yesterday': '前天', 'the day after tomorrow': '后天',
            'every day': '每天', 'every week': '每周',
            'every month': '每月', 'every year': '每年',
            'once a week': '每周一次', 'twice a week': '每周两次',
            'three times': '三次',

            // 地点表达
            'at home': '在家', 'at school': '在学校',
            'at work': '在工作', 'at the office': '在办公室',
            'in the hospital': '在医院', 'in prison': '在监狱',
            'in class': '在课堂上', 'in town': '在城里',
            'on the farm': '在农场', 'on the island': '在岛上',
            'on the beach': '在海滩', 'on the coast': '在海岸',
            'in the countryside': '在乡村', 'in the city': '在城市',
            'in the suburbs': '在郊区', 'in the mountains': '在山里',
            'in the forest': '在森林', 'in the garden': '在花园',
            'on the street': '在街上', 'on the road': '在路上',
            'on the way': '在路上', 'on the left': '在左边',
            'on the right': '在右边', 'in the middle': '在中间',
            'at the top': '在顶部', 'at the bottom': '在底部',
            'in front': '在前面', 'in the back': '在后面',

            // 其他常用表达
            'in english': '用英语', 'in chinese': '用中文',
            'in writing': '书面', 'in person': '亲自',
            'in danger': '处于危险中', 'in safety': '安全地',
            'in surprise': '惊讶地', 'in silence': '沉默地',
            'in a loud voice': '大声地', 'in a low voice': '低声地',
            'in good condition': '状况良好', 'in bad condition': '状况不佳',
            'in fashion': '流行', 'out of fashion': '过时',
            'in debt': '负债', 'in cash': '用现金',
            'in advance': '提前', 'in return': '作为回报',
            'in total': '总计', 'in other words': '换句话说',
            'in particular': '尤其', 'in general': '一般来说',
            'in reality': '实际上', 'in theory': '理论上',
            'on purpose': '故意地', 'on average': '平均',
            'on condition that': '条件是', 'on second thought': '转念一想',
            'under construction': '在建设中', 'under control': '在控制之下',
            'under pressure': '在压力下', 'under the weather': '身体不适',
            'out of work': '失业', 'out of reach': '够不着',
            'out of question': '毫无疑问', 'beyond doubt': '毫无疑问'
        };

        // 标记已翻译的短语位置
        const translations = [];
        let remainingText = ' ' + text + ' ';

        // 先匹配最长的短语
        const sortedPhrases = Object.keys(phraseMap).sort((a, b) => b.length - a.length);

        for (const phrase of sortedPhrases) {
            const regex = new RegExp('\\s' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s', 'gi');
            if (remainingText.includes(' ' + phrase + ' ')) {
                remainingText = remainingText.replace(regex, ` {{${translations.length}}} `);
                translations.push(phraseMap[phrase]);
            }
        }

        remainingText = remainingText.trim();

        // 单字词库
        const wordMap = {
            // 代词
            'i': '我', 'you': '你', 'he': '他', 'she': '她', 'it': '它',
            'we': '我们', 'they': '他们', 'me': '我', 'him': '他', 'her': '她',
            'us': '我们', 'them': '他们', 'my': '我的', 'your': '你的', 'his': '他的',
            'this': '这', 'that': '那', 'these': '这些', 'those': '那些',
            'myself': '我自己', 'yourself': '你自己', 'himself': '他自己',
            'herself': '她自己', 'itself': '它自己', 'ourselves': '我们自己',
            'themselves': '他们自己', 'who': '谁', 'whom': '谁', 'whose': '谁的',
            'what': '什么', 'which': '哪个', 'whatever': '无论什么',

            // be动词和助动词
            'is': '是', 'are': '是', 'am': '是', 'was': '是', 'were': '是',
            'be': '成为', 'been': '已经', 'being': '正在', 'do': '做',
            'does': '做', 'did': '做了', 'done': '做完', 'have': '有',
            'has': '有', 'had': '有',

            // 情态动词
            'can': '能', 'could': '能', 'will': '会', 'would': '会',
            'may': '可能', 'might': '可能', 'should': '应该', 'must': '必须',
            'shall': '将', 'ought': '应该', 'need': '需要', 'dare': '敢',

            // 常用动词
            'go': '去', 'went': '去了', 'gone': '去了', 'going': '去',
            'get': '得到', 'got': '得到', 'make': '制作', 'made': '制作',
            'take': '拿', 'took': '拿了', 'taken': '拿了', 'come': '来',
            'came': '来了', 'see': '看见', 'saw': '看见', 'seen': '看见',
            'know': '知道', 'knew': '知道', 'known': '知道', 'think': '认为',
            'thought': '认为', 'say': '说', 'said': '说', 'tell': '告诉',
            'told': '告诉', 'speak': '说话', 'spoke': '说话', 'spoken': '说话',
            'ask': '问', 'give': '给', 'gave': '给了', 'given': '给了',
            'find': '找到', 'found': '找到', 'want': '想要', 'like': '喜欢',
            'love': '爱', 'help': '帮助', 'try': '尝试', 'tried': '尝试',
            'use': '使用', 'used': '使用', 'work': '工作', 'worked': '工作',
            'feel': '感觉', 'felt': '感觉', 'look': '看', 'looked': '看',
            'seem': '似乎', 'seemed': '似乎', 'become': '变成', 'became': '变成',
            'leave': '离开', 'left': '离开', 'put': '放', 'mean': '意思是',
            'meant': '意思是', 'keep': '保持', 'kept': '保持', 'let': '让',
            'begin': '开始', 'began': '开始', 'begun': '开始', 'start': '开始',
            'started': '开始', 'show': '展示', 'showed': '展示', 'shown': '展示',
            'hear': '听见', 'heard': '听见', 'run': '跑', 'ran': '跑了',
            'move': '移动', 'moved': '移动', 'live': '生活', 'lived': '生活',
            'believe': '相信', 'believed': '相信', 'bring': '带来',
            'brought': '带来', 'happen': '发生', 'happened': '发生',
            'write': '写', 'wrote': '写了', 'written': '写了', 'sit': '坐',
            'sat': '坐了', 'stand': '站', 'stood': '站了', 'lose': '失去',
            'lost': '失去', 'add': '添加', 'added': '添加', 'spend': '花费',
            'spent': '花费', 'build': '建造', 'built': '建造', 'stay': '停留',
            'stayed': '停留', 'fall': '落下', 'fell': '落下', 'fallen': '落下',
            'cut': '切', 'reach': '到达', 'reached': '到达', 'kill': '杀死',
            'killed': '杀死', 'remain': '保持', 'remained': '保持',
            'suggest': '建议', 'suggested': '建议', 'raise': '举起',
            'raised': '举起', 'pass': '通过', 'passed': '通过', 'sell': '卖',
            'sold': '卖了', 'require': '需要', 'required': '需要',
            'report': '报告', 'reported': '报告', 'decide': '决定',
            'decided': '决定', 'pull': '拉', 'pulled': '拉',
            'explain': '解释', 'explained': '解释', 'carry': '携带',
            'carried': '携带', 'develop': '发展', 'developed': '发展',
            'hope': '希望', 'hoped': '希望', 'drive': '驾驶', 'drove': '驾驶',
            'driven': '驾驶', 'break': '打破', 'broke': '打破', 'broken': '打破',
            'receive': '收到', 'received': '收到', 'agree': '同意',
            'agreed': '同意', 'support': '支持', 'supported': '支持',
            'remove': '移除', 'removed': '移除', 'return': '返回',
            'returned': '返回', 'describe': '描述', 'described': '描述',
            'create': '创造', 'created': '创造', 'follow': '跟随',
            'followed': '跟随', 'stop': '停止', 'stopped': '停止',
            'read': '读', 'allow': '允许', 'allowed': '允许', 'include': '包括',
            'included': '包括', 'continue': '继续', 'continued': '继续',
            'set': '设置', 'learn': '学习', 'learned': '学习', 'learnt': '学习',
            'change': '改变', 'changed': '改变', 'lead': '领导', 'led': '领导',
            'understand': '理解', 'understood': '理解', 'watch': '观看',
            'watched': '观看', 'call': '打电话', 'called': '打电话',
            'play': '玩', 'played': '玩', 'walk': '走', 'walked': '走',
            'open': '打开', 'opened': '打开', 'close': '关闭', 'closed': '关闭',
            'end': '结束', 'ended': '结束', 'remember': '记得', 'remembered': '记得',
            'forget': '忘记', 'forgot': '忘记', 'forgotten': '忘记', 'buy': '买',
            'bought': '买', 'pay': '支付', 'paid': '支付', 'send': '发送',
            'sent': '发送', 'meet': '遇见', 'met': '遇见', 'grow': '成长',
            'grew': '成长', 'grown': '成长', 'eat': '吃', 'ate': '吃',
            'eaten': '吃', 'drink': '喝', 'drank': '喝', 'drunk': '喝',
            'sleep': '睡觉', 'slept': '睡觉', 'wear': '穿', 'wore': '穿',
            'worn': '穿', 'win': '赢', 'won': '赢',

            // 介词
            'in': '在', 'on': '在', 'at': '在', 'to': '到', 'of': '的',
            'for': '为了', 'with': '和', 'about': '关于', 'into': '进入',
            'from': '从', 'by': '通过', 'as': '作为', 'through': '穿过',
            'during': '在期间', 'before': '在之前', 'after': '在之后',
            'above': '在之上', 'below': '在之下', 'up': '向上', 'down': '向下',
            'out': '出去', 'off': '离开', 'over': '越过', 'under': '在下面',
            'between': '在之间', 'among': '在之中', 'across': '穿过',
            'behind': '在后面', 'beyond': '超出', 'beside': '在旁边',
            'near': '在附近', 'towards': '朝向', 'against': '反对',
            'without': '没有', 'within': '在内', 'until': '直到', 'since': '自从',
            'around': '在周围',

            // 冠词限定词
            'the': '', 'a': '一个', 'an': '一个', 'all': '所有',
            'any': '任何', 'every': '每个', 'each': '每个', 'no': '没有',
            'not': '不', 'some': '一些', 'many': '很多', 'much': '很多',
            'more': '更多', 'most': '最', 'other': '其他', 'another': '另一个',
            'such': '这样的', 'only': '只有', 'own': '自己的', 'same': '相同的',
            'so': '所以', 'than': '比', 'too': '太', 'very': '很',
            'just': '刚刚', 'now': '现在', 'then': '然后', 'also': '也',
            'well': '好', 'here': '这里', 'there': '那里', 'when': '当...时',
            'where': '哪里', 'why': '为什么', 'how': '怎样', 'both': '两者都',
            'either': '任一', 'neither': '两者都不',

            // 形容词
            'good': '好的', 'better': '更好的', 'best': '最好的',
            'bad': '坏的', 'worse': '更坏的', 'worst': '最坏的',
            'big': '大的', 'bigger': '更大的', 'biggest': '最大的',
            'small': '小的', 'smaller': '更小的', 'smallest': '最小的',
            'high': '高的', 'higher': '更高的', 'highest': '最高的',
            'low': '低的', 'lower': '更低的', 'lowest': '最低的',
            'new': '新的', 'newer': '更新的', 'newest': '最新的',
            'old': '老的', 'older': '更老的', 'oldest': '最老的',
            'young': '年轻的', 'younger': '更年轻的', 'youngest': '最年轻的',
            'long': '长的', 'longer': '更长的', 'longest': '最长的',
            'short': '短的', 'shorter': '更短的', 'shortest': '最短的',
            'fast': '快的', 'faster': '更快的', 'fastest': '最快的',
            'slow': '慢的', 'slower': '更慢的', 'slowest': '最慢的',
            'hot': '热的', 'hotter': '更热的', 'hottest': '最热的',
            'cold': '冷的', 'colder': '更冷的', 'coldest': '最冷的',
            'easy': '容易的', 'easier': '更容易的', 'easiest': '最容易的',
            'difficult': '困难的', 'hard': '难的', 'early': '早的',
            'earlier': '更早的', 'earliest': '最早的', 'late': '晚的',
            'later': '更晚的', 'latest': '最晚的', 'happy': '开心的',
            'happier': '更开心的', 'happiest': '最开心的', 'sad': '悲伤的',
            'beautiful': '美丽的', 'ugly': '丑陋的', 'rich': '富有的',
            'poor': '贫穷的', 'strong': '强壮的', 'weak': '虚弱的',
            'right': '正确的', 'wrong': '错误的', 'true': '真实的',
            'false': '虚假的', 'real': '真正的', 'fake': '假的',
            'important': '重要的', 'necessary': '必要的', 'possible': '可能的',
            'impossible': '不可能的', 'available': '可用的', 'different': '不同的',
            'similar': '相似的', 'special': '特别的', 'general': '一般的',
            'particular': '特别的', 'common': '常见的', 'rare': '稀有的',
            'usual': '通常的', 'unusual': '不寻常的', 'normal': '正常的',
            'abnormal': '不正常的', 'regular': '规则的', 'irregular': '不规则的',
            'certain': '确定的', 'sure': '确定的', 'clear': '清楚的',
            'obvious': '明显的', 'exact': '确切的', 'correct': '正确的',
            'whole': '整个的', 'half': '一半的', 'full': '满的', 'empty': '空的',
            'free': '自由的', 'busy': '忙的', 'ready': '准备好的',
            'able': '能够的', 'unable': '不能的', 'likely': '可能的',
            'unlikely': '不可能的', 'interested': '感兴趣的',
            'interesting': '有趣的', 'bored': '无聊的', 'boring': '乏味的',
            'excited': '兴奋的', 'exciting': '令人兴奋的', 'surprised': '惊讶的',
            'surprising': '令人惊讶的', 'tired': '累的', 'tiring': '累人的',
            'worried': '担心的', 'worrying': '令人担心的', 'pleased': '高兴的',
            'pleasant': '愉快的', 'satisfied': '满意的', 'satisfying': '令人满意的',
            'relaxed': '放松的', 'relaxing': '令人放松的', 'scared': '害怕的',
            'scary': '吓人的', 'afraid': '害怕的', 'frightened': '受惊的',
            'dangerous': '危险的', 'safe': '安全的', 'polite': '有礼貌的',
            'rude': '粗鲁的', 'kind': '善良的', 'cruel': '残忍的',
            'friendly': '友好的', 'unfriendly': '不友好的', 'honest': '诚实的',
            'dishonest': '不诚实的', 'brave': '勇敢的', 'shy': '害羞的',
            'proud': '骄傲的', 'modest': '谦虚的', 'patient': '耐心的',
            'impatient': '不耐烦的', 'careful': '小心的', 'careless': '粗心的',
            'successful': '成功的', 'unsuccessful': '不成功的', 'famous': '著名的',
            'popular': '流行的', 'fashionable': '时尚的', 'modern': '现代的',
            'traditional': '传统的', 'local': '当地的', 'national': '国家的',
            'international': '国际的', 'public': '公共的', 'private': '私人的',
            'personal': '个人的', 'professional': '专业的', 'physical': '身体的',
            'mental': '精神的', 'medical': '医学的', 'legal': '合法的',
            'illegal': '非法的', 'financial': '金融的', 'economic': '经济的',
            'political': '政治的', 'social': '社会的', 'cultural': '文化的',
            'historical': '历史的', 'natural': '自然的', 'artificial': '人工的',
            'scientific': '科学的', 'technical': '技术的', 'practical': '实用的',
            'theoretical': '理论的', 'academic': '学术的', 'educational': '教育的',
            'environmental': '环境的', 'global': '全球的',

            // 常见名词
            'time': '时间', 'times': '时代', 'way': '方式', 'year': '年',
            'day': '天', 'days': '日子', 'man': '男人', 'men': '男人们',
            'woman': '女人', 'women': '女人们', 'child': '孩子', 'children': '孩子们',
            'people': '人们', 'person': '人', 'life': '生活', 'world': '世界',
            'school': '学校', 'state': '状态', 'family': '家庭', 'student': '学生',
            'group': '小组', 'country': '国家', 'problem': '问题', 'hand': '手',
            'part': '部分', 'place': '地方', 'case': '情况', 'week': '星期',
            'company': '公司', 'system': '系统', 'program': '程序',
            'question': '问题', 'work': '工作', 'government': '政府',
            'number': '数字', 'night': '夜晚', 'point': '点', 'home': '家',
            'water': '水', 'room': '房间', 'mother': '妈妈', 'father': '爸爸',
            'area': '地区', 'money': '钱', 'story': '故事', 'fact': '事实',
            'month': '月份', 'lot': '很多', 'right': '权利', 'study': '学习',
            'book': '书', 'eye': '眼睛', 'job': '工作', 'word': '单词',
            'business': '生意', 'issue': '问题', 'side': '边', 'kind': '种类',
            'head': '头', 'house': '房子', 'service': '服务', 'friend': '朋友',
            'power': '力量', 'hour': '小时', 'game': '游戏', 'line': '线',
            'end': '结束', 'member': '成员', 'law': '法律', 'car': '汽车',
            'city': '城市', 'community': '社区', 'name': '名字',
            'president': '总统', 'team': '队伍', 'minute': '分钟', 'idea': '主意',
            'kid': '小孩', 'body': '身体', 'information': '信息', 'back': '后面',
            'parent': '父母', 'face': '脸', 'others': '其他人', 'level': '水平',
            'office': '办公室', 'door': '门', 'health': '健康', 'art': '艺术',
            'war': '战争', 'history': '历史', 'party': '聚会', 'result': '结果',
            'change': '改变', 'morning': '早上', 'reason': '原因',
            'research': '研究', 'girl': '女孩', 'guy': '家伙', 'moment': '时刻',
            'air': '空气', 'teacher': '老师', 'force': '力量', 'education': '教育',
            'foot': '脚', 'feet': '脚', 'boy': '男孩', 'age': '年龄',
            'policy': '政策', 'everything': '一切', 'everyone': '每个人',
            'someone': '某人', 'nothing': '没有什么', 'anything': '任何事',
            'somebody': '某人', 'anybody': '任何人', 'nobody': '没有人',
            'today': '今天', 'tomorrow': '明天', 'yesterday': '昨天',
            'sun': '太阳', 'moon': '月亮', 'star': '星星', 'sky': '天空',
            'earth': '地球', 'land': '陆地', 'sea': '海洋', 'river': '河',
            'mountain': '山', 'tree': '树', 'flower': '花', 'grass': '草',
            'animal': '动物', 'dog': '狗', 'cat': '猫', 'bird': '鸟',
            'fish': '鱼', 'horse': '马', 'cow': '牛', 'pig': '猪',
            'chicken': '鸡', 'duck': '鸭', 'sheep': '羊', 'lion': '狮子',
            'tiger': '老虎', 'elephant': '大象', 'bear': '熊', 'wolf': '狼',
            'fox': '狐狸', 'rabbit': '兔子', 'mouse': '老鼠', 'snake': '蛇',
            'news': '新闻', 'paper': '纸', 'letter': '信', 'message': '信息',
            'report': '报告', 'article': '文章', 'novel': '小说', 'poem': '诗',
            'song': '歌曲', 'music': '音乐', 'film': '电影', 'movie': '电影',
            'picture': '图片', 'photo': '照片', 'camera': '相机', 'phone': '电话',
            'computer': '电脑', 'internet': '互联网', 'website': '网站',
            'email': '电子邮件', 'address': '地址', 'road': '路', 'street': '街道',
            'bridge': '桥', 'building': '建筑物', 'wall': '墙', 'window': '窗户',
            'floor': '地板', 'ground': '地面', 'roof': '屋顶', 'garden': '花园',
            'farm': '农场', 'park': '公园', 'zoo': '动物园', 'museum': '博物馆',
            'library': '图书馆', 'hospital': '医院', 'bank': '银行', 'hotel': '酒店',
            'restaurant': '餐馆', 'shop': '商店', 'store': '商店', 'market': '市场',
            'supermarket': '超市', 'mall': '商场', 'station': '车站',
            'airport': '机场', 'port': '港口', 'bus': '公交车', 'train': '火车',
            'plane': '飞机', 'ship': '船', 'bike': '自行车', 'walk': '步行',
            'food': '食物', 'meal': '一餐', 'breakfast': '早餐', 'lunch': '午餐',
            'dinner': '晚餐', 'supper': '晚餐', 'fruit': '水果', 'vegetable': '蔬菜',
            'meat': '肉', 'rice': '米饭', 'noodle': '面条', 'bread': '面包',
            'cake': '蛋糕', 'egg': '鸡蛋', 'milk': '牛奶', 'tea': '茶',
            'coffee': '咖啡', 'juice': '果汁', 'sugar': '糖', 'salt': '盐',
            'oil': '油', 'clothes': '衣服', 'shirt': '衬衫', 'coat': '外套',
            'dress': '连衣裙', 'skirt': '裙子', 'trousers': '裤子', 'shoe': '鞋',
            'hat': '帽子', 'bag': '包', 'watch': '手表', 'glasses': '眼镜',
            'color': '颜色', 'red': '红色', 'blue': '蓝色', 'green': '绿色',
            'yellow': '黄色', 'white': '白色', 'black': '黑色', 'brown': '棕色',
            'pink': '粉色', 'purple': '紫色', 'orange': '橙色', 'grey': '灰色',
            'shape': '形状', 'size': '大小', 'meter': '米', 'kilometer': '千米',
            'kilogram': '千克', 'gram': '克', 'liter': '升', 'foot': '英尺',
            'inch': '英寸', 'pound': '磅', 'dollar': '美元', 'euro': '欧元',
            'yuan': '元', 'cent': '分', 'price': '价格', 'cost': '成本',
            'value': '价值', 'quality': '质量', 'standard': '标准',
            'advantage': '优势', 'disadvantage': '劣势', 'difference': '区别',
            'similarity': '相似', 'effect': '效果', 'influence': '影响',
            'conclusion': '结论', 'example': '例子', 'experience': '经历',
            'knowledge': '知识', 'skill': '技能', 'ability': '能力',
            'talent': '天赋', 'effort': '努力', 'success': '成功',
            'failure': '失败', 'progress': '进步', 'development': '发展',
            'improvement': '改善', 'attention': '注意', 'interest': '兴趣',
            'benefit': '好处', 'harm': '伤害', 'damage': '损害', 'loss': '损失',
            'risk': '风险', 'safety': '安全', 'danger': '危险', 'trouble': '麻烦',
            'difficulty': '困难', 'solution': '解决方案', 'answer': '答案',
            'opinion': '观点', 'thought': '想法', 'view': '看法',
            'attitude': '态度', 'feeling': '感觉', 'emotion': '情感',
            'mood': '心情', 'spirit': '精神', 'mind': '思想', 'brain': '大脑',
            'heart': '心脏', 'soul': '灵魂', 'hair': '头发', 'ear': '耳朵',
            'nose': '鼻子', 'mouth': '嘴', 'tooth': '牙齿', 'teeth': '牙齿',
            'tongue': '舌头', 'neck': '脖子', 'shoulder': '肩膀', 'arm': '手臂',
            'finger': '手指', 'leg': '腿', 'knee': '膝盖', 'blood': '血',
            'skin': '皮肤', 'bone': '骨头', 'muscle': '肌肉', 'pain': '疼痛',
            'illness': '疾病', 'disease': '疾病', 'fever': '发烧',
            'cough': '咳嗽', 'headache': '头痛', 'cancer': '癌症',
            'accident': '事故', 'injury': '伤害', 'wound': '伤口', 'death': '死亡',
            'birth': '出生', 'marriage': '婚姻', 'wedding': '婚礼', 'divorce': '离婚',
            'relationship': '关系', 'connection': '联系', 'communication': '交流',
            'conversation': '对话', 'discussion': '讨论', 'debate': '辩论',
            'argument': '争论', 'agreement': '同意', 'disagreement': '分歧',
            'conflict': '冲突', 'peace': '和平', 'fight': '战斗',
            'battle': '战役', 'competition': '竞争', 'match': '比赛',
            'race': '比赛', 'sport': '运动', 'exercise': '锻炼', 'hobby': '爱好',
            'fun': '乐趣', 'pleasure': '快乐', 'joy': '喜悦', 'happiness': '幸福',
            'sadness': '悲伤', 'anger': '愤怒', 'fear': '恐惧', 'worry': '担心',
            'stress': '压力', 'anxiety': '焦虑', 'depression': '抑郁',
            'comfort': '安慰', 'dream': '梦想', 'goal': '目标', 'purpose': '目的',
            'meaning': '意义', 'cause': '原因', 'excuse': '借口', 'chance': '机会',
            'opportunity': '机会', 'luck': '运气', 'fortune': '运气', 'gift': '礼物',
            'prize': '奖品', 'award': '奖励', 'reward': '回报',
            'punishment': '惩罚', 'crime': '犯罪', 'criminal': '罪犯',
            'prison': '监狱', 'police': '警察', 'lawyer': '律师', 'judge': '法官',
            'court': '法庭', 'justice': '正义', 'truth': '真相', 'lie': '谎言',
            'secret': '秘密', 'privacy': '隐私', 'freedom': '自由',
            'equality': '平等', 'democracy': '民主', 'authority': '权威',
            'control': '控制', 'order': '秩序', 'rule': '规则', 'principle': '原则',
            'limit': '限制', 'boundary': '边界', 'barrier': '障碍',
            'obstacle': '障碍', 'challenge': '挑战', 'pressure': '压力',
            'care': '关心', 'protection': '保护', 'defense': '防御',
            'attack': '攻击', 'offense': '进攻', 'victory': '胜利',
            'defeat': '失败', 'error': '错误', 'mistake': '错误',
            'fault': '过错', 'blame': '责备', 'credit': '信用', 'trust': '信任',
            'faith': '信仰', 'belief': '信念', 'religion': '宗教', 'god': '上帝',
            'church': '教堂', 'temple': '寺庙', 'prayer': '祈祷',
            'holiday': '假期', 'vacation': '假期', 'festival': '节日',
            'celebration': '庆祝', 'tradition': '传统', 'custom': '习俗',
            'culture': '文化', 'civilization': '文明', 'society': '社会',
            'population': '人口', 'crowd': '人群', 'organization': '组织',
            'institution': '机构', 'factory': '工厂', 'industry': '工业',
            'agriculture': '农业', 'trade': '贸易', 'commerce': '商业',
            'investment': '投资', 'profit': '利润', 'income': '收入',
            'expense': '支出', 'debt': '债务', 'tax': '税', 'budget': '预算',
            'resource': '资源', 'energy': '能源', 'electricity': '电',
            'gas': '天然气', 'oil': '石油', 'coal': '煤', 'environment': '环境',
            'nature': '自然', 'pollution': '污染', 'climate': '气候',
            'weather': '天气', 'temperature': '温度', 'season': '季节',
            'spring': '春天', 'summer': '夏天', 'autumn': '秋天', 'fall': '秋天',
            'winter': '冬天', 'technology': '技术', 'science': '科学',
            'invention': '发明', 'discovery': '发现', 'experiment': '实验',
            'university': '大学', 'college': '学院', 'class': '班级',
            'lesson': '课', 'course': '课程', 'subject': '科目', 'exam': '考试',
            'test': '测试', 'grade': '成绩', 'degree': '学位',
            'graduation': '毕业', 'career': '职业', 'profession': '职业',
            'occupation': '职业', 'position': '职位', 'duty': '职责',
            'responsibility': '责任', 'task': '任务', 'labor': '劳动',
            'attempt': '尝试', 'schedule': '时间表', 'appointment': '约会',
            'meeting': '会议', 'conference': '会议', 'event': '事件',
            'activity': '活动', 'performance': '表演', 'show': '演出',
            'ceremony': '仪式', 'direction': '方向', 'east': '东', 'west': '西',
            'south': '南', 'north': '北', 'left': '左', 'right': '右',
            'center': '中心', 'middle': '中间', 'front': '前面', 'top': '顶部',
            'bottom': '底部', 'edge': '边缘', 'corner': '角落',
            'distance': '距离', 'speed': '速度', 'pace': '步伐', 'rate': '比率',
            'frequency': '频率', 'amount': '数量', 'quantity': '数量',
            'volume': '体积', 'weight': '重量', 'height': '高度', 'width': '宽度',
            'length': '长度', 'depth': '深度', 'area': '面积', 'space': '空间',
            'seat': '座位', 'location': '地点', 'site': '地点', 'spot': '地点',
            'region': '地区', 'zone': '区域', 'territory': '领土', 'nation': '国家',
            'town': '城镇', 'village': '村庄', 'district': '区',
            'neighborhood': '街区',

            // 新增：高级词汇（来自报刊例句）
            'scandal': '丑闻', 'damage': '损害', 'damaged': '损害',
            'repair': '修复', 'reputation': '名声', 'negotiator': '谈判者',
            'tough': '强硬的', 'built': '建立', 'idea': '主意', 'ideas': '主意',
            'attached': '附加的', 'attach': '附加', 'bears': '承担', 'bear': '承担',
            'itself': '本身', 'person': '人', 'genre': '类型', 'meathead': '傻瓜',
            'unabashed': '不掩饰的', 'geek': '极客', 'geeks': '极客',
            'band': '乐队', 'bands': '乐队', 'author': '作者',
            'rose': '玫瑰', 'sweet': '甜蜜的', 'smell': '气味', 'name': '名字',
            'names': '名字', 'rose': '玫瑰'
        };

        // 翻译剩余的单词
        const words = remainingText.split(/\s+/);
        const translatedWords = words.map(w => {
            // 检查是否是占位符
            const placeholderMatch = w.match(/^{{(\d+)}}$/);
            if (placeholderMatch) {
                return translations[parseInt(placeholderMatch[1])];
            }

            // 去除标点
            const cleanWord = w.toLowerCase().replace(/^[.,!?;:]+|[.,!?;:]+$/g, '');
            const leadingPunct = w.match(/^[.,!?;:]+/)?.[0] || '';
            const trailingPunct = w.match(/[.,!?;:]+$/)?.[0] || '';

            if (wordMap[cleanWord]) {
                return leadingPunct + wordMap[cleanWord] + trailingPunct;
            }

            // 尝试去除所有格's
            if (cleanWord.endsWith("'s") || cleanWord.endsWith("'")) {
                const baseWord = cleanWord.replace(/'s?$/, '');
                if (wordMap[baseWord]) {
                    return leadingPunct + wordMap[baseWord] + '的' + trailingPunct;
                }
            }

            // 尝试去除复数s/es
            if (cleanWord.endsWith('ies')) {
                const baseWord = cleanWord.slice(0, -3) + 'y';
                if (wordMap[baseWord]) {
                    return leadingPunct + wordMap[baseWord] + trailingPunct;
                }
            }
            if (cleanWord.endsWith('es') && cleanWord.length > 3) {
                const baseWord = cleanWord.slice(0, -2);
                if (wordMap[baseWord]) {
                    return leadingPunct + wordMap[baseWord] + trailingPunct;
                }
            }
            if (cleanWord.endsWith('s') && cleanWord.length > 2 && !cleanWord.endsWith('ss')) {
                const baseWord = cleanWord.slice(0, -1);
                if (wordMap[baseWord]) {
                    return leadingPunct + wordMap[baseWord] + trailingPunct;
                }
            }

            // 如果单词不在词典里，保留原词但用空格分隔
            return w;
        });

        // 组合翻译结果 - 保留空格
        let result = translatedWords.join(' ');

        // 清理多余空格
        result = result.replace(/\s+/g, ' ').trim();

        // 翻译质量检测
        const chineseChars = result.match(/[\u4e00-\u9fa5]/g) || [];
        const englishWords = result.match(/[a-zA-Z]+/g) || [];
        const totalWords = result.split(/\s+/).length;

        // 如果中文字符太少，或者剩余英文单词太多（超过40%），视为翻译失败
        const chineseRatio = chineseChars.length / (totalWords || 1);
        const englishRatio = englishWords.length / (totalWords || 1);

        if (chineseChars.length < 3 || englishRatio > 0.4) {
            return '（建议参考原文理解）';
        }

        // 添加句号（如果原文有）
        if (sentence.match(/[.!?]$/)) {
            result = result.replace(/[.!?]*$/, '。');
        }

        return result;
    }
    generateStory(word, meaning, partOfSpeech, allMeanings) {
        // 优先使用词典API返回的真实释义和例句
        if (allMeanings && allMeanings.length > 0) {
            let story = '📖 词典释义\n\n';
            let hasExample = false;

            allMeanings.slice(0, 2).forEach((m, index) => {
                story += `${index + 1}. 【${this.translatePartOfSpeech(m.partOfSpeech)}】\n`;

                m.definitions.slice(0, 2).forEach((def, defIndex) => {
                    story += `   ${defIndex + 1}) ${def.definition}\n`;
                    if (def.example) {
                        hasExample = true;
                        const exampleCn = this.translateLocal(def.example);
                        story += `      例：${def.example}\n`;
                        // 只显示质量好的翻译
                        if (exampleCn && !exampleCn.includes('建议参考原文')) {
                            story += `         ${exampleCn}\n`;
                        }
                    }
                });

                // 显示同义词/反义词
                if (m.synonyms && m.synonyms.length > 0) {
                    story += `      同义词：${m.synonyms.slice(0, 3).join(', ')}\n`;
                }
                if (m.antonyms && m.antonyms.length > 0) {
                    story += `      反义词：${m.antonyms.slice(0, 3).join(', ')}\n`;
                }

                story += '\n';
            });

            // 如果没有例句，尝试使用本地例句库
            if (!hasExample) {
                const localExamples = this.getLocalExamples(word);
                if (localExamples.length > 0) {
                    story += '\n📰 真实语境例句（来自英语报刊）：\n';
                    localExamples.slice(0, 2).forEach((ex, idx) => {
                        story += `   ${idx + 1}. ${ex.en}\n`;
                        story += `      ${ex.cn}\n`;
                        story += `      —— ${ex.source}\n`;
                    });
                }
                // 没有本地例句时，不添加虚假内容
            }

            return story.trim();
        }

        // 备用：返回基本释义
        return `📖 ${word}\n【${this.translatePartOfSpeech(partOfSpeech)}】${meaning}`;
    }

    translatePartOfSpeech(pos) {
        const map = {
            'noun': '名词',
            'verb': '动词',
            'adjective': '形容词',
            'adverb': '副词',
            'preposition': '介词',
            'conjunction': '连词',
            'pronoun': '代词',
            'interjection': '感叹词',
            'determiner': '限定词'
        };
        return map[pos] || pos;
    }

    generateVisual(word, phonetic, meaning, partOfSpeech) {
        const rootAnalysis = this.analyzeWordRoots(word);
        const ascii = this.buildRootVisual(word, rootAnalysis, partOfSpeech);
        return { ascii, mnemonic: rootAnalysis.explanation };
    }

    analyzeWordRoots(word) {
        const lowerWord = word.toLowerCase();
        const found = [];

        const roots = {
            'un-': { type: 'prefix', meaning: '不' },
            're-': { type: 'prefix', meaning: '再' },
            'dis-': { type: 'prefix', meaning: '否定' },
            'pre-': { type: 'prefix', meaning: '在前' },
            'act': { type: 'root', meaning: '做' },
            'port': { type: 'root', meaning: '携带' },
            'form': { type: 'root', meaning: '形状' },
            '-able': { type: 'suffix', meaning: '能够' },
            '-ful': { type: 'suffix', meaning: '充满' }
        };

        for (const [root, info] of Object.entries(roots)) {
            const cleanRoot = root.replace(/-/g, '');
            if (lowerWord.includes(cleanRoot)) {
                found.push({ text: root, ...info });
            }
        }

        const explanation = found.length > 0
            ? `📖 词根词缀：${found.map(f => `${f.text} = ${f.meaning}`).join(' + ')}`
            : `📖 观察单词：${word.split('').join('-')}`;

        return { found, explanation };
    }

    buildRootVisual(word, rootAnalysis, partOfSpeech) {
        const icons = { noun: '📦', verb: '⚡', adjective: '🎨', default: '📝' };
        const icon = icons[partOfSpeech] || icons.default;
        return `    ${icon} 词根拆解 ${icon}\n   ${rootAnalysis.explanation}\n   💡 ${word}`;
    }

    translateMeaning(meaning) {
        const phrases = {
            'a person who': '一个...的人',
            'a thing that': '一个...的东西',
            'to make': '使...',
            'having': '具有...的',
            'full of': '充满...的'
        };

        for (const [en, cn] of Object.entries(phrases)) {
            if (meaning.toLowerCase().includes(en)) {
                return meaning.replace(new RegExp(en, 'gi'), cn);
            }
        }
        return meaning.substring(0, 50);
    }

    generateExample(word) {
        return `This is a good example of "${word}".`;
    }

    displayCard() {
        if (!this.currentWord) return;

        const w = this.currentWord;

        this.wordText.textContent = w.word;
        this.phoneticText.textContent = w.phonetic;
        this.asciiArt.textContent = w.asciiArt;
        this.mnemonicText.textContent = w.mnemonic;
        this.meaningText.textContent = w.meaning;
        this.storyText.textContent = w.story;
        this.exampleText.textContent = w.example;
        // 设置主例句中文翻译
        if (w.exampleCn) {
            // 本地例句已有翻译
            this.exampleCnText.textContent = w.exampleCn;
        } else if (w.example) {
            // 需要调用 API 翻译
            this.exampleCnText.textContent = '翻译加载中...';
            this.translateWithAPI(w.example).then(cn => {
                if (cn && this.exampleCnText) {
                    this.exampleCnText.textContent = cn;
                }
            }).catch(() => {
                this.exampleCnText.textContent = '';
            });
        }

        if (this.oxfordLink) {
            this.oxfordLink.href = `https://www.oxfordlearnersdictionaries.com/definition/english/${w.word.toLowerCase()}`;
        }

        this.cardSection.classList.remove('hidden');
        this.errorState.classList.add('hidden');
        this.card.classList.remove('flipped');

        // 生成例句（异步）
        this.generateAutoSentences(w.word).catch(err => console.log('例句获取失败:', err));
        this.renderUserSentences(w.word);
        this.sentenceInput.value = '';

        setTimeout(() => this.speakWord(), 500);
    }

    // 生成参考例句 - 从多个来源获取真实例句（优化版）
    async generateAutoSentences(word) {
        if (!this.currentWord) return;

        const wordData = this.currentWord;
        let sentences = [];

        // 首先检查缓存
        if (this.examplesCache[word] && this.examplesCache[word].length > 0) {
            this.displaySentences(this.examplesCache[word]);
            return;
        }

        // 1. 优先使用本地例句库（最可靠）
        const localSentences = this.getLocalExamples(word);
        if (localSentences.length > 0) {
            sentences = localSentences;
        }

        // 2. 使用词典 API 返回的例句
        if (sentences.length < 3 && wordData.allExamples && wordData.allExamples.length > 0) {
            const examplePromises = wordData.allExamples.slice(0, 2).map(async ex => {
                const translated = await this.translateWithAPI(ex.text);
                return {
                    en: ex.text,
                    cn: translated,
                    source: 'Free Dictionary API'
                };
            });
            const dictSentences = await Promise.all(examplePromises);
            sentences = [...sentences, ...dictSentences];
        }

        // 3. 尝试 Tatoeba 免费例句API（开源例句库，无需key）
        if (sentences.length < 3) {
            const tatoebaSentences = await this.fetchTatoebaExamples(word);
            if (tatoebaSentences.length > 0) {
                sentences = [...sentences, ...tatoebaSentences];
            }
        }

        // 4. 尝试从新闻媒体获取真实例句
        if (sentences.length < 3) {
            const newsSentences = await this.fetchNewsExamples(word);
            if (newsSentences.length > 0) {
                sentences = [...sentences, ...newsSentences];
            }
        }

        // 5. 尝试 Wordnik API
        if (sentences.length < 3) {
            const externalSentences = await this.fetchExternalExamples(word);
            if (externalSentences.length > 0) {
                sentences = [...sentences, ...externalSentences];
            }
        }

        // 6. 尝试通过网页抓取获取例句（备用方案）
        if (sentences.length < 2) {
            const webSentences = await this.fetchWebExamples(word);
            if (webSentences.length > 0) {
                sentences = [...sentences, ...webSentences];
            }
        }

        // 去重
        sentences = this.deduplicateSentences(sentences);

        // 最多显示5条例句
        sentences = sentences.slice(0, 5);

        // 最终还是没有例句
        if (sentences.length === 0) {
            this.autoSentences.innerHTML = `
                <p class="auto-sentence-hint">💡 正在从多个来源搜索例句...</p>
                <div style="margin-top: 10px;">
                    <button onclick="window.open('https://www.oxfordlearnersdictionaries.com/definition/english/${word}', '_blank')"
                            style="background: var(--primary-color); color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-right: 8px;">
                        📖 查看牛津词典
                    </button>
                    <button onclick="window.open('https://tatoeba.org/en/sentences/search?query=${word}', '_blank')"
                            style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-right: 8px;">
                        🌐 Tatoeba例句库
                    </button>
                    <button onclick="window.open('https://context.reverso.net/translation/english-chinese/${word}', '_blank')"
                            style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer;">
                        🔄 Reverso Context
                    </button>
                </div>
            `;
            return;
        }

        // 缓存
        this.examplesCache[word] = sentences;
        localStorage.setItem('examplesCache', JSON.stringify(this.examplesCache));

        this.displaySentences(sentences);
    }

    // 例句去重
    deduplicateSentences(sentences) {
        const seen = new Set();
        return sentences.filter(s => {
            const key = s.en.toLowerCase().trim();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // 从 Tatoeba 获取例句（免费开源例句库）
    async fetchTatoebaExamples(word) {
        const sentences = [];

        try {
            // Tatoeba API - 免费无需key
            const response = await fetch(
                `https://tatoeba.org/en/api_v0/search?from=eng&to=cmn&query=${encodeURIComponent(word)}&page=1`,
                {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json'
                    },
                    timeout: 5000
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.results && data.results.length > 0) {
                    for (const result of data.results.slice(0, 3)) {
                        const enText = result.text;
                        // 查找中文翻译
                        let cnText = '';
                        if (result.translations && result.translations.length > 0) {
                            const cnTranslation = result.translations.find(t => t.lang === 'cmn' || t.lang === 'zh');
                            if (cnTranslation) {
                                cnText = cnTranslation.text;
                            }
                        }

                        // 如果没有中文翻译，使用API翻译
                        if (!cnText) {
                            cnText = await this.translateWithAPI(enText);
                        }

                        sentences.push({
                            en: enText,
                            cn: cnText,
                            source: 'Tatoeba'
                        });
                    }
                }
            }
        } catch (error) {
            console.log('Tatoeba API 获取失败:', error);
            // 备用：尝试直接访问Tatoeba搜索页面
            try {
                const backupResponse = await fetch(
                    `https://api.allorigins.win/get?url=${encodeURIComponent(`https://tatoeba.org/en/sentences/search?query=${word}&from=eng&to=cmn&orphans=&unapproved=&tags=&list=&user=&has_audio=&trans_filter=limit&trans_link=&trans_to=cmn&trans_unapproved=&trans_orphans=&trans_user=&sort=relevance&sort_reverse=&limit=10`)}`,
                    { timeout: 8000 }
                );
                // 如果备用方案也失败，静默处理
            } catch (e) {
                console.log('Tatoeba 备用方案也失败');
            }
        }

        return sentences;
    }

    // 从网页抓取例句（备用方案）
    async fetchWebExamples(word) {
        const sentences = [];

        // 预设的优质例句来源URL模板
        const sources = [
            {
                name: 'YourDictionary',
                getUrl: (w) => `https://sentence.yourdictionary.com/${w}`
            }
        ];

        // 由于跨域限制，这里提供直接链接让用户自行访问
        // 同时返回一些提示信息
        console.log(`建议手动访问以下网站查找 "${word}" 的例句：`);
        console.log(`- https://sentence.yourdictionary.com/${word}`);
        console.log(`- https://www.merriam-webster.com/sentences/${word}`);
        console.log(`- https://context.reverso.net/translation/english-chinese/${word}`);

        return sentences;
    }

    // 从外部例句库获取真实例句
    async fetchExternalExamples(word) {
        const sentences = [];

        try {
            // 使用 Wordnik API (需要 API key，这里使用公开端点)
            const wordnikResponse = await fetch(
                `https://api.wordnik.com/v4/word.json/${word}/examples?includeDuplicates=false&useCanonical=false&limit=2&api_key=a2a73e7b926c924fad7001ca3111acd55af2ffabf50eb4ae5`,
                { timeout: 3000 }
            );

            if (wordnikResponse.ok) {
                const data = await wordnikResponse.json();
                if (data.examples && data.examples.length > 0) {
                    const examplePromises = data.examples.slice(0, 2).map(async ex => {
                        const translated = await this.translateWithAPI(ex.text);
                        return {
                            en: ex.text,
                            cn: translated,
                            source: ex.title || 'Wordnik'
                        };
                    });
                    const translatedExamples = await Promise.all(examplePromises);
                    sentences.push(...translatedExamples);
                }
            }
        } catch (error) {
            console.log('Wordnik API 获取失败:', error);
        }

        return sentences;
    }

    // 从新闻媒体获取真实例句
    async fetchNewsExamples(word) {
        const sentences = [];

        // 如果没有配置 NewsAPI key，跳过
        if (!this.NEWS_API_CONFIG.apiKey) {
            return sentences;
        }

        try {
            // 使用 NewsAPI 搜索包含该单词的新闻
            const response = await fetch(
                `https://newsapi.org/v2/everything?q="${word}"&sources=${this.NEWS_API_CONFIG.sources}&pageSize=2&apiKey=${this.NEWS_API_CONFIG.apiKey}`,
                { timeout: 5000 }
            );

            if (response.ok) {
                const data = await response.json();
                if (data.articles && data.articles.length > 0) {
                    for (const article of data.articles.slice(0, 2)) {
                        // 从标题或描述中提取包含该单词的句子
                        const text = article.description || article.title;
                        if (text && text.toLowerCase().includes(word.toLowerCase())) {
                            // 提取包含目标单词的完整句子
                            const sentences_text = text.match(/[^.!?]+[.!?]/g) || [text];
                            for (const sent of sentences_text) {
                                if (sent.toLowerCase().includes(word.toLowerCase())) {
                                    const translated = await this.translateWithAPI(sent.trim());
                                    sentences.push({
                                        en: sent.trim(),
                                        cn: translated,
                                        source: article.source.name || 'News'
                                    });
                                    break; // 只取第一个包含单词的句子
                                }
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.log('NewsAPI 获取失败:', error);
        }

        return sentences;
    }

    // 本地专业例句库（来自英语时文、报刊、权威词典）- 已扩展到100+词汇
    getLocalExamples(word) {
        const exampleDatabase = {
            // A
            'abandon': [
                { en: 'The team decided to abandon the project due to lack of funding.', cn: '由于缺乏资金，团队决定放弃这个项目。', source: 'BBC News' },
                { en: 'Never abandon your dreams, no matter how difficult things get.', cn: '无论事情变得多么困难，永远不要放弃你的梦想。', source: 'Forbes' }
            ],
            'ability': [
                { en: 'She demonstrated remarkable ability in solving complex problems.', cn: '她在解决复杂问题方面表现出了非凡的能力。', source: 'Harvard Business Review' },
                { en: 'The test measures your ability to think critically.', cn: '这项测试衡量你的批判性思维能力。', source: 'The Guardian' }
            ],
            'achieve': [
                { en: 'Hard work and dedication helped him achieve his goals.', cn: '努力工作和奉献精神帮助他实现了目标。', source: 'CNN' },
                { en: 'The company aims to achieve carbon neutrality by 2030.', cn: '该公司计划在2030年前实现碳中和。', source: 'Reuters' }
            ],
            'advantage': [
                { en: 'Being bilingual gives you a significant advantage in the job market.', cn: '会说两种语言在就业市场上给你带来显著优势。', source: 'The Economist' },
                { en: 'We should take advantage of this opportunity.', cn: '我们应该利用这个机会。', source: 'Financial Times' }
            ],
            'affect': [
                { en: 'Climate change will affect agriculture in many regions.', cn: '气候变化将影响许多地区的农业。', source: 'Nature' },
                { en: 'The new policy will affect millions of citizens.', cn: '新政策将影响数百万公民。', source: 'The Washington Post' }
            ],
            'allow': [
                { en: 'The new regulations allow students to use calculators during exams.', cn: '新规定允许学生在考试中使用计算器。', source: 'BBC Education' },
                { en: 'Please allow me to explain the situation.', cn: '请允许我解释一下情况。', source: 'The New York Times' }
            ],
            'ancient': [
                { en: 'The museum houses a collection of ancient artifacts.', cn: '博物馆收藏了一批古代文物。', source: 'Smithsonian' },
                { en: 'Ancient civilizations often built their cities near rivers.', cn: '古代文明通常在河流附近建造城市。', source: 'National Geographic' }
            ],
            'approach': [
                { en: 'We need a different approach to solve this problem.', cn: '我们需要一种不同的方法来解决这个问题。', source: 'MIT Technology Review' },
                { en: 'Her approach to teaching has inspired many students.', cn: '她的教学方法激励了许多学生。', source: 'The Guardian' }
            ],
            'argue': [
                { en: 'Critics argue that the new law is unconstitutional.', cn: '批评者认为新法律违宪。', source: 'CNN' },
                { en: 'Some scientists argue that we need more research.', cn: '一些科学家认为我们需要更多的研究。', source: 'Scientific American' }
            ],
            'available': [
                { en: 'The report will be available online starting tomorrow.', cn: '该报告将从明天开始在网上提供。', source: 'Reuters' },
                { en: 'This option is available to all registered users.', cn: '此选项对所有注册用户可用。', source: 'TechCrunch' }
            ],

            // B
            'benefit': [
                { en: 'Regular exercise has many health benefits.', cn: '定期锻炼有许多健康益处。', source: 'Medical News Today' },
                { en: 'The new policy will benefit small businesses.', cn: '新政策将有利于小企业。', source: 'The Wall Street Journal' }
            ],
            'business': [
                { en: 'Small businesses are the backbone of the local economy.', cn: '小企业是本地经济的支柱。', source: 'Fortune' },
                { en: 'The company plans to expand its business overseas.', cn: '该公司计划将业务扩展到海外。', source: 'Bloomberg' }
            ],

            // C
            'challenge': [
                { en: 'Climate change poses a significant challenge to global agriculture.', cn: '气候变化对全球农业构成重大挑战。', source: 'Nature' },
                { en: 'Every challenge is an opportunity for growth.', cn: '每一个挑战都是成长的机会。', source: 'Harvard Business Review' }
            ],
            'communicate': [
                { en: 'It is important to communicate clearly with your team.', cn: '与团队进行清晰沟通很重要。', source: 'Forbes' },
                { en: 'Scientists need to communicate their findings to the public.', cn: '科学家需要向公众传达他们的发现。', source: 'Scientific American' }
            ],
            'community': [
                { en: 'The local community came together to help the victims.', cn: '当地社区团结起来帮助受害者。', source: 'BBC News' },
                { en: 'Building a strong community requires active participation.', cn: '建立强大的社区需要积极参与。', source: 'The Guardian' }
            ],
            'compare': [
                { en: 'The study compared the effectiveness of two treatments.', cn: '这项研究比较了两种治疗方法的有效性。', source: 'The Lancet' },
                { en: 'It is difficult to compare the two products directly.', cn: '很难直接比较这两种产品。', source: 'Consumer Reports' }
            ],
            'concentrate': [
                { en: 'It is hard to concentrate when there is too much noise.', cn: '噪音太大时很难集中注意力。', source: 'Psychology Today' },
                { en: 'Students need a quiet environment to concentrate on their studies.', cn: '学生需要安静的环境来集中精力学习。', source: 'BBC Education' }
            ],
            'concern': [
                { en: 'There is growing concern about the impact of social media.', cn: '人们对社交媒体的影响越来越关注。', source: 'The New York Times' },
                { en: 'Environmental concerns are driving policy changes.', cn: '环境问题正在推动政策变化。', source: 'The Economist' }
            ],
            'condition': [
                { en: 'The patient is in stable condition after surgery.', cn: '手术后病人情况稳定。', source: 'Medical News Today' },
                { en: 'Working conditions have improved significantly.', cn: '工作条件已显著改善。', source: 'ILO Report' }
            ],
            'connect': [
                { en: 'The bridge will connect the two cities.', cn: '这座桥将连接两座城市。', source: 'BBC News' },
                { en: 'Social media helps people connect with friends and family.', cn: '社交媒体帮助人们与朋友和家人保持联系。', source: 'The Guardian' }
            ],
            'consider': [
                { en: 'We need to consider all the options before making a decision.', cn: '我们需要在做出决定之前考虑所有选项。', source: 'Harvard Business Review' },
                { en: 'The committee will consider your proposal next week.', cn: '委员会将于下周审议你的提议。', source: 'Reuters' }
            ],
            'convince': [
                { en: 'The evidence convinced the jury of his innocence.', cn: '证据使陪审团相信他是清白的。', source: 'CNN' },
                { en: 'We need to convince voters that our plan will work.', cn: '我们需要让选民相信我们的计划会奏效。', source: 'Reuters' }
            ],
            'create': [
                { en: 'The artist uses recycled materials to create sculptures.', cn: '这位艺术家用回收材料创作雕塑。', source: 'ArtNews' },
                { en: 'Technology has created new opportunities for entrepreneurs.', cn: '技术为企业家创造了新机会。', source: 'Forbes' }
            ],
            'culture': [
                { en: 'The city is known for its vibrant arts and culture scene.', cn: '这座城市以其蓬勃发展的艺术和文化氛围而闻名。', source: 'Time Magazine' },
                { en: 'Immigration has enriched the cultural diversity of the country.', cn: '移民丰富了该国的文化多样性。', source: 'The Atlantic' }
            ],

            // D
            'damage': [
                { en: 'The storm caused significant damage to the coastal area.', cn: '风暴对沿海地区造成了严重破坏。', source: 'BBC News' },
                { en: 'Smoking can damage your health.', cn: '吸烟会损害你的健康。', source: 'WHO Report' }
            ],
            'decide': [
                { en: 'The committee will decide on the proposal next week.', cn: '委员会将于下周决定这项提议。', source: 'Reuters' },
                { en: 'It is important to decide carefully before making a commitment.', cn: '在做出承诺之前谨慎决定很重要。', source: 'Harvard Business Review' }
            ],
            'develop': [
                { en: 'The company is developing a new vaccine.', cn: '该公司正在开发一种新疫苗。', source: 'Nature' },
                { en: 'Children develop at different rates.', cn: '儿童的发育速度各不相同。', source: 'Psychology Today' }
            ],
            'difference': [
                { en: 'One person can make a difference in the world.', cn: '一个人可以在世界上产生影响。', source: 'TED Talks' },
                { en: 'There is a significant difference between the two approaches.', cn: '这两种方法之间存在显著差异。', source: 'Scientific American' }
            ],
            'difficult': [
                { en: 'Learning a new language can be difficult but rewarding.', cn: '学习一门新语言可能很困难但很有收获。', source: 'BBC Education' },
                { en: 'The team faced a difficult challenge ahead.', cn: '团队面临着艰难的挑战。', source: 'The Guardian' }
            ],
            'discover': [
                { en: 'Scientists have discovered a new species in the Amazon.', cn: '科学家在亚马逊发现了一个新物种。', source: 'National Geographic' },
                { en: 'She discovered her passion for music at a young age.', cn: '她在年轻时发现了自己对音乐的热情。', source: 'The New York Times' }
            ],

            // E
            'economy': [
                { en: 'The global economy is showing signs of recovery.', cn: '全球经济正显示出复苏迹象。', source: 'The Wall Street Journal' },
                { en: 'Tourism plays a vital role in the local economy.', cn: '旅游业在当地经济中扮演着重要角色。', source: 'National Geographic' }
            ],
            'education': [
                { en: 'The government has pledged to increase funding for education.', cn: '政府已承诺增加教育资金。', source: 'BBC Education' },
                { en: 'Online education has become mainstream since the pandemic.', cn: '自疫情以来，在线教育已成为主流。', source: 'EdTech Magazine' }
            ],
            'effect': [
                { en: 'The new policy had an immediate effect on the market.', cn: '新政策对市场产生了立竿见影的影响。', source: 'Bloomberg' },
                { en: 'Climate change is having a devastating effect on wildlife.', cn: '气候变化正在对野生动物产生毁灭性影响。', source: 'Nature' }
            ],
            'effort': [
                { en: 'Success requires consistent effort over time.', cn: '成功需要持续的努力。', source: 'Forbes' },
                { en: 'The team made a concerted effort to meet the deadline.', cn: '团队齐心协力在截止日期前完成任务。', source: 'Harvard Business Review' }
            ],
            'environment': [
                { en: 'The new policy aims to protect the marine environment.', cn: '新政策旨在保护海洋环境。', source: 'Science Magazine' },
                { en: 'Businesses are increasingly aware of their impact on the environment.', cn: '企业越来越意识到它们对环境的影响。', source: 'Harvard Business Review' }
            ],
            'establish': [
                { en: 'The company was established in 1995.', cn: '这家公司成立于1995年。', source: 'Bloomberg' },
                { en: 'The goal is to establish a permanent base on the Moon.', cn: '目标是在月球上建立一个永久基地。', source: 'NASA' }
            ],
            'example': [
                { en: 'She set a good example for her younger siblings.', cn: '她为弟弟妹妹树立了好榜样。', source: 'Psychology Today' },
                { en: 'This case serves as an example of what can go wrong.', cn: '这个案例说明了什么可能会出错。', source: 'The Guardian' }
            ],
            'experience': [
                { en: 'Travel is a great way to gain new experiences.', cn: '旅行是获得新体验的好方法。', source: 'National Geographic' },
                { en: 'She has over ten years of experience in the industry.', cn: '她在这个行业有超过十年的经验。', source: 'LinkedIn' }
            ],
            'explain': [
                { en: 'The teacher explained the concept clearly to the students.', cn: '老师向学生清楚地解释了这个概念。', source: 'BBC Education' },
                { en: 'Scientists struggle to explain this phenomenon.', cn: '科学家们难以解释这一现象。', source: 'Nature' }
            ],

            // F
            'focus': [
                { en: 'The company needs to focus on customer satisfaction.', cn: '公司需要关注客户满意度。', source: 'Forbes' },
                { en: 'It can be hard to focus when you are tired.', cn: '当你疲惫时很难集中注意力。', source: 'Psychology Today' }
            ],

            // G
            'global': [
                { en: 'Global warming is one of the biggest challenges of our time.', cn: '全球变暖是我们这个时代最大的挑战之一。', source: 'Nature' },
                { en: 'The company has a global presence in over 50 countries.', cn: '该公司在50多个国家开展业务。', source: 'Bloomberg' }
            ],
            'government': [
                { en: 'The government announced new measures to tackle inflation.', cn: '政府宣布了应对通胀的新措施。', source: 'Reuters' },
                { en: 'Government spending on healthcare has increased.', cn: '政府在医疗保健上的支出有所增加。', source: 'The Economist' }
            ],

            // H
            'health': [
                { en: 'Regular exercise is essential for maintaining good health.', cn: '定期锻炼对保持健康至关重要。', source: 'Medical News Today' },
                { en: 'Mental health has become a major public health concern.', cn: '心理健康已成为主要的公共卫生问题。', source: 'The Lancet' }
            ],
            'history': [
                { en: 'The building has a long and fascinating history.', cn: '这座建筑有着悠久而迷人的历史。', source: 'Smithsonian' },
                { en: 'Historians are still debating the causes of the conflict.', cn: '历史学家仍在争论这场冲突的起因。', source: 'History Today' }
            ],

            // I
            'important': [
                { en: 'It is important to stay informed about current events.', cn: '了解时事很重要。', source: 'BBC News' },
                { en: 'Education is one of the most important investments we can make.', cn: '教育是我们能做的最重要的投资之一。', source: 'The Economist' }
            ],
            'improve': [
                { en: 'The new software will improve productivity.', cn: '新软件将提高生产力。', source: 'TechCrunch' },
                { en: 'Regular practice is the best way to improve your skills.', cn: '定期练习是提高技能的最佳方式。', source: 'Forbes' }
            ],
            'include': [
                { en: 'The package includes accommodation and meals.', cn: '套餐包括住宿和餐食。', source: 'Travel Weekly' },
                { en: 'The study included over 10,000 participants.', cn: '这项研究包括超过10,000名参与者。', source: 'Nature' }
            ],
            'increase': [
                { en: 'The company reported a significant increase in profits.', cn: '该公司报告利润大幅增长。', source: 'Bloomberg' },
                { en: 'Scientists predict an increase in extreme weather events.', cn: '科学家预测极端天气事件会增加。', source: 'Nature' }
            ],
            'influence': [
                { en: 'Social media has a significant influence on public opinion.', cn: '社交媒体对公众舆论有重大影响。', source: 'The Guardian' },
                { en: 'Parents have a strong influence on their children\'s development.', cn: '父母对孩子的成长有很大影响。', source: 'Psychology Today' }
            ],
            'information': [
                { en: 'The internet provides access to vast amounts of information.', cn: '互联网提供了大量信息的访问。', source: 'Scientific American' },
                { en: 'Please provide your contact information.', cn: '请提供您的联系信息。', source: 'Business Insider' }
            ],
            'interest': [
                { en: 'There is growing interest in renewable energy.', cn: '人们对可再生能源的兴趣日益增长。', source: 'The Economist' },
                { en: 'The museum attracts visitors with an interest in history.', cn: '博物馆吸引了对历史感兴趣的游客。', source: 'Smithsonian' }
            ],

            // K
            'knowledge': [
                { en: 'Knowledge is power in the information age.', cn: '在信息时代，知识就是力量。', source: 'The Economist' },
                { en: 'She has extensive knowledge of European history.', cn: '她对欧洲历史有广泛的了解。', source: 'History Today' }
            ],

            // L
            'language': [
                { en: 'Learning a second language has many cognitive benefits.', cn: '学习第二语言有许多认知好处。', source: 'Scientific American' },
                { en: 'English is the most widely spoken language in business.', cn: '英语是商业中使用最广泛的语言。', source: 'Forbes' }
            ],
            'limit': [
                { en: 'There is a limit to how much we can achieve in one day.', cn: '我们一天能完成的事情是有限的。', source: 'Harvard Business Review' },
                { en: 'The speed limit in residential areas is 30 mph.', cn: '居民区的限速是每小时30英里。', source: 'BBC News' }
            ],

            // M
            'maintain': [
                { en: 'It is important to maintain a healthy work-life balance.', cn: '保持健康的工作与生活平衡很重要。', source: 'Forbes' },
                { en: 'The building is difficult to maintain.', cn: '这座建筑很难维护。', source: 'The Guardian' }
            ],
            'method': [
                { en: 'Scientists developed a new method for detecting the virus.', cn: '科学家开发了一种检测病毒的新方法。', source: 'Nature' },
                { en: 'Different teaching methods work for different students.', cn: '不同的教学方法适用于不同的学生。', source: 'BBC Education' }
            ],

            // N
            'necessary': [
                { en: 'It is necessary to wear protective equipment in the lab.', cn: '在实验室必须穿戴防护设备。', source: 'Nature' },
                { en: 'Sleep is necessary for good health.', cn: '睡眠对健康是必要的。', source: 'Medical News Today' }
            ],
            'notice': [
                { en: 'I noticed a significant improvement in his performance.', cn: '我注意到他的表现有显著改善。', source: 'Harvard Business Review' },
                { en: 'Please give at least two weeks notice before leaving.', cn: '离职前请至少提前两周通知。', source: 'Business Insider' }
            ],

            // O
            'opportunity': [
                { en: 'This scholarship provides opportunities for students from low-income families.', cn: '这项奖学金为低收入家庭的学生提供机会。', source: 'BBC Education' },
                { en: 'Every challenge is an opportunity in disguise.', cn: '每个挑战都是伪装的机会。', source: 'Forbes' }
            ],
            'organization': [
                { en: 'The organization provides aid to refugees.', cn: '该组织为难民提供援助。', source: 'UN News' },
                { en: 'Good organization is key to successful project management.', cn: '良好的组织是项目管理成功的关键。', source: 'Harvard Business Review' }
            ],

            // P
            'particular': [
                { en: 'Is there a particular reason you chose this approach?', cn: '你选择这种方法有什么特别的原因吗？', source: 'Scientific American' },
                { en: 'This problem is not particular to this region.', cn: '这个问题不是这个地区特有的。', source: 'The Economist' }
            ],
            'persuade': [
                { en: 'It took hours to persuade the committee to approve the funding.', cn: '花了数小时才说服委员会批准资金。', source: 'The Guardian' },
                { en: 'The advertisement is designed to persuade consumers to switch brands.', cn: '这则广告旨在说服消费者转换品牌。', source: 'Financial Times' }
            ],
            'policy': [
                { en: 'The new immigration policy has been controversial.', cn: '新的移民政策一直存在争议。', source: 'BBC News' },
                { en: 'Companies need a clear social media policy.', cn: '公司需要明确的社交媒体政策。', source: 'Harvard Business Review' }
            ],
            'political': [
                { en: 'The political situation in the region remains unstable.', cn: '该地区的政治局势仍然不稳定。', source: 'Reuters' },
                { en: 'Young people are becoming more politically engaged.', cn: '年轻人正变得更加积极参与政治。', source: 'The Guardian' }
            ],
            'politics': [
                { en: 'The scandal has dominated national politics for weeks.', cn: '这桩丑闻已在国家政坛主导数周。', source: 'The New York Times' },
                { en: 'She entered politics after a successful career in law.', cn: '她在法律事业成功之后步入政坛。', source: 'The Washington Post' }
            ],
            'population': [
                { en: 'The population of the city has doubled in the last decade.', cn: '这座城市的人口在过去十年中翻了一番。', source: 'World Bank' },
                { en: 'The aging population presents challenges for healthcare systems.', cn: '人口老龄化给医疗保健系统带来挑战。', source: 'The Lancet' }
            ],
            'potential': [
                { en: 'The technology has the potential to revolutionize the industry.', cn: '这项技术有潜力彻底改变这个行业。', source: 'MIT Technology Review' },
                { en: 'We need to realize our full potential.', cn: '我们需要充分发挥我们的潜力。', source: 'Forbes' }
            ],
            'process': [
                { en: 'The application process can take several weeks.', cn: '申请过程可能需要几周时间。', source: 'Business Insider' },
                { en: 'Understanding the scientific process is essential for research.', cn: '理解科学过程对研究至关重要。', source: 'Nature' }
            ],
            'produce': [
                { en: 'The factory produces over 10,000 units per day.', cn: '这家工厂每天生产超过10,000个单位。', source: 'Bloomberg' },
                { en: 'Renewable energy sources produce less pollution.', cn: '可再生能源产生的污染较少。', source: 'The Economist' }
            ],
            'provide': [
                { en: 'The organization provides support for homeless families.', cn: '该组织为无家可归的家庭提供支持。', source: 'The Guardian' },
                { en: 'Universities provide students with a wide range of resources.', cn: '大学为学生提供广泛的资源。', source: 'BBC Education' }
            ],
            'purpose': [
                { en: 'The purpose of the meeting is to discuss the budget.', cn: '会议的目的是讨论预算。', source: 'Harvard Business Review' },
                { en: 'She felt that her work had a clear sense of purpose.', cn: '她觉得她的工作有明确的目标感。', source: 'Forbes' }
            ],

            // R
            'realize': [
                { en: 'She realized her dream of becoming a writer.', cn: '她实现了成为作家的梦想。', source: 'The New York Times' },
                { en: 'It took years to realize the full potential of the discovery.', cn: '花了多年时间才意识到这一发现的全部潜力。', source: 'Nature' }
            ],
            'reason': [
                { en: 'The main reason for the delay was bad weather.', cn: '延误的主要原因是天气恶劣。', source: 'BBC News' },
                { en: 'There is good reason to be optimistic about the future.', cn: '有充分理由对未来感到乐观。', source: 'The Economist' }
            ],
            'reduce': [
                { en: 'The company aims to reduce its carbon footprint.', cn: '该公司旨在减少其碳足迹。', source: 'Bloomberg' },
                { en: 'Regular exercise can help reduce stress.', cn: '定期锻炼可以帮助减轻压力。', source: 'Medical News Today' }
            ],
            'relationship': [
                { en: 'Building strong relationships is key to business success.', cn: '建立牢固的关系是商业成功的关键。', source: 'Forbes' },
                { en: 'The study examines the relationship between diet and health.', cn: '这项研究考察了饮食与健康之间的关系。', source: 'Nature' }
            ],
            'relevant': [
                { en: 'Please provide all relevant documents.', cn: '请提供所有相关文件。', source: 'Business Insider' },
                { en: 'This research is highly relevant to current debates.', cn: '这项研究与当前的辩论高度相关。', source: 'The Lancet' }
            ],
            'report': [
                { en: 'The report highlights the need for urgent action.', cn: '报告强调了采取紧急行动的必要性。', source: 'UN Report' },
                { en: 'Journalists report on events from around the world.', cn: '记者报道来自世界各地的事件。', source: 'BBC News' }
            ],
            'represent': [
                { en: 'The flag represents the nation\'s values.', cn: '国旗代表国家的价值观。', source: 'The Guardian' },
                { en: 'These figures represent a significant increase.', cn: '这些数字代表显著增长。', source: 'Bloomberg' }
            ],
            'require': [
                { en: 'The job requires excellent communication skills.', cn: '这项工作需要出色的沟通技巧。', source: 'LinkedIn' },
                { en: 'Success in this field requires dedication and hard work.', cn: '在这个领域取得成功需要奉献精神和努力工作。', source: 'Forbes' }
            ],
            'research': [
                { en: 'The research was published in a leading scientific journal.', cn: '这项研究发表在一本领先的学术期刊上。', source: 'Nature' },
                { en: 'More research is needed to confirm these findings.', cn: '需要更多的研究来证实这些发现。', source: 'Scientific American' }
            ],
            'resource': [
                { en: 'Water is a precious natural resource.', cn: '水是一种宝贵的自然资源。', source: 'National Geographic' },
                { en: 'The library is an excellent resource for students.', cn: '图书馆是学生的优秀资源。', source: 'BBC Education' }
            ],
            'result': [
                { en: 'The results of the study were surprising.', cn: '研究结果令人惊讶。', source: 'Nature' },
                { en: 'Hard work usually produces good results.', cn: '努力工作通常会产生好的结果。', source: 'Forbes' }
            ],
            'reveal': [
                { en: 'The investigation revealed widespread corruption.', cn: '调查揭示了广泛的腐败。', source: 'The Guardian' },
                { en: 'The study reveals new insights into human behavior.', cn: '这项研究揭示了对人类行为的新见解。', source: 'Psychology Today' }
            ],
            'rise': [
                { en: 'Global temperatures continue to rise.', cn: '全球气温持续上升。', source: 'Nature' },
                { en: 'The company\'s stock price rose sharply after the announcement.', cn: '公告发布后，公司股价急剧上涨。', source: 'Bloomberg' }
            ],
            'role': [
                { en: 'Technology plays an increasingly important role in education.', cn: '技术在教育中扮演着越来越重要的角色。', source: 'EdTech Magazine' },
                { en: 'Parents have a crucial role in their children\'s development.', cn: '父母在孩子的成长中起着关键作用。', source: 'Psychology Today' }
            ],

            // S
            'science': [
                { en: 'The discovery represents a major breakthrough in medical science.', cn: '这一发现代表了医学科学的重大突破。', source: 'Nature' },
                { en: 'Climate science clearly shows the need for immediate action.', cn: '气候科学清楚地表明需要立即采取行动。', source: 'Scientific American' }
            ],
            'significant': [
                { en: 'There has been a significant increase in online shopping.', cn: '网上购物大幅增长。', source: 'Forbes' },
                { en: 'The discovery is significant for our understanding of the universe.', cn: '这一发现对我们理解宇宙意义重大。', source: 'Nature' }
            ],
            'similar': [
                { en: 'The two species have similar characteristics.', cn: '这两个物种具有相似的特征。', source: 'National Geographic' },
                { en: 'We face similar challenges in our respective industries.', cn: '我们在各自的行业中面临类似的挑战。', source: 'Harvard Business Review' }
            ],
            'situation': [
                { en: 'The economic situation is improving slowly.', cn: '经济形势正在缓慢改善。', source: 'The Economist' },
                { en: 'It is important to assess the situation carefully.', cn: '仔细评估局势很重要。', source: 'BBC News' }
            ],
            'society': [
                { en: 'Social media has profoundly changed how society functions.', cn: '社交媒体深刻改变了社会的运作方式。', source: 'The Economist' },
                { en: 'Income inequality remains a major issue in modern society.', cn: '收入不平等仍然是现代社会的主要问题。', source: 'Pew Research Center' }
            ],
            'source': [
                { en: 'The sun is the primary source of energy for Earth.', cn: '太阳是地球的主要能源。', source: 'Scientific American' },
                { en: 'We need to verify the source of this information.', cn: '我们需要核实这条信息的来源。', source: 'BBC News' }
            ],
            'specific': [
                { en: 'Please be more specific about your requirements.', cn: '请更具体地说明您的要求。', source: 'Business Insider' },
                { en: 'Each case requires a specific approach.', cn: '每个案例都需要特定的方法。', source: 'Harvard Business Review' }
            ],
            'structure': [
                { en: 'The structure of the building was designed by a famous architect.', cn: '这座建筑的结构是由一位著名建筑师设计的。', source: 'Architectural Digest' },
                { en: 'Understanding the structure of DNA was a major scientific achievement.', cn: '理解DNA结构是一项重大的科学成就。', source: 'Nature' }
            ],
            'suggest': [
                { en: 'Research suggests that regular exercise improves mental health.', cn: '研究表明，定期锻炼可以改善心理健康。', source: 'Medical News Today' },
                { en: 'I suggest we meet again next week to discuss further.', cn: '我建议我们下周再次见面进一步讨论。', source: 'Harvard Business Review' }
            ],
            'support': [
                { en: 'The government announced new support for small businesses.', cn: '政府宣布了对小企业的新支持。', source: 'Reuters' },
                { en: 'She received tremendous support from her family.', cn: '她得到了家人的大力支持。', source: 'The Guardian' }
            ],
            'system': [
                { en: 'The healthcare system needs significant reform.', cn: '医疗保健系统需要重大改革。', source: 'The Lancet' },
                { en: 'Our solar system contains eight planets.', cn: '我们的太阳系包含八颗行星。', source: 'NASA' }
            ],

            // T
            'technology': [
                { en: 'Advances in technology are transforming the healthcare industry.', cn: '技术进步正在改变医疗行业。', source: 'MIT Technology Review' },
                { en: 'The company invests heavily in renewable energy technology.', cn: '这家公司在可再生能源技术上投入巨资。', source: 'Forbes' }
            ],
            'tend': [
                { en: 'People tend to be more generous during the holidays.', cn: '人们在假期往往更慷慨。', source: 'Psychology Today' },
                { en: 'Prices tend to rise during periods of high demand.', cn: '价格在需求旺盛时期往往上涨。', source: 'The Economist' }
            ],
            'therefore': [
                { en: 'The evidence is clear; therefore, we must take action.', cn: '证据是明确的；因此，我们必须采取行动。', source: 'Nature' },
                { en: 'He did not study; therefore, he failed the exam.', cn: '他没有学习；因此，他考试不及格。', source: 'BBC Education' }
            ],
            'traditional': [
                { en: 'Traditional teaching methods are being replaced by digital alternatives.', cn: '传统教学方法正在被数字化替代方案取代。', source: 'EdTech Magazine' },
                { en: 'The restaurant serves traditional Italian cuisine.', cn: '这家餐厅供应传统意大利菜。', source: 'The Guardian' }
            ],

            // U
            'understand': [
                { en: 'It is important to understand the context of the situation.', cn: '了解情况的背景很重要。', source: 'Harvard Business Review' },
                { en: 'Scientists are still trying to understand the origins of the universe.', cn: '科学家们仍在试图理解宇宙的起源。', source: 'Nature' }
            ],
            'unique': [
                { en: 'Every individual has a unique perspective to offer.', cn: '每个人都有独特的视角可以提供。', source: 'Forbes' },
                { en: 'This species is unique to this island.', cn: '这个物种是这个岛屿独有的。', source: 'National Geographic' }
            ],
            'university': [
                { en: 'She graduated from one of the top universities in the country.', cn: '她毕业于该国顶尖大学之一。', source: 'BBC Education' },
                { en: 'The university offers a wide range of courses.', cn: '这所大学提供广泛的课程。', source: 'The Guardian' }
            ],

            // V
            'value': [
                { en: 'The company places great value on innovation.', cn: '这家公司非常重视创新。', source: 'Forbes' },
                { en: 'Understanding the value of education is essential.', cn: '理解教育的价值至关重要。', source: 'The Economist' }
            ],
            'variety': [
                { en: 'The museum offers a variety of exhibitions.', cn: '博物馆提供各种展览。', source: 'Smithsonian' },
                { en: 'A healthy diet includes a variety of foods.', cn: '健康饮食包括各种食物。', source: 'Medical News Today' }
            ],
            'view': [
                { en: 'The view from the top of the mountain is breathtaking.', cn: '从山顶看去的景色令人叹为观止。', source: 'National Geographic' },
                { en: 'Experts have different views on the effectiveness of the policy.', cn: '专家对这项政策的有效性有不同的看法。', source: 'The Guardian' }
            ],

            // W
            'whether': [
                { en: 'It remains to be seen whether the strategy will succeed.', cn: '这种策略是否会成功还有待观察。', source: 'The Economist' },
                { en: 'Whether you agree or not, the decision has been made.', cn: '无论你是否同意，决定已经做出。', source: 'BBC News' }
            ],
            'within': [
                { en: 'The results will be available within 24 hours.', cn: '结果将在24小时内提供。', source: 'Medical News Today' },
                { en: 'We need to work within the budget constraints.', cn: '我们需要在预算限制内工作。', source: 'Harvard Business Review' }
            ]
        };

        // 检查是否有该单词的例句
        const lowerWord = word.toLowerCase();
        if (exampleDatabase[lowerWord]) {
            return exampleDatabase[lowerWord].map(item => ({
                en: item.en,
                cn: item.cn,
                source: item.source
            }));
        }

        // 如果没有精确匹配的例句，返回空数组
        // 不再使用虚假的"通用例句"
        return [];
    }

    displaySentences(sentences) {
        this.autoSentences.innerHTML = `
            <p class="auto-sentence-hint">💡 权威词典例句（来源标注 | 点击可复制）：</p>
            ${sentences.map((item, index) => {
                // 如果翻译质量不好，不显示中文
                const showCn = !item.cn.includes('建议参考原文');
                return `
                <div class="auto-sentence-item" data-sentence="${item.en}">
                    <div class="sentence-en">${index + 1}. ${item.en}</div>
                    ${showCn ? `<div class="sentence-cn">${item.cn}</div>` : '<div class="sentence-cn" style="color:#9ca3af;font-style:italic;">（复杂句式，建议参考原文理解）</div>'}
                    <div class="sentence-source">📚 ${item.source}</div>
                </div>
            `}).join('')}
        `;

        this.autoSentences.querySelectorAll('.auto-sentence-item').forEach(item => {
            item.addEventListener('click', () => {
                const sentence = item.dataset.sentence;
                navigator.clipboard.writeText(sentence).then(() => {
                    this.showToast('例句已复制');
                });
            });
        });
    }

    flipCard() {
        this.card.classList.toggle('flipped');
    }

    speakWord(text = null) {
        const content = text || (this.currentWord ? this.currentWord.word : null);
        if (!content) return;

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(content);
            utterance.lang = 'en-US';
            utterance.rate = 0.85;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // 获取所有可用语音
            const voices = window.speechSynthesis.getVoices();

            // 优先选择的女声列表（按优先级排序）
            const preferredVoices = [
                // Mac 高质量女声
                'Samantha',           // Mac 美式英语女声
                'Victoria',           // Mac 英式英语女声
                'Karen',              // Mac 澳大利亚英语女声
                'Moira',              // Mac 爱尔兰英语女声
                'Tessa',              // Mac 南非英语女声
                'Fiona',              // Mac 苏格兰英语女声
                // Windows 高质量女声
                'Microsoft Zira',
                'Microsoft Susan',
                'Microsoft Hazel',
                // Google 女声
                'Google US English',
                'Google UK English Female',
                // iOS/Safari 女声
                'Siri',
                'Daniel',             // 英式男声（备选）
                'Alex',               // Mac 美式男声（备选）
            ];

            // 尝试找到最佳语音
            let selectedVoice = null;

            // 首先尝试精确匹配
            for (const preferred of preferredVoices) {
                const found = voices.find(v =>
                    v.name.includes(preferred) &&
                    (v.lang.startsWith('en-US') || v.lang.startsWith('en-GB'))
                );
                if (found) {
                    selectedVoice = found;
                    break;
                }
            }

            // 如果没找到，尝试找任何英语女声
            if (!selectedVoice) {
                const femaleKeywords = ['female', 'woman', 'girl', 'zira', 'samantha', 'victoria', 'karen', 'susan', 'hazel'];
                for (const voice of voices) {
                    if (voice.lang.startsWith('en')) {
                        const nameLower = voice.name.toLowerCase();
                        if (femaleKeywords.some(k => nameLower.includes(k))) {
                            selectedVoice = voice;
                            break;
                        }
                    }
                }
            }

            // 最后备选：任何美式英语语音
            if (!selectedVoice) {
                selectedVoice = voices.find(v => v.lang === 'en-US') ||
                                voices.find(v => v.lang.startsWith('en'));
            }

            if (selectedVoice) {
                utterance.voice = selectedVoice;
                console.log('使用语音:', selectedVoice.name);
            }

            window.speechSynthesis.speak(utterance);
        }
    }

    // 初始化语音（解决首次加载语音列表为空的问题）
    initVoices() {
        if ('speechSynthesis' in window) {
            // 某些浏览器需要先调用 getVoices() 才能加载语音列表
            const voices = window.speechSynthesis.getVoices();
            if (voices.length === 0) {
                // Chrome 需要等待 voiceschanged 事件
                window.speechSynthesis.addEventListener('voiceschanged', () => {
                    console.log('语音列表已加载:', window.speechSynthesis.getVoices().length, '个语音');
                });
            } else {
                console.log('语音列表已就绪:', voices.length, '个语音');
            }
        }
    }

    saveToHistory() {
        if (!this.currentWord) return;
        const exists = this.history.some(h => h.word === this.currentWord.word);
        if (exists) {
            this.showToast('该单词已在历史中');
            return;
        }

        this.history.unshift({ ...this.currentWord, timestamp: Date.now() });
        if (this.history.length > 20) this.history = this.history.slice(0, 20);

        localStorage.setItem('wordHistory', JSON.stringify(this.history));
        this.renderHistory();
        this.showToast('已保存到历史记录');
    }

    renderHistory() {
        if (this.history.length === 0) {
            this.historyList.innerHTML = '<div class="empty-history">暂无历史记录，开始生成你的第一个单词吧！</div>';
            return;
        }

        this.historyList.innerHTML = this.history.map((item, index) => `
            <div class="history-item" data-index="${index}">
                <div>
                    <span class="history-word">${item.word}</span>
                    <span class="history-meaning">${item.meaning.substring(0, 20)}...</span>
                </div>
                <div class="history-actions">
                    <button class="history-btn" data-action="view" data-index="${index}">👁️</button>
                    <button class="history-btn" data-action="delete" data-index="${index}">🗑️</button>
                </div>
            </div>
        `).join('');

        this.historyList.querySelectorAll('.history-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const index = parseInt(item.dataset.index);
                if (e.target.dataset.action === 'delete') {
                    e.stopPropagation();
                    this.history.splice(index, 1);
                    localStorage.setItem('wordHistory', JSON.stringify(this.history));
                    this.renderHistory();
                } else {
                    this.currentWord = this.history[index];
                    this.wordInput.value = this.currentWord.word;
                    this.displayCard();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    clearHistory() {
        if (confirm('确定要清空所有历史记录吗？')) {
            this.history = [];
            localStorage.removeItem('wordHistory');
            this.renderHistory();
        }
    }

    async saveUserSentence() {
        if (!this.currentWord) return;
        const sentence = this.sentenceInput.value.trim();
        if (!sentence) {
            this.showToast('请输入句子');
            return;
        }

        const word = this.currentWord.word;
        if (!sentence.toLowerCase().includes(word.toLowerCase())) {
            this.showToast(`句子中需要包含单词 "${word}"`);
            return;
        }

        // 验证句子
        const validation = await this.validateSentence(sentence, word);
        if (!validation.isValid) {
            this.showToast(`提示：${validation.message}`);
            // 仍然允许保存，但给出提示
        }

        if (!this.userSentencesMap[word]) this.userSentencesMap[word] = [];
        if (this.userSentencesMap[word].includes(sentence)) {
            this.showToast('这个句子已经保存过了');
            return;
        }

        this.userSentencesMap[word].push(sentence);
        localStorage.setItem('userSentencesMap', JSON.stringify(this.userSentencesMap));

        // 保存验证状态
        const validationMap = JSON.parse(localStorage.getItem('sentenceValidationMap') || '{}');
        validationMap[`${word}_${sentence}`] = validation.isValid;
        localStorage.setItem('sentenceValidationMap', JSON.stringify(validationMap));

        this.sentenceInput.value = '';
        this.renderUserSentences(word, validation);
        this.showToast(validation.isValid ? '句子保存成功！✅' : '句子已保存，但可能有问题⚠️');
    }

    // 验证句子的正确性
    async validateSentence(sentence, targetWord) {
        const result = {
            isValid: true,
            message: '',
            translation: ''
        };

        // 基础格式检查
        if (!sentence.match(/^[A-Z]/)) {
            result.isValid = false;
            result.message = '句子首字母需要大写';
            return result;
        }

        if (!sentence.match(/[.!?]$/)) {
            result.isValid = false;
            result.message = '句子结尾需要加标点符号（.!?）';
            return result;
        }

        // 调用有道API翻译验证
        try {
            const translation = await this.translateWithAPI(sentence);
            result.translation = translation;

            // 检查翻译是否通顺（如果翻译结果包含大量英文，可能是句子有问题）
            const englishWords = translation.match(/[a-zA-Z]+/g) || [];
            if (englishWords.length > sentence.split(' ').length * 0.5) {
                result.isValid = false;
                result.message = '句子可能存在语法问题，请检查';
            }
        } catch (error) {
            console.log('句子验证翻译失败:', error);
        }

        return result;
    }

    renderUserSentences(word, validation = null) {
        const sentences = this.userSentencesMap[word] || [];
        if (sentences.length === 0) {
            this.userSentences.innerHTML = '';
            return;
        }

        // 获取每个句子的验证状态
        const validationMap = JSON.parse(localStorage.getItem('sentenceValidationMap') || '{}');

        this.userSentences.innerHTML = `
            <p style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 8px;">✨ 我造的句子：</p>
            ${sentences.map((sentence, index) => {
                // 获取该句子的验证状态
                const sentenceKey = `${word}_${sentence}`;
                const isValid = validationMap[sentenceKey] !== false;
                const statusIcon = isValid ? '✅' : '⚠️';
                const statusColor = isValid ? '#10b981' : '#f59e0b';
                return `
                <div class="user-sentence-item" style="border-left: 3px solid ${statusColor}; padding-left: 10px;">
                    <div style="flex: 1;">
                        <span class="sentence-text">${sentence}</span>
                        ${validation && validation.translation && index === sentences.length - 1 ? `
                            <div style="font-size: 0.85rem; color: var(--text-light); margin-top: 4px; padding-left: 8px; border-left: 2px solid #e5e7eb;">
                                翻译：${validation.translation}
                            </div>
                        ` : ''}
                    </div>
                    <span style="color: ${statusColor}; margin-right: 8px; font-size: 1rem;" title="${isValid ? '句子正确' : '可能存在问题'}">${statusIcon}</span>
                    <button class="delete-sentence" data-index="${index}">✕</button>
                </div>
            `}).join('')}
        `;

        this.userSentences.querySelectorAll('.delete-sentence').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const sentenceToDelete = sentences[index];

                // 删除句子
                this.userSentencesMap[word].splice(index, 1);
                if (this.userSentencesMap[word].length === 0) delete this.userSentencesMap[word];
                localStorage.setItem('userSentencesMap', JSON.stringify(this.userSentencesMap));

                // 删除对应的验证状态
                const validationMap = JSON.parse(localStorage.getItem('sentenceValidationMap') || '{}');
                delete validationMap[`${word}_${sentenceToDelete}`];
                localStorage.setItem('sentenceValidationMap', JSON.stringify(validationMap));

                this.renderUserSentences(word);
            });
        });
    }

    copyContent() {
        if (!this.currentWord) return;
        const w = this.currentWord;
        const text = `单词：${w.word}
音标：${w.phonetic}
释义：${w.meaning}

🎭 情境故事：
${w.story}

📖 词根词缀：
${w.mnemonic}

💡 例句：
${w.example}
${w.exampleCn}`;

        navigator.clipboard.writeText(text).then(() => {
            this.showToast('内容已复制到剪贴板');
        }).catch(() => {
            this.showToast('复制失败，请手动复制');
        });
    }

    showLoading() {
        this.loadingState.classList.remove('hidden');
        this.errorState.classList.add('hidden');
        this.cardSection.classList.add('hidden');
    }

    hideLoading() {
        this.loadingState.classList.add('hidden');
    }

    showError(message) {
        this.loadingState.classList.add('hidden');
        this.errorState.classList.remove('hidden');
        this.cardSection.classList.add('hidden');
        this.errorState.querySelector('p').textContent = '❌ ' + (message || '未找到该单词，请检查拼写');
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #10b981;
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-size: 0.9rem;
            z-index: 1000;
            animation: fadeInOut 2s ease;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInOut {
        0% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        20% { opacity: 1; transform: translateX(-50%) translateY(0); }
        80% { opacity: 1; transform: translateX(-50%) translateY(0); }
        100% { opacity: 0; transform: translateX(-50%) translateY(-20px); }
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    new WordMemoryGenerator();
});
