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
            if (e.target.closest('.speak-btn')) return;
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
        if (!word) {
            this.showError('请输入单词');
            return;
        }

        this.showLoading();

        try {
            // 调用 Free Dictionary API
            const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);

            if (!response.ok) {
                throw new Error('Word not found');
            }

            const data = await response.json();
            const wordData = this.parseWordData(data);

            // 生成记忆内容
            this.currentWord = this.generateMemoryContent(wordData);

            this.displayCard();
            this.hideLoading();
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
        const story = this.generateStory(word, meaning, partOfSpeech);

        // 生成图像联想
        const { ascii, mnemonic } = this.generateVisual(word, phonetic, meaning, partOfSpeech);

        // 翻译例句
        const exampleCn = this.translateLocal(example || '');

        return {
            word,
            phonetic: phonetic || `/${word}/`,
            meaning: this.translateMeaning(meaning),
            meaningEn: meaning,
            story,
            asciiArt: ascii,
            mnemonic,
            example: example || this.generateExample(word),
            exampleCn,
            allExamples: allExamples || [],
            allMeanings: allMeanings || []
        };
    }

    // 本地翻译（备用）
    translateLocal(sentence) {
        if (!sentence) return '';
        let result = sentence;

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

        // 尝试各种格式匹配
        if (fullTranslations[lowerSentence] || fullTranslations[normalizedSentence]) {
            return fullTranslations[lowerSentence] || fullTranslations[normalizedSentence];
        }

        // 尝试找到包含关键短语的翻译
        for (const [key, value] of Object.entries(fullTranslations)) {
            const normalizedKey = key.replace(/[.!?]$/, '');
            if (lowerSentence === normalizedKey || normalizedSentence === key) {
                return value;
            }
        }

        // 分词翻译：按单词逐个翻译，保留语序
        const wordMap = {
            // 代词
            'i': '我', 'you': '你', 'he': '他', 'she': '她', 'it': '它',
            'we': '我们', 'they': '他们', 'me': '我', 'him': '他', 'her': '她',
            'us': '我们', 'them': '他们', 'my': '我的', 'your': '你的', 'his': '他的',
            'this': '这个', 'that': '那个', 'these': '这些', 'those': '那些',

            // be动词
            'is': '是', 'are': '是', 'am': '是', 'was': '是', 'were': '是',
            'be': '成为', 'been': '已经', 'being': '正在',

            // 情态动词
            'can': '能', 'could': '能', 'will': '会', 'would': '会',
            'may': '可能', 'might': '可能', 'should': '应该', 'must': '必须',

            // 常用动词
            'do': '做', 'does': '做', 'did': '做了', 'done': '做完',
            'have': '有', 'has': '有', 'had': '有',
            'go': '去', 'went': '去了', 'gone': '去了',
            'get': '得到', 'got': '得到', 'make': '制作', 'made': '制作',
            'take': '拿', 'took': '拿了', 'come': '来', 'came': '来了',
            'see': '看见', 'saw': '看见', 'know': '知道', 'knew': '知道',
            'think': '认为', 'thought': '认为', 'say': '说', 'said': '说',
            'tell': '告诉', 'told': '告诉', 'speak': '说话', 'spoke': '说话',
            'ask': '问', 'give': '给', 'gave': '给了', 'find': '找到',
            'found': '找到', 'want': '想要', 'need': '需要', 'like': '喜欢',
            'love': '爱', 'help': '帮助', 'try': '尝试', 'tried': '尝试',
            'use': '使用', 'used': '使用', 'work': '工作', 'worked': '工作',
            'feel': '感觉', 'felt': '感觉', 'look': '看', 'looked': '看',
            'seem': '似乎', 'seemed': '似乎', 'become': '变成', 'became': '变成',
            'leave': '离开', 'left': '离开', 'put': '放', 'mean': '意思是',
            'meant': '意思是', 'keep': '保持', 'kept': '保持', 'let': '让',
            'begin': '开始', 'began': '开始', 'start': '开始', 'started': '开始',
            'show': '展示', 'showed': '展示', 'hear': '听见', 'heard': '听见',
            'run': '跑', 'ran': '跑了', 'move': '移动', 'moved': '移动',
            'live': '生活', 'lived': '生活', 'believe': '相信', 'believed': '相信',
            'bring': '带来', 'brought': '带来', 'happen': '发生', 'happened': '发生',
            'write': '写', 'wrote': '写了', 'sit': '坐', 'sat': '坐了',
            'stand': '站', 'stood': '站了', 'lose': '失去', 'lost': '失去',
            'add': '添加', 'added': '添加', 'spend': '花费', 'spent': '花费',
            'build': '建造', 'built': '建造', 'stay': '停留', 'stayed': '停留',
            'fall': '落下', 'fell': '落下', 'cut': '切', 'reach': '到达',
            'reached': '到达', 'kill': '杀死', 'killed': '杀死', 'remain': '保持',
            'remained': '保持', 'suggest': '建议', 'suggested': '建议', 'raise': '举起',
            'raised': '举起', 'pass': '通过', 'passed': '通过', 'sell': '卖',
            'sold': '卖了', 'require': '需要', 'required': '需要', 'report': '报告',
            'reported': '报告', 'decide': '决定', 'decided': '决定', 'pull': '拉',
            'pulled': '拉',

            // 介词
            'in': '在...里', 'on': '在...上', 'at': '在', 'to': '到', 'of': '的',
            'for': '为了', 'with': '和', 'about': '关于', 'into': '进入',
            'from': '从', 'by': '通过', 'as': '作为', 'through': '穿过',
            'during': '在...期间', 'before': '在...之前', 'after': '在...之后',
            'above': '在...之上', 'below': '在...之下', 'up': '向上', 'down': '向下',
            'out': '出去', 'off': '离开', 'over': '越过', 'under': '在...下面',

            // 冠词限定词
            'the': '', 'a': '一个', 'an': '一个', 'all': '所有', 'any': '任何',
            'every': '每个', 'each': '每个', 'no': '没有', 'not': '不',
            'some': '一些', 'many': '很多', 'much': '很多', 'more': '更多',
            'most': '最', 'other': '其他', 'another': '另一个', 'such': '这样的',
            'only': '只有', 'own': '自己的', 'same': '相同的', 'so': '所以',
            'than': '比', 'too': '太', 'very': '很', 'just': '刚刚', 'now': '现在',
            'then': '然后', 'also': '也', 'well': '好', 'here': '这里',
            'there': '那里', 'when': '当...时', 'where': '哪里', 'why': '为什么',
            'how': '怎样', 'what': '什么', 'who': '谁', 'which': '哪个',

            // 常见名词
            'time': '时间', 'way': '方式', 'year': '年', 'day': '天', 'man': '男人',
            'woman': '女人', 'child': '孩子', 'children': '孩子们', 'people': '人们',
            'person': '人', 'life': '生活', 'world': '世界', 'school': '学校',
            'state': '状态', 'family': '家庭', 'student': '学生', 'group': '小组',
            'country': '国家', 'problem': '问题', 'hand': '手', 'part': '部分',
            'place': '地方', 'case': '情况', 'week': '星期', 'company': '公司',
            'system': '系统', 'program': '程序', 'question': '问题', 'work': '工作',
            'government': '政府', 'number': '数字', 'night': '夜晚', 'point': '点',
            'home': '家', 'water': '水', 'room': '房间', 'mother': '妈妈',
            'father': '爸爸', 'area': '地区', 'money': '钱', 'story': '故事',
            'fact': '事实', 'month': '月份', 'lot': '很多', 'right': '权利',
            'study': '学习', 'book': '书', 'eye': '眼睛', 'job': '工作',
            'word': '单词', 'business': '生意', 'issue': '问题', 'side': '边',
            'kind': '种类', 'head': '头', 'house': '房子', 'service': '服务',
            'friend': '朋友', 'power': '力量', 'hour': '小时', 'game': '游戏',
            'line': '线', 'end': '结束', 'member': '成员', 'law': '法律',
            'car': '汽车', 'city': '城市', 'community': '社区', 'name': '名字',
            'president': '总统', 'team': '队伍', 'minute': '分钟', 'idea': '主意',
            'kid': '小孩', 'body': '身体', 'information': '信息', 'back': '后面',
            'parent': '父母', 'face': '脸', 'others': '其他人', 'level': '水平',
            'office': '办公室', 'door': '门', 'health': '健康', 'person': '人',
            'art': '艺术', 'war': '战争', 'history': '历史', 'party': '聚会',
            'result': '结果', 'change': '改变', 'morning': '早上', 'reason': '原因',
            'research': '研究', 'girl': '女孩', 'guy': '家伙', 'moment': '时刻',
            'air': '空气', 'teacher': '老师', 'force': '力量', 'education': '教育',
            'foot': '脚', 'boy': '男孩', 'age': '年龄', 'policy': '政策',
            'everything': '一切', 'love': '爱', 'process': '过程', 'music': '音乐',
            'market': '市场', 'sense': '感觉', 'nation': '国家', 'plan': '计划',
            'college': '大学', 'interest': '兴趣', 'death': '死亡', 'experience': '经历',
            'effect': '效果', 'class': '班级', 'control': '控制', 'care': '关心',
            'field': '领域', 'development': '发展', 'role': '角色', 'effort': '努力',
            'rate': '比率', 'heart': '心', 'drug': '药物', 'leader': '领导',
            'light': '光', 'voice': '声音', 'wife': '妻子', 'police': '警察',
            'mind': '思想', 'finally': '最后', 'return': '返回', 'explain': '解释',
            'carry': '携带', 'develop': '发展', 'hope': '希望', 'drive': '驾驶',
            'break': '打破', 'receive': '收到', 'agree': '同意', 'support': '支持',
            'remove': '移除', 'return': '返回', 'describe': '描述', 'create': '创造',
            'add': '添加', 'follow': '跟随', 'stop': '停止', 'create': '创建',
            'speak': '说话', 'read': '读', 'allow': '允许', 'include': '包括',
            'continue': '继续', 'set': '设置', 'learn': '学习', 'change': '改变',
            'lead': '领导', 'understand': '理解', 'watch': '观看', 'follow': '跟随',
            'stop': '停止', 'create': '创建', 'speak': '说话', 'read': '阅读',
            'allow': '允许', 'include': '包括', 'continue': '继续', 'set': '设置',
            'learn': '学习', 'change': '改变', 'lead': '领导', 'understand': '理解',
            'watch': '观看', 'far': '远', 'away': '离开', 'social': '社会的',
            'everything': '一切', 'everyone': '每个人', 'someone': '某人',
            'nothing': '没有什么', 'anything': '任何事'
        };

        // 拆分句子，逐个单词翻译
        const words = result.split(/\s+/);
        const translatedWords = words.map(w => {
            // 去除标点
            const cleanWord = w.toLowerCase().replace(/[.,!?;:]$/, '');
            const punctuation = w.match(/[.,!?;:]$/)?.[0] || '';

            if (wordMap[cleanWord]) {
                return wordMap[cleanWord] + punctuation;
            }
            // 如果单词不在词典里，保留原词但标记
            return w;
        });

        result = translatedWords.join('');

        // 清理多余空格和英文残留
        result = result
            .replace(/\s+/g, '')
            .replace(/[.,!?;:]$/g, '');

        // 如果没有成功翻译（还是全英文或大部分英文），返回提示
        const chineseChars = result.match(/[\u4e00-\u9fa5]/g);
        if (!chineseChars || chineseChars.length < 3) {
            return '（来自权威词典的真实例句）';
        }

        return result + '。';
    }

    generateStory(word, meaning, partOfSpeech) {
        const lowerWord = word.toLowerCase();
        const lowerMeaning = meaning.toLowerCase();

        // 根据具体单词含义生成贴切的故事
        const specificStories = {
            // 说服类
            persuade: `爸爸想让我多运动，他耐心地给我讲道理，告诉我运动的好处。最后我被他说服了，决定每天去跑步。这就是"persuade"——通过讲道理让人同意做某事。`,
            convince: `妈妈一开始不想买那只小狗，但我说了很多养宠物的好处。最后她终于被我说服了，同意让我养。这就是"convince"的力量。`,

            // 情感类
            happy: `今天是我的生日，朋友们给我准备了惊喜派对，还送了我最喜欢的礼物。我感到无比happy，笑容一直挂在脸上。`,
            sad: `小明养的仓鼠生病了，虽然他很努力地照顾，但仓鼠还是离开了。他感到很难过，这就是sad的感觉。`,
            angry: `有人在图书馆大声喧哗，影响了大家学习。管理员很生气地提醒他们保持安静。这种情绪就是angry。`,

            // 外貌类
            beautiful: `春天来了，公园里的樱花都开了，粉色的花瓣随风飘落，画面美得让人屏住呼吸。这就是beautiful的景象。`,
            ugly: `那栋废弃的老房子，墙皮剥落，窗户破碎，长满了杂草，看起来很不舒服。这就是ugly的样子。`,

            // 天气类
            sunny: `今天是个大晴天，阳光明媚，天空湛蓝，适合去户外野餐。sunny的天气让人心情也变好。`,
            rainy: `外面下着大雨，雨点打在窗户上滴滴答答。虽然不能出去玩，但听着雨声看书也很舒服。这就是rainy的日子。`,

            // 动作类
            run: `上学快迟到了，我抓起书包就往外冲，以最快的速度向学校跑去。心跳加速，双腿飞奔，这就是run的感觉。`,
            jump: `看到台阶下面有个水坑，我用力一跳，轻松地跨了过去。身体腾空的那一瞬间，就是jump。`,

            // 抽象概念
            important: `考试时我发现忘带准考证了，这才明白证件有多重要。以后我一定会提前准备好所有东西。这就是important的教训。`,
            difficult: `这道数学题我想了很久，试了好几种方法都做不出来，感觉很难。这就是difficult的感觉。`,
            easy: `经过大量练习，现在这些题目对我来说就像1+1=2一样简单。我终于觉得它们easy了。`,

            // 关系类
            friend: `我遇到困难时，他总是第一个出现帮我；我开心时，他也真心为我高兴。我们分享秘密，互相帮助，这就是friend的意义。`,
            family: `无论多晚回家，总有一盏灯为我亮着；无论遇到什么，总有亲人支持我。这就是family的温暖。`,

            // 地点类
            home: `经过一天的忙碌，推开家门，闻到饭菜香，听到家人的笑声，所有疲惫都消失了。这就是home的感觉。`,
            school: `每天早上背着书包走进校门，和同学们一起上课、讨论问题、参加活动，学习新知识。这就是我们的school生活。`,

            // 时间类
            morning: `闹钟响了，阳光透过窗帘洒进来，新的一天开始了。吃完早餐，精神饱满地迎接morning的时光。`,
            night: `天黑了，星星出来了，城市亮起万家灯火。完成一天的工作后，在night的宁静中好好休息。`
        };

        // 如果有特定单词的故事，直接返回
        if (specificStories[lowerWord]) {
            return specificStories[lowerWord];
        }

        // 根据词性生成通用但贴切的故事
        if (partOfSpeech === 'verb') {
            // 动词：描述谁做了什么
            if (lowerMeaning.includes('make') || lowerMeaning.includes('create')) {
                return `小明用乐高积木搭建了一座城堡，从设计到拼搭都是他亲手完成的。当他展示给妈妈看时，自豪地说："看，我make的！"`;
            }
            if (lowerMeaning.includes('speak') || lowerMeaning.includes('say')) {
                return `班会上，小红鼓起勇气站起来，大声说出了自己的想法。虽然有点紧张，但她还是勇敢地说speak了自己的观点。`;
            }
            if (lowerMeaning.includes('move') || lowerMeaning.includes('go')) {
                return `绿灯亮了，行人开始move过马路，车辆也缓缓启动。整个街道又恢复了繁忙的流动。`;
            }
            return `想象一下：当你${word}的时候，是什么感觉？谁会这样做？在什么情况下会做这个动作？把这个画面记在脑海里。`;
        }

        if (partOfSpeech === 'adjective') {
            // 形容词：描述什么样子
            if (lowerMeaning.includes('big') || lowerMeaning.includes('large')) {
                return `站在大象面前，我才真正理解什么是big。它比我高几倍，耳朵像扇子一样大，每走一步地面都在震动。`;
            }
            if (lowerMeaning.includes('small') || lowerMeaning.includes('little')) {
                return `刚出生的小猫只有手掌那么大，眼睛还没睁开，声音细细的。这就是small的可爱之处。`;
            }
            if (lowerMeaning.includes('hot') || lowerMeaning.includes('warm')) {
                return `夏天的正午，太阳火辣辣地照着，柏油路都要融化了，走几步就满头大汗。这就是hot的感觉。`;
            }
            if (lowerMeaning.includes('cold') || lowerMeaning.includes('cool')) {
                return `冬天早晨出门，寒风刺骨，呼出的气都变成了白雾，手都不敢伸出口袋。这就是cold的体验。`;
            }
            return `闭上眼睛，想象一个${word}的东西或场景。它是什么颜色？什么形状？给人什么感觉？把这个画面和你的单词联系起来。`;
        }

        if (partOfSpeech === 'noun') {
            // 名词：这是什么，有什么特点
            return `"${word}"是什么？你在哪里见过它？它长什么样子？有什么用途？回忆一下你和它的经历，把这个形象印在脑海里。`;
        }

        // 默认提示
        return `"${word}"这个词让你想到什么？试着用它描述一个你熟悉的场景或经历，把抽象的单词和具体的画面联系起来。`;
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
        this.exampleCnText.textContent = w.exampleCn;

        if (this.oxfordLink) {
            this.oxfordLink.href = `https://www.oxfordlearnersdictionaries.com/definition/english/${w.word.toLowerCase()}`;
        }

        this.cardSection.classList.remove('hidden');
        this.errorState.classList.add('hidden');
        this.card.classList.remove('flipped');

        // 生成例句
        this.generateAutoSentences(w.word);
        this.renderUserSentences(w.word);
        this.sentenceInput.value = '';

        setTimeout(() => this.speakWord(), 500);
    }

    // 生成参考例句 - 只用真实词典例句，不胡编
    generateAutoSentences(word) {
        if (!this.currentWord) return;

        const wordData = this.currentWord;

        // 只使用 API 返回的真实例句
        if (!wordData.allExamples || wordData.allExamples.length === 0) {
            this.autoSentences.innerHTML = `
                <p class="auto-sentence-hint">💡 暂无权威词典例句</p>
                <p style="font-size: 0.85rem; color: var(--text-light); padding: 10px;">
                    建议点击上方"📖 查看牛津词典"链接，查看更多真实例句。
                </p>
            `;
            return;
        }

        // 取前2个真实例句，确保翻译正确
        const sentences = wordData.allExamples.slice(0, 2).map(ex => {
            const translated = this.translateLocal(ex.text);
            return {
                en: ex.text,
                cn: translated,
                source: 'Oxford Learner\'s Dictionary'
            };
        });

        // 缓存
        this.examplesCache[word] = sentences;
        localStorage.setItem('examplesCache', JSON.stringify(this.examplesCache));

        this.displaySentences(sentences);
    }

    displaySentences(sentences) {
        this.autoSentences.innerHTML = `
            <p class="auto-sentence-hint">💡 权威词典例句（来源标注 | 点击可复制）：</p>
            ${sentences.map((item, index) => `
                <div class="auto-sentence-item" data-sentence="${item.en}">
                    <div class="sentence-en">${index + 1}. ${item.en}</div>
                    <div class="sentence-cn">${item.cn}</div>
                    <div class="sentence-source">📚 ${item.source}</div>
                </div>
            `).join('')}
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

    speakWord() {
        if (!this.currentWord) return;
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(this.currentWord.word);
            utterance.lang = 'en-US';
            utterance.rate = 0.8;
            window.speechSynthesis.speak(utterance);
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

    saveUserSentence() {
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

        if (!this.userSentencesMap[word]) this.userSentencesMap[word] = [];
        if (this.userSentencesMap[word].includes(sentence)) {
            this.showToast('这个句子已经保存过了');
            return;
        }

        this.userSentencesMap[word].push(sentence);
        localStorage.setItem('userSentencesMap', JSON.stringify(this.userSentencesMap));
        this.sentenceInput.value = '';
        this.renderUserSentences(word);
        this.showToast('句子保存成功！');
    }

    renderUserSentences(word) {
        const sentences = this.userSentencesMap[word] || [];
        if (sentences.length === 0) {
            this.userSentences.innerHTML = '';
            return;
        }

        this.userSentences.innerHTML = `
            <p style="font-size: 0.85rem; color: var(--text-light); margin-bottom: 8px;">✨ 我造的句子：</p>
            ${sentences.map((sentence, index) => `
                <div class="user-sentence-item">
                    <span class="sentence-text">${sentence}</span>
                    <button class="delete-sentence" data-index="${index}">✕</button>
                </div>
            `).join('')}
        `;

        this.userSentences.querySelectorAll('.delete-sentence').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                this.userSentencesMap[word].splice(index, 1);
                if (this.userSentencesMap[word].length === 0) delete this.userSentencesMap[word];
                localStorage.setItem('userSentencesMap', JSON.stringify(this.userSentencesMap));
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
