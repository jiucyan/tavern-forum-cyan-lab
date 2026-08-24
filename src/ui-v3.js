import { fetchAvailableModels, generateForumImage, generateForumText, generateForumTextResult } from './api.js';
import { DEFAULT_BUILTIN_PROMPTS, DEFAULT_SETTINGS, WORLD_MODULE_DEFINITIONS } from './constants.js';
import {
    buildDirectMessageRequest,
    buildForumGenerationRequest,
    buildForumPromptPresetExport,
    buildModeratorProfilesRequest,
    buildNpcProfileRequest,
    buildRoleDirectMessageRequest,
    buildThreadReplyRequest,
    createId,
    createManualComment,
    createManualPost,
    extractMentions,
    getActivePromptEntries,
    normalizeDirectMessage,
    normalizeGeneratedForum,
    normalizeNpcProfile,
    normalizeModeratorProfiles,
    normalizeThreadReplies,
    orderForumPromptItems,
    prunePosts,
    recoverGeneratedForum,
} from './prompt.js';
import {
    advanceSocialEngagement,
    applyNpcProfile,
    collectNpcEvidence,
    connectGeneratedReposts,
    createNpc,
    createFact,
    createNotification,
    createDefaultAvatarDataUrl,
    DEFAULT_AVATARS,
    ensureCharacterConversation,
    ensureCharacterRole,
    ensureCompanionConversation,
    ensureNpcConversation,
    ensureTaskIssuerConversation,
    ensureRoleConversation,
    linkNpcAuthors,
} from './forum.js';
import {
    clearAllData,
    createApiProfile,
    deleteApiProfile,
    getActiveApiProfile,
    getApiConfig,
    getModuleApiConfig,
    getTaskVerificationApiConfig,
    getCharacterCatalog,
    getChatSnapshot,
    getForumData,
    getGenerationSourceContext,
    getRoleScopedSourceContext,
    getSettings,
    getSillyTavernPresetCatalog,
    getWorldInfoCatalog,
    hasActiveChat,
    renameApiProfile,
    saveForumData,
    saveSettings,
    setActiveApiProfile,
    setRememberApiKeys,
    setSessionApiKey,
    syncInjection,
    updateApiConfig,
} from './store.js';
import {
    applyModerationProposal,
    applyInventoryItemUse,
    applyWorldUpdates,
    buildLinkedWorldInstruction,
    buildWorldModuleInjection,
    buildWorldModuleRequest,
    COMPANION_TRAVEL_PRESETS,
    createPostReport,
    getModuleDefinition,
    getPermissionLevel,
    createLocalFortune,
    createLocalHealthEvent,
    classifyInventoryItem,
    evaluateModuleGeneration,
    filterWorldUpdatesBySafety,
    findLocalTaskEvidence,
    buildTaskVerificationRequest,
    isQuietHours,
    normalizeWorldUpdates,
    normalizeProactiveDirectMessages,
    normalizeTaskVerification,
    prepareCompanionJourney,
    advanceCompanionJourney,
    resolveCompanionTravelTiming,
    roleCan,
    setModuleDecision,
} from './world.js';

const ROOT_ID = 'tavern-forum-root';
const FAB_ID = 'tavern-forum-fab';
const MENU_ID = 'tavern-forum-menu-item';
const SETTINGS_BLOCK_ID = 'tavern-forum-settings-block';
let launcherCaptureInstalled = false;
let lastMenuLauncherActivation = 0;
let floatingViewportListenerInstalled = false;
const COMPANION_SPECIES = Object.freeze([
    { id: 'frog', name: '青蛙' },
    { id: 'cat', name: '黑猫' },
    { id: 'rabbit', name: '垂耳兔' },
    { id: 'fox', name: '赤狐' },
    { id: 'penguin', name: '小企鹅' },
    { id: 'robo-bird', name: '机械鸟' },
]);
const COMPANION_PALETTES = Object.freeze({
    frog: { body: '#63ad5c', accent: '#e7c65a' },
    cat: { body: '#3f414d', accent: '#9b78ba' },
    rabbit: { body: '#ded4c4', accent: '#d995a9' },
    fox: { body: '#c96e3f', accent: '#713b3d' },
    penguin: { body: '#354b62', accent: '#e6a94f' },
    'robo-bird': { body: '#5c8f91', accent: '#e1b75a' },
    mystery: { body: '#74658b', accent: '#d1a7bd' },
});
const COMPANION_DEVICE_SKINS = Object.freeze([
    { id: 'classic', name: '经典蛋机', note: '圆润三键 · 绿屏' },
    { id: 'pocket', name: '口袋掌机', note: '十字键 · 横向面板' },
    { id: 'crystal', name: '透明糖果机', note: '半透明外壳 · 蓝屏' },
    { id: 'arcane', name: '魔法通讯器', note: '符文边框 · 紫晶屏' },
    { id: 'terminal', name: '机械终端', note: '金属机身 · 琥珀屏' },
]);
const COMPANION_FOODS = Object.freeze([
    { id: 'bug-cookie', symbol: '✹', name: '虫虫饼', satiety: 22, energy: 4, happiness: 7 },
    { id: 'fish-flake', symbol: '≋', name: '小鱼片', satiety: 24, energy: 5, happiness: 8 },
    { id: 'carrot-cube', symbol: '◆', name: '胡萝卜块', satiety: 20, energy: 6, happiness: 7 },
    { id: 'berry', symbol: '●', name: '森林莓果', satiety: 16, energy: 5, happiness: 10 },
    { id: 'seed-mix', symbol: '⁙', name: '谷物种子', satiety: 18, energy: 7, happiness: 6 },
    { id: 'battery', symbol: '▣', name: '迷你电池', satiety: 25, energy: 14, happiness: 5 },
    { id: 'melon-jelly', symbol: '▤', name: '瓜果冻', satiety: 18, energy: 4, happiness: 12 },
    { id: 'honey-drop', symbol: '⬟', name: '蜂蜜滴', satiety: 14, energy: 10, happiness: 11 },
    { id: 'ice-fish', symbol: '◁', name: '冰晶小鱼', satiety: 26, energy: 7, happiness: 9 },
    { id: 'oil-nut', symbol: '◉', name: '机油坚果', satiety: 20, energy: 16, happiness: 6 },
]);
const COMPANION_ACCESSORIES = Object.freeze([
    { id: 'none', name: '不佩戴' },
    { id: 'scarf', name: '旅行围巾' },
    { id: 'satchel', name: '小挎包' },
    { id: 'flower', name: '像素小花' },
    { id: 'charm', name: '幸运挂坠' },
    { id: 'ribbon', name: '蝴蝶结' },
    { id: 'glasses', name: '圆框眼镜' },
    { id: 'crown', name: '迷你王冠' },
    { id: 'leaf', name: '嫩叶帽' },
    { id: 'headphones', name: '小耳机' },
    { id: 'cape', name: '冒险披风' },
    { id: 'bell', name: '铃铛项圈' },
]);
const COMPANION_HABITATS = Object.freeze([
    { id: 'meadow', name: '风吹草地' },
    { id: 'pond', name: '荷叶池塘' },
    { id: 'bedroom', name: '暖灯卧室' },
    { id: 'forest', name: '林间树屋' },
    { id: 'snowfield', name: '雪原营地' },
    { id: 'city', name: '城市天台' },
    { id: 'space', name: '星际舷窗' },
    { id: 'arcade', name: '像素街机厅' },
]);
const COMPANION_CARE_ACTIONS = Object.freeze([
    { id: 'feed', symbol: '●', label: '喂食' },
    { id: 'pet', symbol: '♥', label: '摸摸' },
    { id: 'play', symbol: '◆', label: '玩耍' },
    { id: 'rest', symbol: '☾', label: '休息' },
    { id: 'brush', symbol: '≋', label: '梳理' },
    { id: 'dance', symbol: '♪', label: '跳舞' },
    { id: 'train', symbol: '▲', label: '练习' },
    { id: 'hide', symbol: '□', label: '躲猫猫' },
    { id: 'talk', symbol: '…', label: '聊天' },
    { id: 'dress', symbol: '✦', label: '换装' },
]);
const COMPANION_EXTRA_REACTIONS = Object.freeze({
    frog: { brush: '青蛙认真地让你擦了擦背，然后跳进水里冲出一圈涟漪。', dance: '它踩着雨点节拍一蹦一蹦，最后稳稳落在荷叶中央。', train: '它反复练习远跳，落点一次比一次准确。', hide: '它只露出两只眼睛藏在荷叶下，等你发现。', talk: '它歪着头听完，又用短短一声呱回应你。' },
    cat: { brush: '黑猫装作不在意，却主动把下一处打结的毛递给了你。', dance: '它绕着尾巴优雅转圈，最后若无其事地坐好。', train: '它连续扑中几个移动光点，骄傲地抬起下巴。', hide: '它藏进纸箱，只剩尾巴尖在外面轻轻晃。', talk: '它慢慢眨眼，像是把你的话认真收好了。' },
    rabbit: { brush: '垂耳兔安静伏下，让你顺着长耳朵仔细梳理。', dance: '它踩出一串轻快小跳，耳朵也跟着节奏摆动。', train: '它钻过纸圈又绕回原地，得到夸奖后鼻尖动个不停。', hide: '它埋进软垫，只露出一对长耳朵。', talk: '它靠近声音来源，专心听得连鼻尖都停了一瞬。' },
    fox: { brush: '赤狐把蓬松尾巴铺开，允许你替它梳得更加漂亮。', dance: '它踏着狡黠的小碎步绕了半圈，尾巴像火焰一样扫过。', train: '它悄无声息地完成埋伏练习，最后突然从侧边现身。', hide: '它藏进阴影里，只留下一双亮晶晶的眼睛。', talk: '它侧耳辨认你的语气，再用尾巴轻扫屏幕作为回答。' },
    penguin: { brush: '小企鹅认真整理羽毛，还主动转身让你检查另一边。', dance: '它左右摇摆拍着短翅，跳出一段笨拙又可爱的舞。', train: '它练习滑行转弯，绕过障碍后开心地拍了拍肚皮。', hide: '它躲在冰块后面，却因为圆滚滚的肚子露出一大截。', talk: '它仰头听你说完，发出很有精神的回应。' },
    'robo-bird': { brush: '机械鸟展开清洁面板，允许你擦亮每一片翼板。', dance: '节拍灯依次亮起，它完成了一段精确的机械舞。', train: '它重新校准航线，连续完成三次悬停与急转。', hide: '它关闭指示灯进入隐身练习，只剩极轻的电流声。', talk: '语音灯随你的话闪烁，随后播放一串愉快确认音。' },
    mystery: { brush: '它安静配合你的梳理，看起来舒服了不少。', dance: '它用独特的方式跟着节奏活动起来。', train: '它认真完成了今天的小练习。', hide: '它找了一个自以为隐蔽的位置躲起来。', talk: '它专心听完，并用自己的方式回应你。' },
});
const COMPANION_HABITS = Object.freeze({
    frog: { favorite: 'bug-cookie', likes: ['berry'], pet: '青蛙眯起眼，前爪轻轻拍了拍屏幕。', play: '它追着光点跳过三片像素荷叶。', rest: '它缩进湿润的小窝，呼吸慢慢平稳。', weather: { sunny: ['暖洋洋地趴在水边晒背。', '惬意'], cloudy: ['它抬头盯着云层，像在等雨。', '期待'], rain: ['雨声一响，它立刻活跃地蹦了起来！', '雀跃'], wind: ['它压低身体，认真听风穿过草叶。', '专注'], snow: ['它把脚趾收起来，悄悄靠近了暖灯。', '怕冷'] } },
    cat: { favorite: 'fish-flake', likes: ['berry'], pet: '黑猫先矜持地躲了一下，又把额头递了过来。', play: '它扑住像素毛线，尾巴得意地甩了两圈。', rest: '它把自己盘成一团，发出很轻的呼噜声。', weather: { sunny: ['它占住最暖的光斑，舒服地翻了个身。', '慵懒'], cloudy: ['它窝在窗边，安静观察远处的影子。', '平静'], rain: ['雨点让它的耳朵一抖一抖，暂时不想出门。', '谨慎'], wind: ['它追着被风吹动的叶影，瞳孔亮了起来。', '好奇'], snow: ['它对雪点伸出爪子，又迅速缩了回来。', '新奇'] } },
    rabbit: { favorite: 'carrot-cube', likes: ['berry', 'seed-mix'], pet: '垂耳兔把耳朵放松下来，鼻尖轻轻动了动。', play: '它绕着小窝跳了一圈，又钻进纸盒隧道。', rest: '它把干草拢成小窝，安静地伏了下来。', weather: { sunny: ['它在柔和的阳光里梳理长耳朵。', '舒展'], cloudy: ['它靠着小窝边缘，安心地嚼着草。', '安稳'], rain: ['它侧耳听雨，把自己藏进了干燥角落。', '安静'], wind: ['耳朵被风声吸引，警觉地转向窗外。', '警觉'], snow: ['它兴奋地看着白点，却更喜欢暖和的室内。', '兴奋'] } },
    fox: { favorite: 'berry', likes: ['fish-flake'], pet: '赤狐绕过你的手，最后用尾巴轻轻扫了一下。', play: '它假装埋伏，突然扑向飞过的像素光点。', rest: '它用大尾巴盖住鼻尖，蜷成暖暖的一团。', weather: { sunny: ['它伏在阴影边缘，耐心观察来往动静。', '机敏'], cloudy: ['微暗的天色让它更愿意四处探索。', '活跃'], rain: ['它闻了闻潮湿空气，像发现了新的气味。', '好奇'], wind: ['顺风带来远处的味道，它的耳朵立了起来。', '专注'], snow: ['它在雪地里留下轻快脚印，尾巴像一团火。', '雀跃'] } },
    penguin: { favorite: 'fish-flake', likes: ['berry'], pet: '小企鹅挺起胸口，开心地拍了拍短翅。', play: '它用肚皮滑过屏幕，转了一圈才停下。', rest: '它把喙藏到翅膀下，稳稳站着睡着了。', weather: { sunny: ['它躲到凉快处，认真保护自己的冰块。', '怕热'], cloudy: ['温度刚刚好，它慢悠悠巡视小窝。', '舒适'], rain: ['它把雨点当成小游戏，啪嗒啪嗒踩水。', '开心'], wind: ['它迎着风张开翅膀，像一艘小帆船。', '勇敢'], snow: ['雪一落下来，它立刻精神十足地滑了出去！', '兴奋'] } },
    'robo-bird': { favorite: 'battery', likes: ['seed-mix'], pet: '触摸感应灯依次亮起，它回了一声清脆电子音。', play: '它展开小翼完成了一套精准的绕圈飞行。', rest: '机械鸟收起翼片，进入低功耗充电模式。', weather: { sunny: ['太阳能板充电效率提升，指示灯很明亮。', '满电'], cloudy: ['它调低屏幕亮度，平稳执行巡航程序。', '稳定'], rain: ['防水检测启动，它谨慎地收起外露接口。', '警戒'], wind: ['它校正陀螺仪，兴奋地测试逆风悬停。', '专注'], snow: ['除霜模块嗡嗡运转，机身冒出一点热气。', '忙碌'] } },
    mystery: { favorite: 'berry', likes: COMPANION_FOODS.map(item => item.id), pet: '它用自己的方式回应了你的触碰。', play: '它围着光点开心地转了一圈。', rest: '它找到舒服的位置，安静休息起来。', weather: { sunny: ['它享受着小窝里的光。', '舒适'], cloudy: ['它安静地看着云层变化。', '平静'], rain: ['它听着雨声，显得若有所思。', '好奇'], wind: ['它追踪着风吹动的影子。', '专注'], snow: ['它第一次认真观察这些白色小点。', '新奇'] } },
});
const CUSTOM_STYLE_ID = 'tavern-forum-custom-css';
const LEGACY_BUILTIN_CUSTOM_CSS_TEMPLATE = `/*
 * 微坛标准 CSS 美化模板
 * 可以直接修改数值；所有选择器都限制在论坛内部，不会修改酒馆界面。
 */

/* 1. 全局尺寸与圆角 */
#tavern-forum-root {
    --tf-user-radius: 18px;
    --tf-user-shadow: 0 10px 34px rgb(15 23 42 / 8%);
    --tf-user-post-gap: 18px;
}

/* 2. 顶部导航 */
#tavern-forum-root .tf-topbar,
#tavern-forum-root .tf-mobile-main-nav {
    box-shadow: none;
}
#tavern-forum-root .tf-main-nav button,
#tavern-forum-root .tf-mobile-main-nav button {
    border-radius: 12px;
}

/* 3. 首页信息流 */
#tavern-forum-root .tf-feed-list {
    gap: var(--tf-user-post-gap);
}
#tavern-forum-root .tf-feed-tabs,
#tavern-forum-root .tf-stories {
    border-radius: var(--tf-user-radius);
}

/* 4. 帖子磨砂玻璃卡片 */
#tavern-forum-root .tf-post {
    border-radius: var(--tf-user-radius);
    box-shadow: var(--tf-user-shadow);
}
#tavern-forum-root .tf-post-caption {
    line-height: 1.8;
}

/* 5. 评论区域与楼中楼 */
#tavern-forum-root .tf-comments {
    border-radius: 0 0 var(--tf-user-radius) var(--tf-user-radius);
}
#tavern-forum-root .tf-comment {
    line-height: 1.65;
}

/* 6. 头像 */
#tavern-forum-root .tf-avatar {
    box-shadow: 0 0 0 2px rgb(255 255 255 / 78%);
}

/* 7. 帖子和评论图片 */
#tavern-forum-root .tf-post-image {
    max-height: 680px;
    object-fit: cover;
}
#tavern-forum-root .tf-comment-image {
    border-radius: 14px;
}

/* 8. 用户与角色主页 */
#tavern-forum-root .tf-public-profile-hero,
#tavern-forum-root .tf-personal-profile {
    border-radius: var(--tf-user-radius);
}

/* 9. 私信 */
#tavern-forum-root .tf-dm-bubble {
    border-radius: 18px;
}
#tavern-forum-root .tf-dm-bubble.is-me {
    border-bottom-right-radius: 6px;
}
#tavern-forum-root .tf-dm-bubble.is-them {
    border-bottom-left-radius: 6px;
}

/* 10. 设置页（不使用帖子透明度） */
#tavern-forum-root .tf-settings-card,
#tavern-forum-root .tf-dashboard-grid > button {
    border-radius: var(--tf-user-radius);
}

/* 11. 手机端：自动缩小间距 */
@media (max-width: 680px) {
    #tavern-forum-root {
        --tf-user-radius: 14px;
        --tf-user-post-gap: 10px;
    }
}`;
const BUILTIN_CUSTOM_CSS_TEMPLATE = `/*
 * 微坛全局 CSS 主题模板 v2（适配 0.10.6+）
 * 修改变量即可统一调整；所有选择器都限制在插件根节点内，不会影响酒馆本体。
 * 各世界 App 只统一外层节奏，不会把旅伴、运势、健康和论坛强行改成同一种风格。
 */

/* 1. 全局设计变量 */
#tavern-forum-root {
    --tf-user-radius: 18px;
    --tf-user-radius-small: 12px;
    --tf-user-shadow: 0 10px 34px rgb(15 23 42 / 8%);
    --tf-user-elevated-shadow: 0 18px 48px rgb(15 23 42 / 12%);
    --tf-user-page-gap: 18px;
    --tf-user-post-gap: 18px;
    --tf-user-world-gap: 16px;
}

/* 2. 插件外壳与导航 */
#tavern-forum-root .tf-topbar,
#tavern-forum-root .tf-mobile-main-nav,
#tavern-forum-root .tf-settings-page .tf-me-nav {
    box-shadow: none;
}
#tavern-forum-root .tf-main-nav button,
#tavern-forum-root .tf-mobile-main-nav button,
#tavern-forum-root .tf-me-nav button {
    border-radius: var(--tf-user-radius-small);
}

/* 3. 通用表单与操作按钮 */
#tavern-forum-root .tf-primary-button,
#tavern-forum-root .tf-secondary-button,
#tavern-forum-root .tf-back-button {
    border-radius: var(--tf-user-radius-small);
}
#tavern-forum-root .tf-settings-card input,
#tavern-forum-root .tf-settings-card select,
#tavern-forum-root .tf-settings-card textarea {
    border-radius: var(--tf-user-radius-small);
}

/* 4. 论坛首页与信息流 */
#tavern-forum-root .tf-feed-column,
#tavern-forum-root .tf-feed-list {
    gap: var(--tf-user-post-gap);
}
#tavern-forum-root .tf-feed-tabs,
#tavern-forum-root .tf-stories,
#tavern-forum-root .tf-topic-header {
    border-radius: var(--tf-user-radius);
}
#tavern-forum-root .tf-post {
    border-radius: var(--tf-user-radius);
    box-shadow: var(--tf-user-shadow);
}
#tavern-forum-root .tf-post-caption {
    line-height: 1.8;
}
#tavern-forum-root .tf-comments {
    border-radius: 0 0 var(--tf-user-radius) var(--tf-user-radius);
}
#tavern-forum-root .tf-comment {
    line-height: 1.65;
}

/* 5. 头像、帖子图片与评论图片 */
#tavern-forum-root .tf-avatar {
    box-shadow: 0 0 0 2px rgb(255 255 255 / 78%);
}
#tavern-forum-root .tf-post-image {
    max-height: 680px;
    object-fit: cover;
}
#tavern-forum-root .tf-comment-image {
    border-radius: var(--tf-user-radius-small);
}

/* 6. 个人页、角色页与私信 */
#tavern-forum-root .tf-public-profile-hero,
#tavern-forum-root .tf-personal-profile,
#tavern-forum-root .tf-profile-content-list,
#tavern-forum-root .tf-messages-shell {
    border-radius: var(--tf-user-radius);
}
#tavern-forum-root .tf-dm-bubble {
    border-radius: 18px;
}
#tavern-forum-root .tf-dm-bubble.is-me {
    border-bottom-right-radius: 6px;
}
#tavern-forum-root .tf-dm-bubble.is-them {
    border-bottom-left-radius: 6px;
}

/* 7. 世界主页：只统一布局，不覆盖两种主页模式的色彩 */
#tavern-forum-root .tf-world-hub {
    gap: var(--tf-user-world-gap);
}
#tavern-forum-root .tf-world-bento > *,
#tavern-forum-root .tf-world-window-shell,
#tavern-forum-root .tf-world-app-dock {
    border-radius: var(--tf-user-radius);
}
#tavern-forum-root .tf-world-app-icon {
    border-radius: var(--tf-user-radius-small);
}

/* 8. 世界 App 外层：保留掌机、抽牌、诊所、背包各自风格 */
#tavern-forum-root .tf-world-app-page {
    gap: var(--tf-user-page-gap);
}
#tavern-forum-root .tf-world-app-header,
#tavern-forum-root .tf-inventory-hero,
#tavern-forum-root .tf-inventory-detail,
#tavern-forum-root .tf-health-case,
#tavern-forum-root .tf-fortune-ritual,
#tavern-forum-root .tf-fortune-reveal {
    border-radius: var(--tf-user-radius);
}
#tavern-forum-root .tf-companion-v4 .tf-pet-console,
#tavern-forum-root .tf-fortune-ritual,
#tavern-forum-root .tf-health-case,
#tavern-forum-root .tf-inventory-detail {
    box-shadow: var(--tf-user-shadow);
}

/* 9. 设置中心与可拖动论坛设定 */
#tavern-forum-root .tf-section-page,
#tavern-forum-root .tf-module-grid {
    gap: var(--tf-user-page-gap);
}
#tavern-forum-root .tf-settings-card,
#tavern-forum-root .tf-dashboard-grid > button,
#tavern-forum-root .tf-prompt-entry {
    border-radius: var(--tf-user-radius);
}
#tavern-forum-root .tf-custom-css {
    min-height: 420px;
    line-height: 1.65;
    tab-size: 4;
}

/* 10. 手机端：缩小间距并避免横向溢出 */
@media (max-width: 680px) {
    #tavern-forum-root {
        --tf-user-radius: 14px;
        --tf-user-radius-small: 10px;
        --tf-user-page-gap: 12px;
        --tf-user-post-gap: 10px;
        --tf-user-world-gap: 10px;
    }
    #tavern-forum-root .tf-post {
        margin-inline: 8px;
    }
    #tavern-forum-root .tf-world-app-page,
    #tavern-forum-root .tf-section-page {
        max-width: 100%;
        overflow-x: clip;
    }
    #tavern-forum-root .tf-custom-css {
        min-height: 320px;
        font-size: 12px;
    }
}`;

function getEffectiveCustomCss(appearance) {
    const stored = String(appearance?.customCss || '');
    if (stored === LEGACY_BUILTIN_CUSTOM_CSS_TEMPLATE) return BUILTIN_CUSTOM_CSS_TEMPLATE;
    if (stored) return stored;
    return appearance?.customCssCleared ? '' : BUILTIN_CUSTOM_CSS_TEMPLATE;
}
const imageMemory = new Map();

const viewState = {
    open: false,
    initialized: false,
    busy: false,
    composerOpen: false,
    imageBusy: new Set(),
    replyingPosts: new Set(),
    npcBusy: new Set(),
    dmBusy: false,
    expandedComments: new Set(),
    replyTarget: null,
    selectedNpcId: '',
    publicNpcId: '',
    selectedPostId: '',
    selectedConversationId: '',
    selectedMemoryNpcId: '',
    mobileDmChat: false,
    messageMode: 'dm',
    worldCatalog: [],
    promptSourceContext: null,
    worldLoading: false,
    searchQuery: '',
    autoRefreshTimer: 0,
    companionJourneyTimer: 0,
    companionJourneyBusy: false,
    pendingNpcAvatarId: '',
    pendingNpcBackgroundId: '',
    pendingViewWallpaperId: '',
    feedMode: 'recommended',
    selectedTopic: '',
    worldPage: '',
    composerPoll: null,
    openPostMenuId: '',
    openPostImageEditorId: '',
    injectionTokens: { total: 0, forum: 0, roles: 0, world: 0, modules: {}, loading: false },
    moduleBusy: new Set(),
    taskVerificationBusy: new Set(),
    notificationFilter: 'all',
    profileEditing: false,
    profileTab: 'posts',
    companionMenuIndex: 0,
    companionProfileOpen: false,
    companionFoodMenuOpen: false,
    companionFoodIndex: 0,
    companionAppearanceDraft: null,
    fortuneRevealChoice: '',
    fortuneAiMode: false,
    openPromptEntries: new Set(),
    inventoryFilter: 'all',
    selectedInventoryItemId: '',
    renderedScrollKey: '',
    scrollPositions: new Map(),
    homeScrollTop: 0,
    storiesScrollLeft: 0,
    settingsNavScrollLeft: 0,
    pendingSettingsBlock: '',
    settingsSearch: '',
    settingsHighlight: '',
    pendingModuleImportId: '',
    openModuleToolsId: '',
    toasts: [],
    apiModels: new Map(),
    apiModelBusy: new Set(),
};

const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-3.7-.8L3 21l1.7-4.7A8.2 8.2 0 0 1 3 11.5a8.4 8.4 0 0 1 9-8.5 8.4 8.4 0 0 1 9 8.5Z"/><path d="m8.5 12 2.2 2 4.8-5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    heart: '<path d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"/>',
    comment: '<path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.5 9.5 0 0 1-4-.9L3 21l1.8-4.7A8 8 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5Z"/>',
    send: '<path d="m22 2-9 20-3.5-8.5L2 10z"/><path d="M22 2 9.5 13.5"/>',
    bookmark: '<path d="M6 3h12v19l-6-4-6 4z"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/>',
    shield: '<path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/>',
    sparkles: '<path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2zM19 14l.7 2.3L22 17l-2.3.7L19 20l-.7-2.3L16 17l2.3-.7zM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8z"/>',
    refresh: '<path d="M20 6v5h-5M4 18v-5h5"/><path d="M18.5 9A7 7 0 0 0 6 6.5L4 9m16 6-2 2.5A7 7 0 0 1 5.5 15"/>',
    palette: '<path d="M12 3a9 9 0 0 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h4a5 5 0 0 0 0-10z"/><circle cx="7.5" cy="10" r="1"/><circle cx="9" cy="6.5" r="1"/><circle cx="14" cy="6.5" r="1"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v14a3 3 0 0 0-3-3H4zM20 4h-4a3 3 0 0 0-3 3v14a3 3 0 0 1 3-3h4z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5"/>',
    database: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/>',
    inventory: '<path d="M6 8h12l1 12H5L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2M8 12h8"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    repost: '<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
};

function icon(name, className = '') {
    return `<svg class="tf-icon ${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.settings}</svg>`;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function buildGenerationTrace(text, reasoning = '') {
    const sections = [];
    if (String(reasoning || '').trim()) sections.push(`【模型返回的推理记录】\n${String(reasoning).trim()}`);
    if (String(text || '').trim()) sections.push(`【模型原始输出】\n${String(text).trim()}`);
    return sections.join('\n\n').slice(0, 40000);
}

function appendGenerationLog(data, log) {
    data.generationLogs ||= [];
    const entry = {
        id: createId('generation-log'),
        createdAt: Date.now(),
        status: log.status || 'error',
        locallyRepaired: Boolean(log.locallyRepaired),
        automatic: Boolean(log.automatic),
        provider: String(log.provider || 'unknown').slice(0, 80),
        model: String(log.model || '酒馆当前模型').slice(0, 160),
        postCount: Math.max(0, Number(log.postCount || 0)),
        reasoning: String(log.reasoning || '').slice(0, 20000),
        output: String(log.output || '').slice(0, 20000),
        error: String(log.error || '').slice(0, 10000),
    };
    data.generationLogs.push(entry);
    if (data.generationLogs.length > 20) data.generationLogs.splice(0, data.generationLogs.length - 20);
    return entry;
}

function renderSocialText(value) {
    return escapeHtml(value).replace(/@([\w\u4e00-\u9fff.-]{1,32})/gu, '<span class="tf-mention">@$1</span>');
}

function isMyHandle(handle) {
    const profile = getSettings().profile;
    const normalized = String(handle || '').replace(/^@/, '').toLocaleLowerCase();
    return normalized === 'me' || normalized === String(profile.handle || 'me').replace(/^@/, '').toLocaleLowerCase();
}

function getMyDisplayName() {
    const configured = String(getSettings().profile.displayName || '').trim();
    const snapshotName = getChatSnapshot().names.user || '我';
    if (!configured || /\{\{\s*user\s*\}\}/i.test(configured)) return snapshotName;
    return configured;
}

function notify(type, message) {
    const level = ['success', 'warning', 'error', 'info'].includes(type) ? type : 'info';
    const item = { id: createId('toast'), type: level, message: String(message || ''), createdAt: Date.now() };
    viewState.toasts.push(item);
    if (viewState.toasts.length > 4) viewState.toasts.splice(0, viewState.toasts.length - 4);
    console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'](`[微坛] ${item.message}`);
    paintInAppToasts();
    globalThis.setTimeout(() => {
        viewState.toasts = viewState.toasts.filter(entry => entry.id !== item.id);
        paintInAppToasts();
    }, level === 'error' ? 7000 : 3600);
}

function paintInAppToasts() {
    const host = getRoot()?.querySelector('.tf-in-app-toasts');
    if (!host) return;
    host.innerHTML = viewState.toasts.map(item => `<div class="tf-in-app-toast is-${escapeHtml(item.type)}" data-toast-id="${escapeHtml(item.id)}"><i></i><span>${escapeHtml(item.message)}</span><button data-action="dismiss-toast" data-toast-id="${escapeHtml(item.id)}" aria-label="关闭">${icon('close')}</button></div>`).join('');
}

function getRoot() {
    return document.getElementById(ROOT_ID);
}

function isSafeImageUrl(value) {
    return /^(https?:\/\/|data:image\/)/i.test(String(value || ''));
}

function initials(name) {
    return escapeHtml(Array.from(String(name || '匿').trim())[0] || '匿');
}

function avatarHue(name) {
    return Array.from(String(name || '')).reduce((sum, char) => sum + char.codePointAt(0), 0) % 360;
}

function formatTime(timestamp) {
    const diff = Math.max(0, Date.now() - Number(timestamp || Date.now()));
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function numberLabel(value) {
    const number = Number(value || 0);
    if (number >= 10000) return `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万`;
    return String(number);
}

function renderSwitch({ checked, action, label, disabled = false, dataset = {} }) {
    const dataAttributes = Object.entries(dataset).map(([key, value]) => ` data-${String(key).replace(/[A-Z]/g, match => `-${match.toLocaleLowerCase()}`)}="${escapeHtml(value)}"`).join('');
    return `<label class="tf-switch ${disabled ? 'is-disabled' : ''}"><input type="checkbox" data-action="${escapeHtml(action)}"${dataAttributes} ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}><span class="tf-switch-track"><i></i></span>${label ? `<span>${escapeHtml(label)}</span>` : ''}</label>`;
}

function npcForId(npcId) {
    return npcId ? getForumData().npcs.find(npc => npc.id === npcId) : null;
}

function npcForAuthor(author) {
    const data = getForumData();
    const byId = npcForId(author?.npcId);
    if (byId) return byId;
    const handle = String(author?.handle || '').replace(/^@/, '').trim().toLocaleLowerCase();
    if (handle) {
        const byHandle = data.npcs.find(npc => String(npc.handle || '').replace(/^@/, '').trim().toLocaleLowerCase() === handle);
        if (byHandle) return byHandle;
    }
    const name = String(author?.author || author?.name || '').trim();
    return name ? data.npcs.find(npc => String(npc.name || '').trim() === name) || null : null;
}

function isRoleLibraryMember(npc) {
    return Boolean(npc && (npc.systemRole || npc.profileGenerated));
}

function getRoleLibrary(data = getForumData()) {
    return (data.npcs || []).filter(isRoleLibraryMember);
}

function renderStoredImage({ url = '', imageKey = '', alt = '', className = '' } = {}) {
    if (imageKey) {
        const value = imageMemory.get(imageKey);
        return `<img class="${escapeHtml(className)}" data-tf-image ${value ? `src="${escapeHtml(value)}"` : `data-image-key="${escapeHtml(imageKey)}"`} alt="${escapeHtml(alt)}">`;
    }
    return isSafeImageUrl(url) ? `<img class="${escapeHtml(className)}" data-tf-image src="${escapeHtml(url)}" alt="${escapeHtml(alt)}">` : '';
}

function hideBrokenStoredImage(event) {
    const image = event.target;
    if (image instanceof HTMLImageElement && image.matches('img[data-tf-image]')) image.hidden = true;
}

function renderAvatar(name, { large = false, npcId = '', avatarUrl = '', avatarKey = '', action = '' } = {}) {
    const npc = npcForId(npcId);
    const url = avatarUrl || npc?.avatarUrl || '';
    const imageKey = avatarKey || npc?.avatarKey || '';
    const clickable = Boolean(action || npcId);
    const tag = clickable ? 'button' : 'span';
    const clickAction = action || (npcId ? 'open-npc' : '');
    const attrs = clickable ? `type="button" data-action="${clickAction}" ${npcId ? `data-npc-id="${escapeHtml(npcId)}"` : ''}` : '';
    const storedImage = renderStoredImage({ url, imageKey, alt: name });
    const content = storedImage ? `<span class="tf-avatar-fallback">${initials(name)}</span>${storedImage}` : initials(name);
    return `<${tag} class="tf-avatar ${large ? 'tf-avatar-large' : ''} ${clickable ? 'is-clickable' : ''}" style="--tf-avatar-hue:${avatarHue(name)}" ${attrs}>${content}</${tag}>`;
}

function renderAuthorAvatar(author, { large = false } = {}) {
    if (author?.npcId) return renderAvatar(author.author || author.name, { large, npcId: author.npcId });
    const profile = getSettings().profile;
    const authorHandle = String(author?.handle || '').replace(/^@/, '');
    if (authorHandle === 'me' || authorHandle === String(profile.handle || 'me').replace(/^@/, '')) {
        return renderAvatar(author.author || author.name, { large, avatarUrl: profile.avatarUrl, avatarKey: profile.avatarKey, action: 'open-my-profile' });
    }
    return renderAvatar(author?.author || author?.name, { large, avatarUrl: createDefaultAvatarDataUrl(author?.handle || author?.author || author?.name) });
}

function hasRealImage(post) {
    return Boolean((post.imageUrl && isSafeImageUrl(post.imageUrl)) || post.imageKey);
}

function hasUsableImageApi(config = getApiConfig('image')) {
    return Boolean(config.enabled && String(config.endpoint || '').trim() && String(config.model || '').trim());
}

function usesTextImage(post, config = getApiConfig('image')) {
    return !hasRealImage(post) && Boolean(String(post.imagePrompt || '').trim()) && Boolean(config.textFallback);
}

function localizedImagePrompt(item) {
    const prompt = String(item?.imagePrompt || '').trim();
    if (!prompt || /[\u3400-\u9fff]/u.test(prompt)) return prompt;
    const content = String(item?.content || '').replace(/\s+/g, ' ').trim();
    return /[\u3400-\u9fff]/u.test(content)
        ? `与这条动态有关的场景：${content.slice(0, 100)}`
        : '一幅与这条动态内容有关的场景画面。';
}

function renderPostImage(post) {
    if (post.imageUrl && isSafeImageUrl(post.imageUrl)) return `<img class="tf-post-image" src="${escapeHtml(post.imageUrl)}" alt="帖子配图" loading="lazy">`;
    if (post.imageKey) {
        const memoryValue = imageMemory.get(post.imageKey);
        if (memoryValue) return `<img class="tf-post-image" src="${escapeHtml(memoryValue)}" alt="帖子配图" loading="lazy">`;
        return `<div class="tf-image-loading"><span class="tf-spinner"></span><span>正在读取图片</span><img data-image-key="${escapeHtml(post.imageKey)}" alt="帖子配图"></div>`;
    }
    if (usesTextImage(post)) return `<figure class="tf-text-image"><p>${escapeHtml(localizedImagePrompt(post))}</p></figure>`;
    return '';
}

function renderCommentImage(comment) {
    if (comment.imageUrl && isSafeImageUrl(comment.imageUrl)) return `<img class="tf-comment-image" src="${escapeHtml(comment.imageUrl)}" alt="评论配图" loading="lazy">`;
    if (comment.imageKey) {
        const memoryValue = imageMemory.get(comment.imageKey);
        if (memoryValue) return `<img class="tf-comment-image" src="${escapeHtml(memoryValue)}" alt="评论配图" loading="lazy">`;
        return `<span class="tf-image-loading tf-comment-image-loading"><span class="tf-spinner"></span><img data-image-key="${escapeHtml(comment.imageKey)}" alt="评论配图"></span>`;
    }
    if (usesTextImage(comment)) return `<figure class="tf-comment-text-image"><p>${escapeHtml(localizedImagePrompt(comment))}</p></figure>`;
    return '';
}

function renderComments(post, forceOpen = false) {
    if (!forceOpen && !viewState.expandedComments.has(post.id)) return '';
    const comments = (Array.isArray(post.comments) ? post.comments : []).filter(comment => {
        const npc = npcForAuthor(comment);
        return !npc?.muted && !npc?.blocked && (!comment.moderation?.hidden || comment.moderation?.action === 'delete');
    });
    const target = viewState.replyTarget?.postId === post.id ? viewState.replyTarget : null;
    const snapshot = getChatSnapshot();
    const profile = getSettings().profile;
    const replying = viewState.replyingPosts.has(post.id);
    const ids = new Set(comments.map(comment => comment.id));
    const renderBranch = (parentId = '', depth = 0) => comments
        .filter(comment => (comment.parentId && ids.has(comment.parentId) ? comment.parentId : '') === parentId)
        .map(comment => comment.moderation?.hidden && comment.moderation?.action === 'delete'
            ? `<div class="tf-comment tf-comment-tombstone ${depth ? 'is-nested' : ''}" style="--tf-comment-depth:${Math.min(depth, 3)}"><span>${icon('shield')}</span><div><b>这条评论已被管理员删除</b><small>仅你可见 · 不可回复${comment.moderation.reason ? ` · ${escapeHtml(comment.moderation.reason)}` : ''}</small>${renderBranch(comment.id, depth + 1)}</div></div>`
            : `<div class="tf-comment ${depth ? 'is-nested' : ''}" style="--tf-comment-depth:${Math.min(depth, 3)}">
            ${renderAuthorAvatar(comment)}
            <div><p><b>${escapeHtml(comment.author)}</b>${comment.replyTo ? `<span> 回复 @${escapeHtml(comment.replyTo)}</span>` : ''} ${renderSocialText(comment.content)}</p>${comment.moderation?.warning ? `<div class="tf-moderation-warning">${icon('shield')} ${escapeHtml(comment.moderation.warning)}</div>` : ''}${renderCommentImage(comment)}<div class="tf-comment-actions"><button data-action="start-reply" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}" data-reply-handle="${escapeHtml(comment.handle || '')}">回复</button><button class="${comment.likedByUser ? 'is-liked' : ''}" data-action="like-comment" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}">${icon('heart')} ${numberLabel(comment.likes)}</button><button data-action="report-comment" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}" title="举报评论">${icon('shield')}</button><button data-action="generate-comment-image" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(comment.id)}" title="${comment.imageUrl || comment.imageKey ? '更换评论配图' : '添加评论配图'}">${viewState.imageBusy.has(`comment-${comment.id}`) ? '<span class="tf-spinner"></span>' : icon('image')}</button></div>${renderBranch(comment.id, depth + 1)}</div>
        </div>`).join('');
    return `<section class="tf-comments">
        ${comments.length ? renderBranch() : '<p class="tf-empty-mini">还没有评论</p>'}
        <div class="tf-reply-composer">
            ${target ? `<div class="tf-reply-context">回复 @${escapeHtml(target.handle)}</div>` : ''}
            <input class="tf-reply-author" value="${escapeHtml(getMyDisplayName())}" hidden><input class="tf-reply-handle" value="${escapeHtml(profile.handle || 'me')}" hidden>
            <textarea class="tf-reply-content" rows="2" maxlength="1500" placeholder="写下评论…"></textarea>
            <details class="tf-reply-image-options"><summary>${icon('image')}<span>添加图片</span></summary><div><input class="tf-reply-image-prompt" maxlength="500" placeholder="描述评论配图；没有生图 API 时显示为文字配图"></div></details>
            <button class="tf-secondary-button tf-generate-thread-replies" data-action="generate-thread-replies" data-post-id="${escapeHtml(post.id)}" ${replying ? 'disabled' : ''} title="让其他角色继续回帖">${replying ? '<span class="tf-spinner"></span>' : icon('sparkles')}<span>生成角色回帖</span></button>
            <button class="tf-circle-button" data-action="submit-reply" data-post-id="${escapeHtml(post.id)}" ${replying ? 'disabled' : ''} title="发布评论">${replying ? '<span class="tf-spinner"></span>' : icon('send')}</button>
        </div>
    </section>`;
}

function postSearchText(post) {
    return [post.author, post.handle, post.content, post.quoteText, ...(post.tags || []), ...(post.comments || []).flatMap(comment => [comment.author, comment.handle, comment.content])].join(' ').toLocaleLowerCase();
}

function renderPostImageEditor(post) {
    if (viewState.openPostImageEditorId !== post.id) return '';
    const buttonLabel = hasUsableImageApi() ? '生成图片' : '显示文字配图';
    return `<div class="tf-post-image-editor"><div>${icon('image')}<input class="tf-post-image-prompt-input" maxlength="500" value="${escapeHtml(post.imagePrompt || '')}" placeholder="描述这篇帖子的配图画面"></div><button class="tf-primary-button" data-action="save-post-image-prompt" data-post-id="${escapeHtml(post.id)}">${buttonLabel}</button><button class="tf-text-button" data-action="toggle-post-image-editor" data-post-id="${escapeHtml(post.id)}">取消</button></div>`;
}

function renderPost(post, { detail = false } = {}) {
    if (post.moderation?.hidden && post.moderation?.action === 'delete') {
        return `<article class="tf-post tf-card tf-post-tombstone" data-post-id="${escapeHtml(post.id)}"><span>${icon('shield')}</span><div><small>社区管理记录 · ${formatTime(post.moderation.updatedAt || post.createdAt)}</small><h3>这篇帖子已被管理员删除</h3><p>原内容仅保留为本地管理记录，不可查看、回复、转发或注入正文。</p>${post.moderation.reason ? `<em>${escapeHtml(post.moderation.reason)}</em>` : ''}<b>此提示仅你可见；此前看过内容的角色仍可能保留模糊印象。</b></div></article>`;
    }
    const injecting = Boolean(post.selectedForInjection);
    const imageBusy = viewState.imageBusy.has(post.id);
    const commentsCount = Array.isArray(post.comments) ? post.comments.filter(comment => {
        const npc = npcForAuthor(comment);
        return !npc?.muted && !npc?.blocked;
    }).length : 0;
    const authorHeader = post.npcId
        ? `<button class="tf-post-author" data-action="open-npc" data-npc-id="${escapeHtml(post.npcId)}"><b>${escapeHtml(post.author)}</b><span>@${escapeHtml(post.handle || 'user')} · ${formatTime(post.createdAt)}</span></button>`
        : isMyHandle(post.handle)
            ? `<button class="tf-post-author" data-action="open-my-profile"><b>${escapeHtml(post.author)}</b><span>@${escapeHtml(post.handle || 'me')} · ${formatTime(post.createdAt)}</span></button>`
            : `<div><b>${escapeHtml(post.author)}</b><span>@${escapeHtml(post.handle || 'user')} · ${formatTime(post.createdAt)}</span></div>`;
    const authorNpc = post.npcId ? npcForId(post.npcId) : null;
    const moderationItems = authorNpc ? `<hr><button data-action="toggle-role-muted" data-npc-id="${escapeHtml(authorNpc.id)}">${icon('message')}<span>${authorNpc.muted ? '取消静音该角色' : '静音该角色'}</span></button><button class="${authorNpc.blocked ? '' : 'is-danger'}" data-action="toggle-role-blocked" data-npc-id="${escapeHtml(authorNpc.id)}">${icon('lock')}<span>${authorNpc.blocked ? '解除拉黑' : '拉黑该角色'}</span></button>` : '';
    const imageMarkup = renderPostImage(post);
    const captionMarkup = `<div class="tf-post-caption"><p><b>${escapeHtml(post.author)}</b> ${renderSocialText(post.content)}</p>${(post.tags || []).length ? `<div class="tf-tags">${post.tags.map(tag => `<button data-action="topic-search" data-topic="${escapeHtml(String(tag).replace(/^#/, ''))}">#${escapeHtml(String(tag).replace(/^#/, ''))}</button>`).join('')}</div>` : ''}</div>`;
    return `<article class="tf-post tf-card" data-post-id="${escapeHtml(post.id)}" data-search-text="${escapeHtml(postSearchText(post))}">
        <header class="tf-post-header">
            ${renderAuthorAvatar(post)}
            ${authorHeader}
            <div class="tf-post-menu-wrap"><button class="tf-icon-button" data-action="toggle-post-menu" data-post-id="${escapeHtml(post.id)}" title="帖子菜单">${icon('more')}</button>${viewState.openPostMenuId === post.id ? `<div class="tf-post-menu"><button data-action="toggle-post-injection" data-post-id="${escapeHtml(post.id)}">${icon('shield')}<span>${injecting ? '停止注入这篇帖子' : '将这篇帖子注入正文'}</span><i class="${injecting ? 'is-on' : ''}"></i></button><button data-action="favorite-post" data-post-id="${escapeHtml(post.id)}">${icon('bookmark')}<span>${post.favorite ? '取消收藏' : '收藏帖子'}</span></button><button data-action="report-post" data-post-id="${escapeHtml(post.id)}">${icon('shield')}<span>举报帖子</span></button>${moderationItems}<button class="is-danger" data-action="delete-post" data-post-id="${escapeHtml(post.id)}">${icon('trash')}<span>删除帖子</span></button></div>` : ''}</div>
        </header>
        ${post.moderation?.warning ? `<div class="tf-moderation-warning">${icon('shield')} ${escapeHtml(post.moderation.warning)}</div>` : ''}
        ${captionMarkup}
        ${post.repostOf ? `<div class="tf-repost-label">${icon('repost')} 转发 / 引用了一篇帖子</div>` : ''}
        ${post.quoteText ? `<blockquote class="tf-quote-post">${renderSocialText(post.quoteText)}</blockquote>` : ''}
        ${post.poll ? `<section class="tf-poll"><b>${escapeHtml(post.poll.question)}</b>${post.poll.options.map(option => `<button class="${option.votedByUser ? 'is-selected' : ''}" data-action="vote-poll" data-post-id="${escapeHtml(post.id)}" data-option-id="${escapeHtml(option.id)}" ${post.poll.closed ? 'disabled' : ''}><span>${escapeHtml(option.text)}</span><em>${numberLabel(option.votes)} 票</em></button>`).join('')}</section>` : ''}
        ${imageMarkup}
        <div class="tf-post-actions">
            <button class="${post.likedByUser ? 'is-liked' : ''}" data-action="like-post" data-post-id="${escapeHtml(post.id)}" title="点赞">${icon('heart')}<span>${numberLabel(post.likes)}</span></button>
            <button data-action="open-post" data-post-id="${escapeHtml(post.id)}" title="打开完整帖子">${icon('comment')}<span>${commentsCount}</span></button>
            <button data-action="quote-post" data-post-id="${escapeHtml(post.id)}" title="转发或引用">${icon('repost')}<span>${numberLabel(post.reposts)}</span></button>
            <button data-action="toggle-post-image-editor" data-post-id="${escapeHtml(post.id)}" ${imageBusy ? 'disabled' : ''} title="${hasRealImage(post) || post.imagePrompt ? '管理配图' : '添加配图'}">${imageBusy ? '<span class="tf-spinner"></span>' : icon('image')}</button>
        </div>
        ${renderPostImageEditor(post)}
        ${!detail && commentsCount ? `<button class="tf-view-comments" data-action="open-post" data-post-id="${escapeHtml(post.id)}">查看全部 ${commentsCount} 条评论</button>` : ''}
        ${renderComments(post, detail)}
    </article>`;
}

function renderPostDetail(data, post) {
    if (!post) return `<section class="tf-detail-page"><header><button class="tf-back-button" data-action="back-post">${icon('chevron')}返回</button><h2>帖子不存在</h2></header></section>`;
    return `<section class="tf-detail-page"><header class="tf-detail-header"><button class="tf-back-button" data-action="back-post">${icon('chevron')}返回</button><div><h2>帖子</h2><p>@${escapeHtml(post.handle || 'user')}</p></div></header><div class="tf-detail-post">${renderPost(post, { detail: true })}</div></section>`;
}

function renderComposer() {
    const snapshot = getChatSnapshot();
    const profile = getSettings().profile;
    const name = getMyDisplayName();
    const avatar = renderAvatar(name, { avatarUrl: profile.avatarUrl, avatarKey: profile.avatarKey });
    if (!viewState.composerOpen) return `<button class="tf-compose-collapsed tf-card" data-action="toggle-composer">${avatar}<span>分享故事世界里的新鲜事…</span>${icon('plus')}</button>`;
    const poll = viewState.composerPoll;
    return `<section class="tf-composer tf-card"><header>${avatar}<b>发布新帖子</b></header><input id="tf-compose-author" value="${escapeHtml(name)}" hidden><input id="tf-compose-handle" value="${escapeHtml(profile.handle || 'me')}" hidden><textarea id="tf-compose-content" rows="4" maxlength="2000" placeholder="写下帖子内容；可以使用 @账号 提及角色…"></textarea><input id="tf-compose-tags" placeholder="话题标签（用逗号分隔）">${poll ? `<div class="tf-compose-poll"><b>${escapeHtml(poll.question)}</b><span>${poll.options.map(option => escapeHtml(option)).join(' · ')}</span><button data-action="remove-composer-poll">移除</button></div>` : ''}<footer><button class="tf-secondary-button" data-action="add-composer-poll">${icon('plus')}投票</button><span></span><button class="tf-text-button" data-action="toggle-composer">取消</button><button class="tf-primary-button" data-action="publish-manual">发布</button></footer></section>`;
}

function renderStories(data) {
    const snapshot = getChatSnapshot();
    const roles = data.npcs.filter(npc => !(npc.bindingType === 'char' && npc.bindingTarget === snapshot.characterId)).slice(0, 11);
    const people = [{ id: '', name: snapshot.characterName, avatarUrl: snapshot.characterAvatarUrl, isChar: true }, ...roles];
    return `<section class="tf-stories tf-card">${people.map(person => `<button data-action="${person.isChar ? 'open-char-dm' : 'open-npc'}" ${person.id ? `data-npc-id="${escapeHtml(person.id)}"` : ''}>${renderAvatar(person.name, { avatarUrl: person.avatarUrl, avatarKey: person.avatarKey })}<span>${escapeHtml(person.name)}</span></button>`).join('')}</section>`;
}

function renderWorldPortal(data) {
    const settings = getSettings();
    const definitions = WORLD_MODULE_DEFINITIONS.filter(definition => !['forum', 'moderation'].includes(definition.id) && settings.modules[definition.id]?.enabled);
    if (!definitions.length) return '';
    const counts = {
        moderation: data.world.reports.filter(item => ['pending', 'reviewing'].includes(item.status)).length,
        tasks: data.world.tasks.filter(item => ['offered', 'accepted'].includes(item.status)).length,
        fortune: data.world.fortune ? data.world.fortune.label : '',
        travel: data.world.companion?.status === 'away' ? '外出中' : '在家',
        inventory: data.world.inventory.filter(item => !item.consumed && item.quantity > 0).length,
        health: data.world.health.filter(item => item.status !== 'resolved').length,
    };
    return `<nav class="tf-world-portal tf-card" aria-label="世界功能入口">${definitions.map(definition => `<button data-action="open-world-page" data-module-id="${escapeHtml(definition.id)}"><span>${definition.id === 'travel' ? renderPixelCompanion(data.world.companion.species, data.world.companion.status, true, data.world.companion) : icon(definition.icon)}</span><b>${escapeHtml(definition.name)}</b>${counts[definition.id] !== '' ? `<small>${escapeHtml(String(counts[definition.id]))}</small>` : ''}</button>`).join('')}</nav>`;
}

function renderWorldAppDock(cards, companion, className = '') {
    return `<nav class="tf-world-app-dock ${className}" aria-label="世界应用">${cards.map(([id, name, summary, state]) => `<button class="tf-service-card tf-world-app-icon is-${id}" data-action="open-world-page" data-module-id="${id}" title="${escapeHtml(summary)}"><span class="tf-service-icon">${id === 'travel' ? renderPixelCompanion(companion.species, companion.status, true, companion) : icon(getModuleDefinition(id)?.icon || 'sparkles')}</span><span><b>${escapeHtml(name)}</b><small>${escapeHtml(state)}</small></span><i aria-hidden="true"></i></button>`).join('')}</nav>`;
}

function renderWorldWindowWeather() {
    return `<span class="tf-window-weather-layer" aria-hidden="true"><i class="tf-window-sun"></i><i class="tf-window-moon">☾</i><i class="tf-window-cloud is-one"></i><i class="tf-window-cloud is-two"></i><i class="tf-window-rain">${'<b></b>'.repeat(12)}</i><i class="tf-window-snow">${'<b>✦</b>'.repeat(10)}</i><i class="tf-window-wind"><b></b><b></b><b></b></i></span>`;
}

function renderServicesHub(data) {
    const settings = getSettings();
    const world = data.world;
    const companion = world.companion;
    const time = getLocalCompanionTime(companion);
    const weather = getLocalCompanionWeather(data, time);
    const weatherClass = String(weather.id || 'sunny').split(/\s+/)[0];
    const activeTask = [...world.tasks].reverse().find(item => ['offered', 'accepted'].includes(item.status));
    const activeHealth = [...world.health].reverse().find(item => item.status !== 'resolved');
    const latestItem = [...world.inventory].reverse().find(item => !item.consumed && item.quantity > 0);
    const latestTrip = [...world.trips].reverse().find(item => ['planned', 'away', 'returned'].includes(item.status));
    const localModules = ['travel', 'fortune', 'health'].filter(id => settings.modules[id]?.enabled).length;
    const cards = [
        ['travel', '旅伴', companion.status === 'away' ? `${companion.name}正在${companion.destination || '外面'}旅行` : getCompanionAmbientReaction(data), companion.status === 'away' ? '旅途中' : companion.status === 'resting' ? '休息中' : '在家可互动', latestTrip?.status === 'returned' ? '最近一次旅行已经返程' : `${weather.icon} ${weather.label}`],
        ['health', '健康与医疗', activeHealth ? `${activeHealth.subject} · ${activeHealth.name}` : '今天没有需要处理的身体事件', activeHealth ? `${activeHealth.progress}% · ${activeHealth.status === 'recovering' ? '恢复中' : '待处理'}` : '状态良好', activeHealth?.provider ? `正在联系：${activeHealth.provider}` : '可在本地触发日常事件'],
        ['tasks', '委托', activeTask?.title || '暂时没有正在进行的委托', `${world.tasks.filter(item => ['offered', 'accepted'].includes(item.status)).length} 件待办`, activeTask?.issuer ? `来自 ${activeTask.issuer}` : '角色消息会在这里汇总'],
        ['fortune', '今日运势', world.fortune?.summary || '翻开一张只在本地计算的今日签', world.fortune?.label || '尚未抽取', world.fortune?.modifiers?.luckyDirection ? `幸运方向：${world.fortune.modifiers.luckyDirection}` : '不会自动调用 API'],
        ['inventory', '背包', latestItem ? `最近收进：${latestItem.name}` : '旅途纪念和任务奖励会自动收进这里', `${world.inventory.filter(item => !item.consumed && item.quantity > 0).length} 种物品`, latestItem?.source || '背包目前为空'],
    ].filter(([id]) => settings.modules[id]?.enabled);
    const layout = settings.ui.worldHomeLayout === 'window' ? 'window' : 'bento';
    const now = new Date();
    const dateLabel = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日　${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][now.getDay()]}`;
    const header = `<header class="tf-world-home-title"><div><small>WORLD HOME</small><h1>世界</h1><p class="tf-world-home-description">每个功能都在自己的 App 中运行；这里保留今天最重要的摘要与稳定入口。</p><p class="tf-world-home-date">${escapeHtml(dateLabel)}</p></div><div><span class="tf-world-local-state"><i></i>${localModules} 项本地运行</span></div></header>`;
    const empty = `<section class="tf-card tf-empty tf-service-empty"><div class="tf-empty-icon">${icon('sparkles')}</div><h3>世界还没有开始运转</h3><p>可以从设置中心的“功能与联动”开启需要的模块。</p><button class="tf-primary-button" data-action="open-settings" data-section="modules">去设置</button></section>`;
    if (!cards.length) return `<section class="tf-services-page tf-world-hub is-layout-${layout}">${header}${empty}</section>`;
    if (layout === 'window') {
        const travelAction = settings.modules.travel?.enabled ? 'data-action="open-world-page" data-module-id="travel"' : 'disabled';
        return `<section class="tf-services-page tf-world-hub is-layout-window is-weather-${escapeHtml(weatherClass)} is-time-${escapeHtml(time.id)}">${header}<section class="tf-world-window-shell"><div class="tf-world-window-scene"><span class="tf-window-scene-image"></span><span class="tf-window-time-tint"></span>${renderWorldWindowWeather()}<button class="tf-window-weather-chip" ${travelAction}>${weather.icon}<b>${escapeHtml(weather.label)}</b><small>${time.automatic && weather.automatic ? '自动环境' : '手动环境'}</small></button><button class="tf-window-pet-stage" ${travelAction} aria-label="打开旅伴">${renderPixelCompanion(companion.species, companion.status)}</button><button class="tf-window-reaction" ${travelAction}>${escapeHtml(companion.status === 'away' ? companion.message || '正在旅途中。' : getCompanionAmbientReaction(data))}</button><button class="tf-window-companion" ${travelAction}>${renderPixelCompanion(companion.species, companion.status, true)}<span><b>${escapeHtml(companion.name)}</b><small>${escapeHtml(companion.status === 'away' ? companion.destination || '旅途中' : `${companion.mood || '平静'} · 亲密 ${Number(companion.bond || 0)}`)}</small></span></button>${settings.modules.fortune?.enabled ? `<button class="tf-window-fortune" data-action="open-world-page" data-module-id="fortune"><i>${world.fortune?.sigil || '◇'}</i><span><small>今日运势</small><b>${escapeHtml(world.fortune?.label || '等待揭晓')}</b><em>${escapeHtml(world.fortune?.theme || '抽取一张今日签')}</em></span>${icon('chevron')}</button>` : ''}</div>${renderWorldAppDock(cards, companion, 'is-window-rail')}</section><footer class="tf-world-runtime-strip"><i></i><b>世界正在本地运行</b><span>所有功能均在本地执行，切换布局不会调用 API。</span></footer></section>`;
    }
    const travelAction = settings.modules.travel?.enabled ? 'data-action="open-world-page" data-module-id="travel"' : 'disabled';
    return `<section class="tf-services-page tf-world-hub is-layout-bento">${header}<section class="tf-world-bento"><button class="tf-world-bento-companion" ${travelAction}><header><div><small>我的旅伴</small><h2>${escapeHtml(companion.name)}</h2><em>${escapeHtml(companion.status === 'away' ? companion.destination || '旅途中' : `${companion.mood || '平静'} · 亲密 ${Number(companion.bond || 0)}`)}</em></div>${icon('chevron')}</header><span class="tf-bento-pet-stage">${renderPixelCompanion(companion.species, companion.status)}<i>♥</i></span><p class="tf-bento-reaction"><span>♡</span>${escapeHtml(companion.status === 'away' ? companion.message || '正在旅途中。' : getCompanionAmbientReaction(data))}</p></button><div class="tf-world-bento-side"><button class="tf-world-bento-weather" ${travelAction}><span>${weather.icon}</span><div><small>${time.automatic && weather.automatic ? '本地环境' : '手动环境'}</small><b>${escapeHtml(weather.label)}</b><p>${escapeHtml(weather.note)}</p></div>${icon('chevron')}</button>${settings.modules.fortune?.enabled ? `<button class="tf-world-bento-fortune" data-action="open-world-page" data-module-id="fortune"><span>${world.fortune?.sigil || '◇'}</span><div><small>今日运势</small><b>${escapeHtml(world.fortune?.label || '等待揭晓')}</b><p>${escapeHtml(world.fortune?.theme || '抽取一张今日签')}</p></div>${icon('chevron')}</button>` : ''}</div></section>${renderWorldAppDock(cards, companion, 'is-bento-dock')}</section>`;
}

function getFeedPosts(data) {
    const normalizeHandle = value => String(value || '').replace(/^@/, '').trim().toLocaleLowerCase();
    const normalizeName = value => String(value || '').trim().toLocaleLowerCase();
    const roleMatchesPost = (npc, post) => (post.npcId && npc.id === post.npcId)
        || (normalizeHandle(npc.handle) && normalizeHandle(npc.handle) === normalizeHandle(post.handle))
        || (normalizeName(npc.name) && normalizeName(npc.name) === normalizeName(post.author));
    const roleForPost = post => data.npcs.find(npc => npc.id === post.npcId)
        || data.npcs.find(npc => normalizeHandle(npc.handle) && normalizeHandle(npc.handle) === normalizeHandle(post.handle))
        || data.npcs.find(npc => normalizeName(npc.name) && normalizeName(npc.name) === normalizeName(post.author));
    const visible = data.posts.filter(post => {
        const npc = roleForPost(post);
        return (!post.moderation?.hidden || post.moderation?.action === 'delete') && !npc?.muted && !npc?.blocked && (!viewState.selectedTopic || (post.tags || []).some(tag => String(tag).toLocaleLowerCase() === viewState.selectedTopic.toLocaleLowerCase()));
    });
    if (viewState.feedMode === 'following') return visible.filter(post => isMyHandle(post.handle) || data.npcs.some(npc => npc.followedByUser && roleMatchesPost(npc, post))).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (viewState.feedMode === 'latest') return visible.sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    if (viewState.feedMode === 'hot') return visible.sort((a, b) => ((Number(b.likes) + (b.comments?.length || 0) * 4 + Number(b.reposts) * 3 + Number(b.storyRelevance || 0)) - (Number(a.likes) + (a.comments?.length || 0) * 4 + Number(a.reposts) * 3 + Number(a.storyRelevance || 0))));
    return visible.sort((a, b) => {
        const score = post => {
            const npc = roleForPost(post);
            return Number(post.storyRelevance || 0) + Number(npc?.memory?.relationshipScore || 0) + (npc?.followedByUser ? 45 : 0) + (post.tags?.length || 0) * 3 + Number(post.createdAt || 0) / 1e12;
        };
        return score(b) - score(a);
    });
}

function renderHome(data) {
    const active = hasActiveChat();
    const forumEnabled = getSettings().modules.forum.enabled;
    const posts = getFeedPosts(data);
    const feeds = [['following', '关注'], ['recommended', '推荐'], ['latest', '最新'], ['hot', '热门']];
    const fortune = getSettings().modules.fortune.enabled && data.world.fortune
        ? `<button class="tf-fortune-glance tf-card" data-action="open-world-page" data-module-id="fortune"><span>${icon('sparkles')}</span><div><small>今天</small><b>${escapeHtml(data.world.fortune.label)}</b><p>${escapeHtml(data.world.fortune.summary)}</p></div>${icon('chevron')}</button>`
        : '';
    return `<div class="tf-home-page"><div class="tf-feed-column">
        <section class="tf-feed-heading"><div><h1>${escapeHtml(data.topic || '故事动态')}</h1><p>${!forumEnabled ? '论坛模块当前已暂停' : active ? `${escapeHtml(getChatSnapshot().characterName)} · 当前聊天专属社区` : '请先打开一个角色聊天'}</p></div><button class="tf-primary-button" data-action="generate-posts" ${viewState.busy || !active || !forumEnabled ? 'disabled' : ''}>${viewState.busy ? '<span class="tf-spinner"></span>' : icon('sparkles')}<span>${viewState.busy ? '刷新中' : '刷新'}</span></button></section>
        ${renderStories(data)}${fortune}<nav class="tf-feed-tabs">${feeds.map(([id, label]) => `<button class="${viewState.feedMode === id ? 'is-active' : ''}" data-action="feed-mode" data-feed="${id}">${label}</button>`).join('')}</nav>${viewState.selectedTopic ? `<section class="tf-topic-header tf-card"><div><small>话题详情</small><h2>#${escapeHtml(viewState.selectedTopic)}</h2><p>${posts.length} 篇相关帖子</p></div><button class="tf-secondary-button" data-action="clear-topic">返回全部</button></section>` : ''}${renderComposer()}
        <div class="tf-search-result" ${viewState.searchQuery ? '' : 'hidden'}>搜索结果：<b data-search-count>0</b> 篇帖子</div>
        <div class="tf-feed-list">${viewState.busy ? '<div class="tf-card tf-skeleton"><i></i><p></p><p></p></div>' : ''}${posts.length ? posts.map(renderPost).join('') : '<section class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('image')+'</div><h3>这里还没有动态</h3><p>可以切换信息流，或关注更多角色。</p></section>'}</div>
    </div></div>`;
}

function prepareConversations(data) {
    if (!hasActiveChat()) return null;
    const before = data.conversations.length;
    const conversation = ensureCharacterConversation(data, getChatSnapshot());
    if (data.conversations.length !== before) void saveForumData(data);
    if (!viewState.selectedConversationId) viewState.selectedConversationId = conversation.id;
    return conversation;
}

function getConversationProfileNpc(data, conversation) {
    if (!conversation || conversation.type === 'role_dm') return null;
    if (conversation.type === 'npc') return data.npcs.find(npc => npc.id === conversation.targetId) || null;
    if (conversation.type === 'char') {
        return data.npcs.find(npc => npc.bindingType === 'char' && npc.bindingTarget === conversation.targetId)
            || ensureCharacterRole(data, getChatSnapshot());
    }
    return null;
}

function strangerDmAllowed(npc, { decide = false } = {}) {
    if (!npc || npc.systemRole || npc.followsUser) return true;
    const settings = getSettings();
    const policy = settings.social.directMessagePolicy;
    if (policy === 'open') return true;
    if (policy === 'following') return false;
    if (npc.dmAccess === 'allowed') return true;
    if (npc.dmAccess === 'denied') return false;
    const seed = Array.from(`${npc.id}|${npc.handle}`).reduce((sum, char) => ((sum * 31) + char.codePointAt(0)) >>> 0, 2166136261);
    const allowed = (seed % 100) >= Number(settings.social.strangerBlockChance || 0);
    if (decide) npc.dmAccess = allowed ? 'allowed' : 'denied';
    return allowed;
}

function isConversationAllowed(data, conversation) {
    if (!conversation) return false;
    if (conversation.type === 'role_dm') {
        return (conversation.participantIds || []).every(id => !data.npcs.find(npc => npc.id === id)?.blocked);
    }
    return !getConversationProfileNpc(data, conversation)?.blocked;
}

function renderConversationList(data) {
    const conversations = [...data.conversations].filter(conversation => isConversationAllowed(data, conversation)).sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt));
    const roleDmEnabled = getSettings().social.roleDirectMessages;
    const availableRoles = getRoleLibrary(data).filter(npc => !npc.systemRole && !npc.blocked && strangerDmAllowed(npc) && !data.conversations.some(item => item.type === 'npc' && item.targetId === npc.id));
    return `<aside class="tf-dm-list"><header><h2>消息</h2><div><button class="tf-icon-button" data-action="new-dm-npc" title="新建用户与角色私信">${icon('plus')}</button><button class="tf-icon-button" data-action="new-role-dm" title="新建角色之间私信" ${roleDmEnabled ? '' : 'disabled'}>${icon('users')}</button></div></header><div class="tf-dm-contacts">${conversations.map(conversation => {
        const last = conversation.messages[conversation.messages.length - 1];
        return `<button class="tf-dm-contact ${conversation.id === viewState.selectedConversationId ? 'is-active' : ''}" data-action="open-conversation" data-conversation-id="${escapeHtml(conversation.id)}" data-contact-search="${escapeHtml(`${conversation.name} ${conversation.handle}`.toLocaleLowerCase())}">${conversation.type === 'role_dm' ? `<span class="tf-private-avatar">${icon('lock')}</span>` : conversation.type === 'companion' ? renderCompanionAvatar(data) : renderAvatar(conversation.name, { avatarUrl: conversation.avatarUrl, avatarKey: conversation.avatarKey })}<div><b>${escapeHtml(conversation.name)}${conversation.type === 'role_dm' ? '<small> 私密</small>' : ''}</b><p>${escapeHtml(last?.content || (conversation.type === 'char' ? '酒馆当前 Char' : '开始一段私信'))}</p></div>${conversation.unread ? `<span>${conversation.unread}</span>` : ''}</button>`;
    }).join('')}</div><section class="tf-new-contacts"><h3>开始新私信</h3>${availableRoles.slice(0, 8).map(npc => `<button data-action="start-npc-dm" data-npc-id="${escapeHtml(npc.id)}">${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<span>${escapeHtml(npc.name)}</span>${icon('chevron')}</button>`).join('') || '<p>只有已生成人设并进入角色库的角色可以开启新私信</p>'}${roleDmEnabled ? '<button class="tf-role-dm-entry" data-action="new-role-dm">＋ 创建 A 与 B 的私密对话</button>' : '<p class="tf-private-note">角色之间私信当前关闭，可在“我 → 信息边界”开启。</p>'}</section></aside>`;
}

function taskStatusLabel(task) {
    return ({ offered: '等待回应', accepted: '进行中', completed: '已验收', failed: '未完成', abandoned: '已婉拒' })[task?.status] || '状态未知';
}

function renderTaskVerificationState(task) {
    if (task.status !== 'accepted') return '';
    const state = task.verificationStatus || 'unverified';
    if (state === 'checking') return '<span class="tf-task-proof is-checking">正在核对正文证据</span>';
    if (state === 'eligible' || state === 'verified') return `<span class="tf-task-proof is-ready">已找到正文证据${task.evidenceExcerpt ? `：${escapeHtml(task.evidenceExcerpt.slice(0, 90))}` : ''}</span>`;
    if (state === 'rejected') return `<span class="tf-task-proof is-missing">${escapeHtml(task.verificationReason || '正文证据不足')}</span>`;
    return '<span class="tf-task-proof">等待正文出现完成证据</span>';
}

function renderTaskActions(task, { includeOpen = false } = {}) {
    const busy = viewState.taskVerificationBusy.has(task.id);
    if (task.status === 'offered') return `<button data-action="set-task-status" data-status="accepted">接受委托</button><button class="tf-secondary-button" data-action="set-task-status" data-status="abandoned">婉拒</button>${includeOpen ? '<button class="tf-secondary-button" data-action="open-task-app">任务详情</button>' : ''}`;
    if (task.status === 'accepted') return `<button data-action="verify-task-completion" ${busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span>正在验收' : `${icon('shield')}提交验收`}</button><button class="tf-secondary-button" data-action="set-task-status" data-status="abandoned">放弃任务</button>${includeOpen ? '<button class="tf-secondary-button" data-action="open-task-app">任务详情</button>' : ''}`;
    if (task.status === 'completed' && !task.verifiedAt) return `<button class="tf-secondary-button" data-action="reopen-legacy-task">撤销旧版完成</button>${includeOpen ? '<button class="tf-secondary-button" data-action="open-task-app">查看记录</button>' : ''}`;
    return includeOpen ? '<button class="tf-secondary-button" data-action="open-task-app">查看记录</button>' : '';
}

function renderDirectChat(data) {
    const available = data.conversations.filter(item => isConversationAllowed(data, item));
    const conversation = available.find(item => item.id === viewState.selectedConversationId) || available[0];
    if (!conversation) return '<section class="tf-dm-chat tf-empty"><div class="tf-empty-icon">'+icon('message')+'</div><h3>选择联系人</h3><p>与当前 Char 或论坛角色开始私信。</p></section>';
    viewState.selectedConversationId = conversation.id;
    const messages = conversation.messages || [];
    if (conversation.type === 'role_dm') {
        const participants = (conversation.participantIds || []).map(id => data.npcs.find(npc => npc.id === id)).filter(Boolean);
        if (participants.length < 2) return '<section class="tf-dm-chat tf-empty"><h3>私信参与者已不存在</h3></section>';
        return `<section class="tf-dm-chat tf-role-dm-chat"><header><button class="tf-dm-mobile-back" data-action="back-dm-list" aria-label="返回联系人">${icon('chevron')}</button><span class="tf-private-avatar">${icon('lock')}</span><div><b>${escapeHtml(conversation.name)}</b><span>仅这两位角色可知 · 不注入公共正文</span></div></header><div class="tf-dm-messages">${messages.length ? messages.map(message => {
            const sender = participants.find(npc => npc.id === message.senderNpcId);
            return `<div class="tf-dm-bubble ${message.senderNpcId === participants[0].id ? 'is-me' : 'is-them'}"><b>${escapeHtml(sender?.name || message.senderName || '角色')}</b><p>${renderSocialText(message.content)}</p><time>${formatTime(message.createdAt)}</time></div>`;
        }).join('') : `<div class="tf-dm-welcome"><span class="tf-private-avatar tf-avatar-large">${icon('lock')}</span><h3>私密对话尚未开始</h3><p>A 与 B 的内容不会让第三个角色知道，也不会进入正文注入。</p></div>`}</div><form class="tf-role-dm-composer" data-conversation-id="${escapeHtml(conversation.id)}"><select id="tf-role-dm-speaker">${participants.map(npc => `<option value="${escapeHtml(npc.id)}">下一条由 ${escapeHtml(npc.name)} 发送</option>`).join('')}</select><textarea id="tf-role-dm-direction" rows="2" placeholder="可选：给这一轮的幕后方向（不会保存为用户发言）"></textarea><button type="submit" class="tf-primary-button" data-action="generate-role-dm" data-conversation-id="${escapeHtml(conversation.id)}" ${viewState.dmBusy ? 'disabled' : ''}>${viewState.dmBusy ? '<span class="tf-spinner"></span>' : icon('sparkles')}生成下一条</button></form></section>`;
    }
    const profileNpc = getConversationProfileNpc(data, conversation);
    const profileId = profileNpc?.id || '';
    const companionAvatar = conversation.type === 'companion' ? renderCompanionAvatar(data) : '';
    const header = profileId
        ? `<button class="tf-dm-profile-link" data-action="open-npc" data-npc-id="${escapeHtml(profileId)}" title="查看 ${escapeHtml(conversation.name)} 的主页">${renderAvatar(conversation.name, { avatarUrl: conversation.avatarUrl, avatarKey: conversation.avatarKey })}<div><b>${escapeHtml(conversation.name)}</b><span>@${escapeHtml(conversation.handle)}</span></div></button><button class="tf-icon-button" data-action="open-npc" data-npc-id="${escapeHtml(profileId)}" title="查看主页">${icon('user')}</button>`
        : `${companionAvatar || renderAvatar(conversation.name, { avatarUrl: conversation.avatarUrl, avatarKey: conversation.avatarKey })}<div><b>${escapeHtml(conversation.name)}</b><span>@${escapeHtml(conversation.handle)}</span></div>`;
    const welcomeAvatar = profileId
        ? renderAvatar(conversation.name, { large: true, npcId: profileId, avatarUrl: conversation.avatarUrl, avatarKey: conversation.avatarKey })
        : conversation.type === 'companion' ? renderCompanionAvatar(data, true) : renderAvatar(conversation.name, { large: true, avatarUrl: conversation.avatarUrl, avatarKey: conversation.avatarKey });
    return `<section class="tf-dm-chat"><header><button class="tf-dm-mobile-back" data-action="back-dm-list" aria-label="返回联系人">${icon('chevron')}</button>${header}</header><div class="tf-dm-messages">${messages.length ? messages.map(message => {
        const task = message.taskId ? data.world.tasks.find(item => item.id === message.taskId) : null;
        const card = task ? `<div class="tf-dm-task-card" data-world-item-id="${escapeHtml(task.id)}"><header><b>${escapeHtml(task.title)}</b><small>${escapeHtml(taskStatusLabel(task))}</small></header><p>${escapeHtml(task.description)}</p><span>目标：${escapeHtml(task.objectiveTarget || task.title)} ×${Number(task.objectiveQuantity || 1)}</span>${renderTaskVerificationState(task)}<footer>${renderTaskActions(task, { includeOpen: true })}</footer></div>` : '';
        return `<div class="tf-dm-bubble ${message.role === 'user' ? 'is-me' : 'is-them'}"><p>${escapeHtml(message.content)}</p>${card}<time>${formatTime(message.createdAt)}</time></div>`;
    }).join('') : `<div class="tf-dm-welcome">${welcomeAvatar}<h3>${escapeHtml(conversation.name)}</h3><p>${conversation.type === 'char' ? '这是酒馆当前 Char 的独立私信。' : conversation.type === 'companion' ? '它外出后寄回的消息会留在这里。' : '这段对话使用该角色的人设。'}</p></div>`}</div>${conversation.type === 'companion' ? `<div class="tf-companion-chat-actions"><button class="tf-secondary-button" data-action="open-world-page" data-module-id="travel">看看它的小窝</button><button class="tf-secondary-button" data-action="refresh-world-module" data-module-id="travel">${icon('refresh')}等待新消息</button></div>` : `<form class="tf-dm-composer" data-conversation-id="${escapeHtml(conversation.id)}"><textarea id="tf-dm-input" rows="1" maxlength="3000" placeholder="发消息…" ${viewState.dmBusy ? 'disabled' : ''}></textarea><div class="tf-dm-composer-actions"><button type="button" class="tf-circle-button tf-ai-reply-button" data-action="generate-dm-reply" data-conversation-id="${escapeHtml(conversation.id)}" ${viewState.dmBusy || !messages.length ? 'disabled' : ''} aria-label="生成 AI 回复">${viewState.dmBusy ? '<span class="tf-spinner"></span>' : icon('sparkles')}</button><button type="submit" class="tf-circle-button" data-action="send-dm" data-conversation-id="${escapeHtml(conversation.id)}" ${viewState.dmBusy ? 'disabled' : ''} aria-label="发送消息">${icon('send')}</button></div></form>`}</section>`;
}

function renderTaskInbox(data) {
    const tasks = [...data.world.tasks].reverse();
    return `<section class="tf-task-inbox"><header><div><h2>委托</h2><p>委托人会通过私信送达任务；这里汇总所有交易记录。</p></div></header><div class="tf-task-inbox-list">${tasks.length ? tasks.map(task => `<article class="tf-card" data-world-item-id="${escapeHtml(task.id)}"><div><b>${escapeHtml(task.anonymous ? '匿名委托人' : task.issuer)}</b><time>${formatTime(task.createdAt)}</time></div><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p><span>目标：${escapeHtml(task.objectiveTarget || task.title)}</span>${task.reward ? `<span>可能奖励：${escapeHtml(task.reward)}</span>` : ''}${renderTaskVerificationState(task)}<footer>${renderTaskActions(task, { includeOpen: true })}</footer></article>`).join('') : '<div class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('book')+'</div><h3>暂时没有委托</h3></div>'}</div></section>`;
}

function userCanManageReports() {
    const settings = getSettings();
    return roleCan(settings, { permissionRole: settings.profile.permissionRole || 'member' }, 'adjudicateReport');
}

function reportIsRelatedToUser(data, report) {
    if (!report) return false;
    if (report.source === 'user') return true;
    const myHandle = String(getSettings().profile.handle || 'me').replace(/^@/, '').toLocaleLowerCase();
    if (String(report.reporterHandle || '').replace(/^@/, '').toLocaleLowerCase() === myHandle) return true;
    const post = data.posts.find(item => item.id === report.postId);
    const comment = report.commentId ? post?.comments?.find(item => item.id === report.commentId) : null;
    return isMyHandle((comment || post)?.handle);
}

function canSeeNotification(data, item) {
    if (npcForId(item.actorNpcId)?.blocked) return false;
    if (item.type !== 'moderation' && item.category !== 'moderation' && item.moduleId !== 'moderation') return true;
    if (userCanManageReports()) return true;
    const directReport = data.world.reports.find(report => report.id === item.itemId);
    const proposal = data.world.proposals.find(entry => entry.id === item.itemId);
    const proposalReport = proposal?.payload?.reportId ? data.world.reports.find(report => report.id === proposal.payload.reportId) : null;
    return reportIsRelatedToUser(data, directReport || proposalReport);
}

function visibleNotifications(data) {
    return data.notifications.filter(item => canSeeNotification(data, item));
}

function renderMessages(data) {
    prepareConversations(data);
    const unread = visibleNotifications(data).filter(item => !item.read).length;
    const body = viewState.messageMode === 'notifications'
        ? renderNotifications(data)
        : viewState.messageMode === 'tasks'
            ? renderTaskInbox(data)
            : `<div class="tf-messages-page ${viewState.mobileDmChat ? 'is-chat-open' : ''}">${renderConversationList(data)}${renderDirectChat(data)}</div>`;
    return `<div class="tf-message-shell"><nav class="tf-message-tabs"><button class="${viewState.messageMode === 'dm' ? 'is-active' : ''}" data-action="message-mode" data-mode="dm">私信</button>${getSettings().modules.tasks.enabled ? `<button class="${viewState.messageMode === 'tasks' ? 'is-active' : ''}" data-action="message-mode" data-mode="tasks">世界消息</button>` : ''}<button class="${viewState.messageMode === 'notifications' ? 'is-active' : ''}" data-action="message-mode" data-mode="notifications">通知${unread ? `<i>${unread}</i>` : ''}</button></nav>${body}</div>`;
}

function renderNotifications(data) {
    const filters = [['all', '全部'], ['social', '社交'], ['tasks', '委托'], ['companion', '旅伴'], ['health', '健康'], ['moderation', '管理']];
    const socialTypes = new Set(['reply', 'mention', 'like', 'follow', 'mutual']);
    const items = visibleNotifications(data).filter(item => viewState.notificationFilter === 'all' || (viewState.notificationFilter === 'social' ? socialTypes.has(item.type) : item.category === viewState.notificationFilter || item.type === viewState.notificationFilter)).sort((a, b) => Number(b.createdAt) - Number(a.createdAt));
    const emptyLabels = { all: ['暂时没有通知', '新的社交和世界提醒会出现在这里。'], social: ['没有新的社交通知', '回复、关注和提及会集中在这里。'], tasks: ['没有委托提醒', '新委托与进度变化会出现在这里。'], companion: ['旅伴还没有来信', '外出后寄回的讯号会出现在这里。'], health: ['没有健康提醒', '身体事件和恢复进度会出现在这里。'], moderation: ['没有管理消息', '举报和裁决进度会出现在这里。'] };
    const empty = emptyLabels[viewState.notificationFilter] || emptyLabels.all;
    return `<section class="tf-notifications"><header><div><small>消息中心</small><h2>通知</h2><p>点击消息可直接进入对应帖子、私信或世界功能。</p></div><button class="tf-secondary-button" data-action="mark-all-notifications">全部已读</button></header><nav class="tf-notification-filters">${filters.map(([id, label]) => `<button class="${viewState.notificationFilter === id ? 'is-active' : ''}" data-action="notification-filter" data-filter="${id}">${label}</button>`).join('')}</nav><div class="tf-notification-list">${items.length ? items.map(item => {
        const npc = npcForId(item.actorNpcId);
        const avatar = item.category === 'companion' || item.type === 'companion' ? renderCompanionAvatar(data) : renderAvatar(item.actorName, { avatarUrl: npc?.avatarUrl, avatarKey: npc?.avatarKey });
        const moduleLabel = { tasks: '委托', travel: '旅伴', inventory: '背包', health: '健康', moderation: '管理' }[item.moduleId] || '';
        return `<button class="tf-notification ${item.read ? '' : 'is-unread'}" data-action="open-notification" data-notification-id="${escapeHtml(item.id)}" data-post-id="${escapeHtml(item.postId)}" data-contact-search="${escapeHtml(`${item.actorName} ${item.content}`.toLocaleLowerCase())}">${avatar}<div><span><b>${escapeHtml(item.actorName)}</b>${moduleLabel ? `<em>${moduleLabel}</em>` : ''}</span><p>${escapeHtml(item.content)}</p><time>${formatTime(item.createdAt)}</time></div>${icon('chevron')}<i></i></button>`;
    }).join('') : `<div class="tf-card tf-empty tf-notification-empty"><div class="tf-empty-icon">${icon('heart')}</div><div><h3>${empty[0]}</h3><p>${empty[1]}</p></div></div>`}</div></section>`;
}

function renderMeNav() {
    const section = getSettings().ui.meSection || 'overview';
    const groups = [
        ['世界', [['modules', 'sparkles', '功能与联动'], ['moderation', 'shield', '社区治理'], ['npcs', 'users', '角色与头像']]],
        ['生成', [['automation', 'settings', '自动化与安全'], ['prompts', 'book', '论坛设定'], ['builtinPrompts', 'settings', '内置提示词'], ['api', 'settings', 'API'], ['sources', 'shield', '正文联动']]],
        ['隐私', [['boundaries', 'lock', '信息边界'], ['notifications', 'message', '通知设置']]],
        ['外观', [['appearance', 'palette', '外观与主题']]],
        ['数据', [['runtime', 'database', '运行后台'], ['data', 'database', '数据管理']]],
    ];
    return `<nav class="tf-me-nav"><header><small>CONTROL CENTER</small><h2>设置中心</h2></header>${groups.map(([label, items]) => `<section class="tf-settings-nav-group"><h3>${label}</h3>${items.map(([id, iconName, itemLabel]) => `<button class="${section === id ? 'is-active' : ''}" data-action="me-section" data-section="${id}">${icon(iconName)}<span>${itemLabel}</span></button>`).join('')}</section>`).join('')}</nav>`;
}

function renderMeOverview(data) {
    const settings = getSettings();
    const profile = settings.profile;
    const snapshot = getChatSnapshot();
    const displayName = getMyDisplayName();
    const cover = renderStoredImage({ url: profile.backgroundUrl, imageKey: profile.backgroundKey, alt: '个人主页背景' });
    const ownPosts = data.posts.filter(post => isMyHandle(post.handle) && !post.moderation?.hidden);
    const ownReplies = data.posts.flatMap(post => (post.comments || []).filter(comment => isMyHandle(comment.handle)).map(comment => ({ post, comment })));
    const media = ownPosts.filter(post => post.imageUrl || post.imageKey || post.imagePrompt);
    const activeTab = ['posts', 'replies', 'media', 'following', 'followers'].includes(viewState.profileTab) ? viewState.profileTab : 'posts';
    const relationRoles = activeTab === 'following' ? data.npcs.filter(npc => npc.followedByUser) : data.npcs.filter(npc => npc.followsUser);
    const content = activeTab === 'posts' ? (ownPosts.length ? [...ownPosts].reverse().map(renderPost).join('') : '<div class="tf-card tf-empty"><h3>还没有发布动态</h3></div>')
        : activeTab === 'replies' ? (ownReplies.length ? ownReplies.reverse().map(({ post, comment }) => `<button class="tf-card tf-profile-reply" data-action="open-post" data-post-id="${escapeHtml(post.id)}"><b>回复了 @${escapeHtml(post.handle)}</b><p>${escapeHtml(comment.content)}</p><small>${formatTime(comment.createdAt)}</small></button>`).join('') : '<div class="tf-card tf-empty"><h3>还没有公开回复</h3></div>')
            : activeTab === 'media' ? (media.length ? media.reverse().map(post => `<button class="tf-profile-media" data-action="open-post" data-post-id="${escapeHtml(post.id)}">${renderPostImage(post)}</button>`).join('') : '<div class="tf-card tf-empty"><h3>还没有媒体内容</h3></div>')
                : (relationRoles.length ? relationRoles.map(npc => `<button class="tf-card tf-profile-reply" data-action="open-npc" data-npc-id="${escapeHtml(npc.id)}">${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<b>${escapeHtml(npc.name)}</b><small>@${escapeHtml(npc.handle)}</small>${icon('chevron')}</button>`).join('') : `<div class="tf-card tf-empty"><h3>${activeTab === 'following' ? '还没有关注角色' : '还没有角色关注你'}</h3></div>`);
    return `<div class="tf-me-overview tf-owner-profile"><section class="tf-personal-profile tf-card"><div class="tf-profile-cover">${cover}</div><div class="tf-profile-summary">${renderAvatar(displayName, { large: true, avatarUrl: profile.avatarUrl, avatarKey: profile.avatarKey })}<div class="tf-profile-identity"><h1>${escapeHtml(displayName)}</h1><p>@${escapeHtml(profile.handle || 'me')}</p><span>${escapeHtml(profile.bio || '还没有填写个人简介。')}</span></div><div class="tf-profile-stats"><button data-action="profile-tab" data-profile-tab="posts"><b>${ownPosts.length}</b>动态</button><button data-action="profile-tab" data-profile-tab="following"><b>${data.npcs.filter(npc => npc.followedByUser).length}</b>关注</button><button data-action="profile-tab" data-profile-tab="followers"><b>${data.npcs.filter(npc => npc.followsUser).length}</b>关注者</button></div><div class="tf-owner-actions"><button class="tf-secondary-button" data-action="me-section" data-section="profileEdit">编辑资料</button><button class="tf-secondary-button" data-action="me-section" data-section="favorites">${icon('bookmark')}收藏</button><button class="tf-secondary-button" data-action="me-section" data-section="memory">${icon('book')}角色记忆</button><button class="tf-secondary-button" data-action="me-section" data-section="privacyRelations">${icon('lock')}关系</button>${settings.modules.inventory.enabled ? `<button class="tf-secondary-button" data-action="me-section" data-section="backpack">${icon('database')}背包</button>` : ''}</div></div><nav class="tf-profile-tabs"><button class="${activeTab === 'posts' ? 'is-active' : ''}" data-action="profile-tab" data-profile-tab="posts">动态</button><button class="${activeTab === 'replies' ? 'is-active' : ''}" data-action="profile-tab" data-profile-tab="replies">回复</button><button class="${activeTab === 'media' ? 'is-active' : ''}" data-action="profile-tab" data-profile-tab="media">媒体</button></nav></section><div class="${activeTab === 'media' ? 'tf-profile-media-grid' : 'tf-feed-list tf-feed-compact tf-profile-content-list'}">${content}</div></div>`;
}

function renderProfileEditor() {
    const profile = getSettings().profile;
    return `<section class="tf-section-page"><header><div><h2>编辑个人资料</h2><p>这些内容会显示在你的公开主页；收藏和背包仍是私密的。</p></div><button class="tf-secondary-button" data-action="me-section" data-section="overview">返回主页</button></header><section class="tf-card tf-settings-card"><div class="tf-form-grid"><label><span>显示名称</span><input data-profile-field="displayName" value="${escapeHtml(profile.displayName)}" placeholder="默认跟随酒馆 User 名称"></label><label><span>账号</span><input data-profile-field="handle" value="${escapeHtml(profile.handle)}"></label><label class="is-wide"><span>个人简介</span><textarea data-profile-field="bio" rows="4">${escapeHtml(profile.bio)}</textarea></label></div><div class="tf-profile-assets"><div><b>个人头像</b><div class="tf-image-source-row"><input data-profile-image-url="avatar" value="${escapeHtml(profile.avatarUrl)}" placeholder="粘贴头像图床直链"><button class="tf-secondary-button" data-action="upload-profile-avatar">导入本地图片</button><button class="tf-danger-text" data-action="clear-profile-avatar">清除</button></div>${renderDefaultAvatarChoices('select-profile-default-avatar')}</div><div><b>主页背景</b><div class="tf-image-source-row"><input data-profile-image-url="background" value="${escapeHtml(profile.backgroundUrl)}" placeholder="粘贴背景图床直链"><button class="tf-secondary-button" data-action="upload-profile-background">导入本地图片</button><button class="tf-danger-text" data-action="clear-profile-background">清除</button></div></div></div></section></section>`;
}

function renderDefaultAvatarChoices(action, npcId = '') {
    return `<div class="tf-default-avatars"><span>默认随机头像</span>${DEFAULT_AVATARS.map((item, index) => `<button type="button" data-action="${action}" data-avatar-index="${index}" ${npcId ? `data-npc-id="${escapeHtml(npcId)}"` : ''} title="${escapeHtml(item.name)}">${renderAvatar(item.name, { avatarUrl: item.url })}</button>`).join('')}</div>`;
}

function renderFavorites(data) {
    const favorites = data.posts.filter(post => post.favorite && !post.moderation?.hidden);
    return `<section class="tf-section-page"><header><div><h2>收藏</h2><p>收藏帖不会被自动清理。</p></div></header><div class="tf-feed-list tf-feed-compact">${favorites.length ? [...favorites].reverse().map(renderPost).join('') : '<div class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('bookmark')+'</div><h3>还没有收藏</h3></div>'}</div></section>`;
}

function renderAvatarLibrary(settings) {
    return `<section class="tf-card tf-settings-card"><header><div><h3>角色头像库</h3><p>可以导入本地图片，也可以粘贴图床直链，再分配给任意角色。</p></div></header><div class="tf-avatar-add"><input id="tf-avatar-name" placeholder="头像名称"><input id="tf-avatar-url" placeholder="https://example.com/avatar.png"><button class="tf-primary-button" data-action="add-avatar-url">添加图床直链</button><button class="tf-secondary-button" data-action="upload-avatar-library">导入本地图片</button></div><div class="tf-avatar-library">${settings.avatarLibrary.length ? settings.avatarLibrary.map(item => `<div class="tf-avatar-item" data-avatar-id="${escapeHtml(item.id)}">${renderAvatar(item.name, { avatarUrl: item.url, avatarKey: item.imageKey })}<div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.url || '本地图片')}</span></div><button class="tf-icon-button" data-action="delete-avatar-url" data-avatar-id="${escapeHtml(item.id)}">${icon('trash')}</button></div>`).join('') : '<p class="tf-empty-mini">头像库为空</p>'}</div></section>`;
}

function renderNpcList(data) {
    const settings = getSettings();
    const roles = getRoleLibrary(data);
    return `<section class="tf-section-page"><header><div><h2>角色与头像</h2><p>这里只显示已有人设的角色；当前 Char 会自动建立角色。</p></div><button class="tf-primary-button" data-action="add-npc">${icon('plus')}新建角色</button></header><div class="tf-npc-grid">${roles.length ? roles.map(npc => `<article class="tf-card tf-npc-card ${npc.blocked ? 'is-blocked' : ''}">${renderAvatar(npc.name, { large: true, npcId: npc.id, avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<div><h3>${escapeHtml(npc.name)}${npc.systemRole ? '<small>当前 Char</small>' : ''}</h3><p>@${escapeHtml(npc.handle)}</p><span>${escapeHtml(npc.bio || npc.signature || npc.bindingLabel || '已建立角色人设')}</span><em>${npc.blocked ? '已拉黑' : npc.muted ? '已静音' : npc.socialState === 'quarrel' ? '争吵中' : npc.followedByUser && npc.followsUser ? '互相关注' : npc.followedByUser ? '已关注' : npc.followsUser ? '关注了你' : ''}</em></div><footer><button class="tf-text-button" data-action="edit-npc" data-npc-id="${escapeHtml(npc.id)}">编辑角色资料</button><button class="tf-primary-button" data-action="start-npc-dm" data-npc-id="${escapeHtml(npc.id)}" ${npc.blocked ? 'disabled' : ''}>私信</button></footer></article>`).join('') : '<div class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('users')+'</div><h3>角色库还是空的</h3><p>点击帖子作者头像并生成人设后，角色才会进入这里。</p></div>'}</div>${renderAvatarLibrary(settings)}</section>`;
}

function renderNpcMemory(npc) {
    const memory = npc.memory;
    const area = (field, label, hint = '') => `<label class="is-wide"><span>${label}</span><textarea data-npc-memory-array="${field}" rows="4">${escapeHtml((memory[field] || []).join('\n'))}</textarea>${hint ? `<small>${hint}</small>` : ''}</label>`;
    return `<section class="tf-card tf-settings-card tf-memory-card" data-npc-id="${escapeHtml(npc.id)}"><header><div><h3>${escapeHtml(npc.name)}的独立社交记忆</h3><p>一行一条，可随时手动修改。私信秘密不会进入公共帖子注入。</p></div></header><div class="tf-form-grid"><label><span>与用户的关系</span><input data-npc-memory-field="relationshipToUser" value="${escapeHtml(memory.relationshipToUser)}" placeholder="陌生人、朋友、恋人…"></label><label><span>关系值（-100～100）</span><input type="number" min="-100" max="100" data-npc-memory-field="relationshipScore" value="${Number(memory.relationshipScore || 0)}"></label><label><span>社交状态</span><select data-npc-social-state><option value="normal" ${npc.socialState === 'normal' ? 'selected' : ''}>普通</option><option value="friendly" ${npc.socialState === 'friendly' ? 'selected' : ''}>亲近</option><option value="quarrel" ${npc.socialState === 'quarrel' ? 'selected' : ''}>争吵中</option><option value="blocked" ${npc.socialState === 'blocked' ? 'selected' : ''}>已拉黑</option></select></label>${area('publicHistory', '曾经发过什么', '新发帖和回帖会自动追加，也可以删改。')}${area('privateTalks', '私信里谈过的秘密', '仅该角色自己的私密生成可读。')}${area('knownFacts', '确定知道的事情')}${area('unknownFacts', '明确不知道的事情', '生成时会明确禁止角色使用这些信息。')}${area('attitudes', '对其他角色的态度', '例：@xiaoming：信任但不完全赞同') }<label class="is-wide"><span>其他记忆备注</span><textarea data-npc-memory-field="notes" rows="4">${escapeHtml(memory.notes)}</textarea></label></div></section>`;
}

function renderRoleMemoryPage(data) {
    const roles = getRoleLibrary(data);
    const selected = roles.find(npc => npc.id === viewState.selectedMemoryNpcId) || roles[0];
    if (selected) viewState.selectedMemoryNpcId = selected.id;
    return `<section class="tf-section-page tf-role-memory-page"><header><div><h2>角色记忆</h2><p>每个角色的经历、关系、秘密与认知边界彼此独立。</p></div></header>${roles.length ? `<div class="tf-role-memory-layout"><aside class="tf-card tf-memory-role-list">${roles.map(npc => `<button class="${selected?.id === npc.id ? 'is-active' : ''}" data-action="select-role-memory" data-npc-id="${escapeHtml(npc.id)}">${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<span><b>${escapeHtml(npc.name)}</b><small>@${escapeHtml(npc.handle)} · ${escapeHtml(npc.memory?.relationshipToUser || '陌生人')}</small></span>${icon('chevron')}</button>`).join('')}</aside><div>${renderNpcMemory(selected)}</div></div>` : '<div class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('book')+'</div><h3>还没有可编辑的角色记忆</h3><p>角色生成人设并进入角色库后，会出现在这里。</p></div>'}</section>`;
}

function renderPrivacyRelations(data) {
    const settings = getSettings();
    const roles = getRoleLibrary(data);
    const muted = roles.filter(npc => npc.muted);
    const blocked = roles.filter(npc => npc.blocked);
    const rows = (items, action, empty) => items.length ? items.map(npc => `<article class="tf-relation-row" data-npc-id="${escapeHtml(npc.id)}">${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<div><b>${escapeHtml(npc.name)}</b><small>@${escapeHtml(npc.handle)}</small></div><button class="tf-secondary-button" data-action="${action}" data-npc-id="${escapeHtml(npc.id)}">解除</button></article>`).join('') : `<p class="tf-empty-mini">${empty}</p>`;
    return `<section class="tf-section-page tf-privacy-relations"><header><div><h2>隐私与关系</h2><p>私信门槛、角色之间私信、静音和拉黑集中在这里。</p></div></header><section class="tf-card tf-settings-card"><header><div><h3>私信门槛</h3><p>角色主动关注你以后一定可以私信；陌生角色是否可以私信由下面决定。</p></div></header><div class="tf-form-grid"><label><span>陌生角色私信</span><select data-setting="social.directMessagePolicy"><option value="open" ${settings.social.directMessagePolicy === 'open' ? 'selected' : ''}>全部允许</option><option value="following" ${settings.social.directMessagePolicy === 'following' ? 'selected' : ''}>只有已关注我的角色</option><option value="chance" ${settings.social.directMessagePolicy === 'chance' ? 'selected' : ''}>按概率拒绝</option></select></label><label><span>陌生人拒绝概率</span><input type="number" min="0" max="100" data-setting="social.strangerBlockChance" value="${Number(settings.social.strangerBlockChance)}" ${settings.social.directMessagePolicy === 'chance' ? '' : 'disabled'}></label><div>${renderSwitch({ checked: settings.social.requireRoleFollowBeforeDm, action: 'toggle-role-follow-before-dm', label: 'AI 主动发私信前必须先关注' })}</div><div>${renderSwitch({ checked: settings.social.roleDirectMessages, action: 'toggle-role-direct-messages', label: '允许角色之间私信' })}</div></div></section><section class="tf-card tf-settings-card"><header><div><h3>已静音角色</h3><p>不会出现在关注与推荐流，仍可查看主页和私信。</p></div></header><div class="tf-relation-list">${rows(muted, 'toggle-role-muted', '没有静音任何角色')}</div></section><section class="tf-card tf-settings-card"><header><div><h3>已拉黑角色</h3><p>隐藏其帖子、评论和通知，禁止私信并取消双方关注；解除后不会自动恢复关注。</p></div></header><div class="tf-relation-list">${rows(blocked, 'toggle-role-blocked', '没有拉黑任何角色')}</div></section></section>`;
}

function renderNpcProfileLegacy(data, npc) {
    const settings = getSettings();
    const busy = viewState.npcBusy.has(npc.id);
    const evidence = collectNpcEvidence(data, npc.id);
    const characters = getCharacterCatalog();
    const worldEntries = viewState.worldCatalog.flatMap(book => book.entries.map(entry => ({ ...entry, book: book.name })));
    const bindingOptions = npc.bindingType === 'char'
        ? characters.map(item => `<option value="${escapeHtml(item.id)}" ${npc.bindingTarget === item.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')
        : npc.bindingType === 'world'
            ? worldEntries.map(item => `<option value="${escapeHtml(item.key)}" ${npc.bindingTarget === item.key ? 'selected' : ''}>${escapeHtml(item.book)} · ${escapeHtml(item.title)}</option>`).join('')
            : '';
    return `<section class="tf-section-page" data-npc-id="${escapeHtml(npc.id)}"><header><button class="tf-back-button" data-action="back-npcs">${icon('chevron')}返回</button><div></div><button class="tf-danger-text" data-action="delete-npc" data-npc-id="${escapeHtml(npc.id)}" ${npc.systemRole ? 'disabled title="当前 Char 角色会自动保留"' : ''}>${npc.systemRole ? '当前 Char' : '删除角色'}</button></header><section class="tf-npc-profile-hero tf-card">${renderAvatar(npc.name, { large: true, avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<div><h2>${escapeHtml(npc.name)}</h2><p>@${escapeHtml(npc.handle)}${npc.bindingLabel ? ` · 资料来源 ${escapeHtml(npc.bindingLabel)}` : ''}</p><span>${escapeHtml(npc.bio || '这个角色还没有主页简介。')}</span><small>${npc.blocked ? '已拉黑' : npc.muted ? '已静音' : npc.followedByUser && npc.followsUser ? '互相关注' : npc.followsUser ? '对方关注了你' : npc.followedByUser ? '你已关注对方' : '尚未关注'}</small></div><div class="tf-profile-buttons"><button class="tf-secondary-button" data-action="toggle-follow-role" data-npc-id="${escapeHtml(npc.id)}" ${npc.blocked ? 'disabled' : ''}>${npc.followedByUser ? '取消关注' : '关注'}</button><button class="tf-primary-button" data-action="generate-npc-profile" data-npc-id="${escapeHtml(npc.id)}" ${busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span>' : icon('sparkles')}${npc.profileGenerated ? '重新生成' : '生成人设'}</button></div></section><section class="tf-card tf-settings-card"><header><div><h3>主页与人设库</h3><p>所有字段都可以手动修改。</p></div>${renderSwitch({ checked: npc.inject, action: 'toggle-npc-injection', label: '注入酒馆' })}</header><div class="tf-form-grid"><label><span>显示名称</span><input data-npc-field="name" value="${escapeHtml(npc.name)}"></label><label><span>论坛账号</span><input data-npc-field="handle" value="${escapeHtml(npc.handle)}"></label><label><span>头像库</span><select data-npc-avatar><option value="">保留当前头像</option>${settings.avatarLibrary.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === npc.avatarId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label><span>头像图床直链</span><input data-npc-avatar-url value="${escapeHtml(npc.avatarKey ? '' : npc.avatarUrl)}" placeholder="https://example.com/avatar.png"></label><div class="tf-npc-avatar-actions"><button class="tf-secondary-button" data-action="upload-npc-avatar" data-npc-id="${escapeHtml(npc.id)}">导入本地头像</button><button class="tf-danger-text" data-action="clear-npc-avatar" data-npc-id="${escapeHtml(npc.id)}">恢复随机头像</button></div><div>${renderSwitch({ checked: npc.followsUser, action: 'toggle-role-follows-user', label: '该角色关注我' })}</div><label><span>人设资料来源</span><select data-npc-binding-type><option value="none" ${npc.bindingType === 'none' ? 'selected' : ''}>不引用</option><option value="char" ${npc.bindingType === 'char' ? 'selected' : ''}>引用酒馆 Char</option><option value="world" ${npc.bindingType === 'world' ? 'selected' : ''}>引用世界书条目</option></select></label><label><span>资料来源对象</span><select data-npc-binding-target ${npc.bindingType === 'none' ? 'disabled' : ''}><option value="">请选择</option>${bindingOptions}</select></label><label><span>所在地</span><input data-npc-field="location" value="${escapeHtml(npc.location)}"></label><label><span>个性签名</span><input data-npc-field="signature" value="${escapeHtml(npc.signature)}"></label><label class="is-wide"><span>主页简介</span><textarea data-npc-field="bio" rows="3">${escapeHtml(npc.bio)}</textarea></label><label class="is-wide"><span>详细人设库</span><textarea data-npc-field="persona" rows="8">${escapeHtml(npc.persona)}</textarea><small>引用资料会与此处人设一起用于私信、生成和注入。</small></label></div>${renderDefaultAvatarChoices('select-npc-default-avatar', npc.id)}<footer><button class="tf-secondary-button" data-action="refresh-world-info">刷新世界书</button><button class="tf-primary-button" data-action="start-npc-dm" data-npc-id="${escapeHtml(npc.id)}" ${npc.blocked ? 'disabled' : ''}>${icon('message')}与角色私信</button></footer></section>${renderNpcMemory(npc)}<section class="tf-card tf-settings-card"><header><div><h3>公开发言依据</h3><p>用于自动生成人设。</p></div></header><div class="tf-evidence">${evidence.length ? evidence.map(item => `<p>${escapeHtml(item)}</p>`).join('') : '<p class="tf-empty-mini">暂无发言</p>'}</div></section></section>`;
}

function renderNpcProfile(data, npc) {
    const settings = getSettings();
    const page = renderNpcProfileLegacy(data, npc).replace(renderNpcMemory(npc), '');
    const avatarChoices = renderDefaultAvatarChoices('select-npc-default-avatar', npc.id);
    const backgroundPreview = renderStoredImage({ url: npc.backgroundUrl, imageKey: npc.backgroundKey, alt: `${npc.name} 的主页背景` });
    const backgroundEditor = `<section class="tf-npc-background-editor"><div class="tf-npc-background-preview">${backgroundPreview || '<span>尚未设置主页背景</span>'}</div><div><b>公开主页背景</b><p>显示在角色公开主页顶部，支持本地图片或图床直链。</p><div class="tf-image-source-row"><input data-npc-background-url value="${escapeHtml(npc.backgroundKey ? '' : npc.backgroundUrl)}" placeholder="粘贴背景图床直链"><button class="tf-secondary-button" data-action="upload-npc-background" data-npc-id="${escapeHtml(npc.id)}">导入本地图片</button><button class="tf-danger-text" data-action="clear-npc-background" data-npc-id="${escapeHtml(npc.id)}">清除</button></div><label class="tf-role-permission-select"><span>社区身份与权限</span><select data-npc-permission-role>${settings.moderation.permissionLevels.map(level => `<option value="${escapeHtml(level.id)}" ${npc.permissionRole === level.id ? 'selected' : ''}>${escapeHtml(level.name)} · 等级 ${Number(level.level)}</option>`).join('')}</select><small>权限能力在“社区治理”中统一配置。</small></label></div></section>`;
    return page.replace(avatarChoices, `${backgroundEditor}${avatarChoices}`);
}

function renderNpcs(data) {
    const npc = data.npcs.find(item => item.id === viewState.selectedNpcId);
    return npc ? renderNpcProfile(data, npc) : renderNpcList(data);
}

function renderPublicNpcProfileLegacy(data, npc) {
    const posts = data.posts.filter(post => !post.moderation?.hidden && (post.npcId === npc.id || String(post.handle || '').toLocaleLowerCase() === String(npc.handle || '').toLocaleLowerCase()));
    const followingHandles = new Set((npc.followingHandles || []).map(handle => String(handle).replace(/^@/, '').toLocaleLowerCase()));
    const followingRoles = data.npcs.filter(role => role.id !== npc.id && followingHandles.has(String(role.handle || '').toLocaleLowerCase()));
    const followers = data.npcs.filter(role => (role.followingHandles || []).some(handle => String(handle).replace(/^@/, '').toLocaleLowerCase() === String(npc.handle || '').toLocaleLowerCase()));
    const cover = renderStoredImage({ url: npc.backgroundUrl, imageKey: npc.backgroundKey, alt: `${npc.name} 的主页背景` });
    const busy = viewState.npcBusy.has(npc.id);
    return `<section class="tf-public-profile"><header class="tf-detail-header"><button class="tf-back-button" data-action="back-public-profile">${icon('chevron')}返回</button><div><h2>${escapeHtml(npc.name)}</h2><p>${posts.length} 篇帖子</p></div></header><section class="tf-public-profile-hero tf-card"><div class="tf-public-profile-cover">${cover}</div><div class="tf-public-profile-main">${renderAvatar(npc.name, { large: true, avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<div class="tf-public-profile-actions"><button class="tf-secondary-button" data-action="toggle-follow-role" data-npc-id="${escapeHtml(npc.id)}" ${npc.blocked ? 'disabled' : ''}>${npc.followedByUser ? '取消关注' : '关注'}</button><button class="tf-primary-button" data-action="start-npc-dm" data-npc-id="${escapeHtml(npc.id)}" ${npc.blocked || !isRoleLibraryMember(npc) ? 'disabled' : ''}>私信</button>${isRoleLibraryMember(npc) ? `<button class="tf-icon-button" data-action="edit-npc" data-npc-id="${escapeHtml(npc.id)}" title="编辑角色资料">${icon('edit')}</button>` : ''}</div><div class="tf-public-profile-copy"><h1>${escapeHtml(npc.name)}</h1><p>@${escapeHtml(npc.handle)}</p><span>${escapeHtml(npc.bio || npc.signature || '这个账号还没有填写个人简介。')}</span>${npc.location ? `<small>${escapeHtml(npc.location)}</small>` : ''}<div class="tf-public-profile-stats"><b>${numberLabel(posts.length)}<small>帖子</small></b><b>${numberLabel(npc.followers)}<small>粉丝</small></b><b>${numberLabel(npc.following)}<small>关注</small></b></div></div></div>${!npc.profileGenerated ? `<div class="tf-profile-draft"><p>${busy ? '正在根据公开发言生成主页与角色人设…' : '这个账号还没有完整的人设与主页。生成后才会进入角色库并开放私信。'}</p><button class="tf-primary-button" data-action="generate-npc-profile" data-npc-id="${escapeHtml(npc.id)}" ${busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span>生成中' : `${icon('sparkles')}生成人设与主页`}</button></div>` : ''}</section><section class="tf-profile-social-list tf-card"><header><div><h3>关注列表</h3><p>主页公开可见的社交关系</p></div></header>${followingRoles.length ? followingRoles.map(role => `<button data-action="open-npc" data-npc-id="${escapeHtml(role.id)}">${renderAvatar(role.name, { avatarUrl: role.avatarUrl, avatarKey: role.avatarKey })}<span><b>${escapeHtml(role.name)}</b><small>@${escapeHtml(role.handle)}</small></span>${icon('chevron')}</button>`).join('') : '<p class="tf-empty-mini">暂时没有可显示的关注角色</p>'}${followers.length ? `<small class="tf-known-followers">已识别 ${followers.length} 位角色粉丝</small>` : ''}</section><section class="tf-public-posts"><header><h3>帖子</h3></header><div class="tf-feed-list">${posts.length ? [...posts].sort((a, b) => Number(b.createdAt) - Number(a.createdAt)).map(post => renderPost(post)).join('') : '<div class="tf-card tf-empty"><h3>还没有发布帖子</h3></div>'}</div></section></section>`;
}

function renderPublicNpcProfile(data, npc) {
    const visibleData = npc.blocked ? { ...data, posts: data.posts.filter(post => post.npcId !== npc.id) } : data;
    let page = renderPublicNpcProfileLegacy(visibleData, npc);
    const health = getSettings().modules.health.enabled ? data.world.health.filter(item => item.status !== 'resolved' && (item.subjectNpcId === npc.id || item.subject === npc.name)) : [];
    if (health.length) {
        const healthMarkup = `<section class="tf-profile-health tf-card"><header><h3>近况</h3></header>${health.map(item => `<div><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.status === 'recovering' ? '恢复中' : '当前状态')}</span><p>${escapeHtml(item.symptoms)}</p></div>`).join('')}</section>`;
        page = page.replace('<section class="tf-profile-social-list', `${healthMarkup}<section class="tf-profile-social-list`);
    }
    const menu = `<details class="tf-profile-menu"><summary class="tf-icon-button" aria-label="关系操作">${icon('more')}</summary><div><button data-action="toggle-role-muted" data-npc-id="${escapeHtml(npc.id)}">${icon('message')}<span>${npc.muted ? '取消静音' : '静音该角色'}</span></button><button class="${npc.blocked ? '' : 'is-danger'}" data-action="toggle-role-blocked" data-npc-id="${escapeHtml(npc.id)}">${icon('lock')}<span>${npc.blocked ? '解除拉黑' : '拉黑该角色'}</span></button>${npc.followedByUser ? `<button data-action="toggle-follow-role" data-npc-id="${escapeHtml(npc.id)}">${icon('user')}<span>取消关注</span></button>` : ''}</div></details>`;
    return page.replace('</div><div class="tf-public-profile-copy">', `${menu}</div><div class="tf-public-profile-copy">`);
}

function renderPrompts() {
    const settings = getSettings();
    const items = getForumReadOrderItems(settings);
    const queuedEntryIds = new Set(items.filter(item => item.entry).map(item => item.entry.id));
    const inactiveEntries = settings.promptEntries.filter(entry => !queuedEntryIds.has(entry.id));
    const roleOptions = role => [['system', '系统'], ['user', '用户'], ['assistant', '助手']]
        .map(([value, label]) => `<option value="${value}" ${role === value ? 'selected' : ''}>${label}</option>`).join('');
    const renderMoveActions = (id, index, total) => `<div class="tf-prompt-move-actions"><button class="tf-secondary-button" data-action="move-read-order" data-read-order-id="${escapeHtml(id)}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>上移</button><button class="tf-secondary-button" data-action="move-read-order" data-read-order-id="${escapeHtml(id)}" data-direction="1" ${index === total - 1 ? 'disabled' : ''}>下移</button></div>`;
    const renderEntryEditor = (entry, index, total) => `<div class="tf-prompt-editor-head"><label><span>条目名</span><input data-entry-field="title" value="${escapeHtml(entry.title)}"></label><label class="tf-prompt-role"><span>角色</span><select data-entry-field="role">${roleOptions(entry.role)}</select></label><div>${renderSwitch({ checked: entry.enabled, action: 'toggle-prompt-entry', label: '启用' })}</div><button class="tf-icon-button" data-action="delete-prompt-entry" data-entry-id="${escapeHtml(entry.id)}" title="删除">${icon('trash')}</button></div><label class="tf-prompt-content-field"><span>设定内容</span><textarea data-entry-field="content" rows="7">${escapeHtml(entry.content)}</textarea></label><footer><label>触发词<input data-entry-field="keywords" value="${escapeHtml((entry.keywords || []).join(', '))}" placeholder="逗号分隔"></label>${renderSwitch({ checked: entry.constant, action: 'toggle-prompt-constant', label: '常驻' })}${index >= 0 ? renderMoveActions(`forum:${entry.id}`, index, total) : ''}</footer>`;
    const renderQueueItem = (item, index) => {
        const open = viewState.openPromptEntries.has(item.id);
        const trigger = item.entry ? (item.entry.constant ? '常驻' : `触发：${(item.entry.keywords || []).join('、') || '未填写'}`) : item.note;
        const detail = item.entry
            ? renderEntryEditor(item.entry, index, items.length)
            : `<div class="tf-prompt-source-detail"><div><b>${escapeHtml(item.type)} · ${escapeHtml(roleOptionsLabel(item.role))}</b><p>${escapeHtml(item.note)}</p>${item.preview ? `<blockquote>${escapeHtml(item.preview)}</blockquote>` : ''}</div><div class="tf-prompt-source-actions"><button class="tf-secondary-button" data-action="open-settings" data-section="${item.type === '内置' ? 'builtinPrompts' : 'sources'}">${item.type === '内置' ? '编辑内置内容' : '管理读取来源'}</button>${renderMoveActions(item.id, index, items.length)}</div></div>`;
        return `<article class="tf-card tf-prompt-entry ${open ? 'is-open' : ''}" data-read-order-id="${escapeHtml(item.id)}" ${item.entry ? `data-entry-id="${escapeHtml(item.entry.id)}"` : ''}><header><span class="tf-prompt-drag-handle" draggable="true" data-read-order-drag-id="${escapeHtml(item.id)}" title="拖动改变发送顺序">⠿</span><b class="tf-prompt-sequence-number">${String(index + 1).padStart(2, '0')}</b><button class="tf-prompt-summary" data-action="toggle-prompt-editor" data-entry-id="${escapeHtml(item.id)}" aria-expanded="${open}"><span><small>${escapeHtml(item.type)} · ${escapeHtml(roleOptionsLabel(item.role))} · ${escapeHtml(trigger)}</small><b>${escapeHtml(item.title)}</b></span>${icon('chevron')}</button></header><div class="tf-prompt-editor" ${open ? '' : 'hidden'}>${detail}</div></article>`;
    };
    const renderInactiveEntry = entry => {
        const open = viewState.openPromptEntries.has(`inactive:${entry.id}`);
        const reason = entry.enabled ? '内容为空，不会发送' : '已停用，不会发送';
        return `<article class="tf-card tf-prompt-entry is-disabled ${open ? 'is-open' : ''}" data-entry-id="${escapeHtml(entry.id)}"><header><span class="tf-prompt-drag-placeholder"></span><span class="tf-prompt-sequence-number">—</span><button class="tf-prompt-summary" data-action="toggle-prompt-editor" data-entry-id="inactive:${escapeHtml(entry.id)}" aria-expanded="${open}"><span><small>论坛设定 · ${escapeHtml(roleOptionsLabel(entry.role))} · ${reason}</small><b>${escapeHtml(entry.title || '未命名设定')}</b></span>${icon('chevron')}</button></header><div class="tf-prompt-editor" ${open ? '' : 'hidden'}>${renderEntryEditor(entry, -1, 0)}</div></article>`;
    };
    return `<section class="tf-section-page tf-prompt-settings"><header><div><h2>论坛设定</h2><p>这里是论坛唯一的提示词队列；从上到下就是实际发送给 AI 的 messages 顺序。</p></div><div><button class="tf-secondary-button" data-action="import-prompts">导入</button><button class="tf-secondary-button" data-action="export-prompts">导出</button><button class="tf-primary-button" data-action="add-prompt-entry">${icon('plus')}新增</button></div></header><div class="tf-prompt-order-note"><span>队列位置就是实际发送位置</span><small>只列出论坛当前允许读取的内容；拖动 ⠿ 排序，手机端可展开后上移或下移</small></div><div class="tf-prompt-list">${items.map(renderQueueItem).join('')}</div>${inactiveEntries.length ? `<details class="tf-prompt-inactive"><summary>未参与读取 · ${inactiveEntries.length} 条</summary><div class="tf-prompt-list">${inactiveEntries.map(renderInactiveEntry).join('')}</div></details>` : ''}</section>`;
}

function roleOptionsLabel(role) {
    return ({ system: '系统', user: '用户', assistant: '助手' })[role] || '系统';
}

function renderBuiltinPrompts() {
    const settings = getSettings();
    const labels = {
        forumSystem: ['论坛生成 · 系统规则', '控制整个论坛生成任务的最高层规则。'],
        forumGeneration: ['论坛生成 · 内容要求', '控制帖子、评论、图片、转发等写法。'],
        mainChatInjection: ['注入正文 · 论坛模板', '使用 {{content}} 代表选择注入的帖子。'],
        roleInjection: ['注入正文 · 角色模板', '使用 {{content}} 代表允许注入的角色资料。'],
        threadReply: ['评论区 · AI 跟帖', '用户点击生成回复时使用。'],
        npcProfile: ['角色 · 生成人设', '点击角色主页中的生成人设按钮时使用。'],
        directMessage: ['私信 · 用户与角色', '只影响私信中的 AI 回复。'],
        proactiveDirectMessage: ['私信 · 角色主动联系', '随论坛联动生成的主动私信规则，不会单独调用第二次 API。'],
        roleDirectMessage: ['私信 · 角色之间', '确保 A 与 B 的秘密不会泄露给 C。'],
        moderation: ['社区治理', 'AI 管理员处理举报时使用。'],
        task: ['任务', '生成普通委托、神秘任务、骗局与失败后果。'],
        fortune: ['运势', '生成当天的概率倾向与剧情影响。'],
        travel: ['外出', '生成符合世界观的旅行、探索和见闻。'],
        inventory: ['背包', '生成可持有、消耗或影响剧情的物品。'],
        health: ['健康', '生成虚构角色的身体事件与恢复状态。'],
        orchestrator: ['世界调度器', '一次 API 联动多个模块时使用。'],
        narrativeSafety: ['剧情禁区执行', '把禁止事件的概率设为零，并要求同一次输出改成可逆替代。'],
    };
    return `<section class="tf-section-page tf-builtin-prompts"><header><div><h2>内置提示词</h2><p>这些是插件真正使用的底层指令，与“论坛设定”分开保存；可以修改，也可以逐条恢复默认。</p></div><button class="tf-secondary-button" data-action="restore-all-builtin-prompts">全部恢复默认</button></header><div class="tf-builtin-prompt-list">${Object.entries(labels).map(([id, [title, description]]) => `<article class="tf-card tf-settings-card" data-builtin-prompt-id="${escapeHtml(id)}"><header><div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(description)}</p></div><button class="tf-text-button" data-action="restore-builtin-prompt" data-prompt-id="${escapeHtml(id)}">恢复默认</button></header><textarea rows="7" data-builtin-prompt="${escapeHtml(id)}">${escapeHtml(settings.builtinPrompts[id] || '')}</textarea></article>`).join('')}</div></section>`;
}

function renderModuleApiOptions(selectedId) {
    const settings = getSettings();
    return `<option value="inherit" ${selectedId === 'inherit' ? 'selected' : ''}>跟随当前插件</option>${settings.apiProfiles.map(profile => `<option value="${escapeHtml(profile.id)}" ${selectedId === profile.id ? 'selected' : ''}>${escapeHtml(profile.name)}</option>`).join('')}`;
}

function formatTravelDuration(minutes) {
    const value = Math.max(0, Number(minutes || 0));
    if (value < 1) return `${Math.max(1, Math.round(value * 60))} 秒`;
    if (value < 60) return `${Math.round(value)} 分钟`;
    if (value < 1440) return `${Math.round(value / 6) / 10} 小时`;
    return `${Math.round(value / 144) / 10} 天`;
}

function formatTimeUntil(timestamp) {
    const seconds = Math.max(0, Math.ceil((Number(timestamp || 0) - Date.now()) / 1000));
    if (seconds < 60) return `${seconds} 秒`;
    if (seconds < 3600) return `${Math.ceil(seconds / 60)} 分钟`;
    if (seconds < 86400) return `${Math.round(seconds / 360) / 10} 小时`;
    return `${Math.round(seconds / 8640) / 10} 天`;
}

function renderTravelTimingSettings(module) {
    const timing = resolveCompanionTravelTiming(module, () => 0.5);
    const custom = module.travelDurationPreset === 'custom';
    const options = [
        ...Object.entries(COMPANION_TRAVEL_PRESETS).map(([id, preset]) => `<option value="${id}" ${module.travelDurationPreset === id ? 'selected' : ''}>${preset.label} · ${formatTravelDuration(preset.duration[0])}～${formatTravelDuration(preset.duration[1])}</option>`),
        `<option value="custom" ${custom ? 'selected' : ''}>自定义时间</option>`,
    ].join('');
    const customFields = custom ? `<div class="tf-travel-custom-time"><label><span>最短旅行</span><input type="number" min="0.25" max="43200" step="0.25" data-module-field="travelMinMinutes" value="${Number(module.travelMinMinutes || 60)}"><small>分钟</small></label><label><span>最长旅行</span><input type="number" min="0.25" max="43200" step="0.25" data-module-field="travelMaxMinutes" value="${Number(module.travelMaxMinutes || 180)}"><small>分钟</small></label><label><span>最短消息间隔</span><input type="number" min="0.25" max="14400" step="0.25" data-module-field="travelMessageMinMinutes" value="${Number(module.travelMessageMinMinutes || 15)}"><small>分钟</small></label><label><span>最长消息间隔</span><input type="number" min="0.25" max="14400" step="0.25" data-module-field="travelMessageMaxMinutes" value="${Number(module.travelMessageMaxMinutes || 35)}"><small>分钟</small></label></div>` : '';
    return `<section class="tf-travel-timing-settings"><header><div><b>旅行节奏</b><small>整趟行程只在出发时调用一次 API</small></div><span>${formatTravelDuration(timing.durationMinimum)}～${formatTravelDuration(timing.durationMaximum)}返家</span></header><label><span>返家模式</span><select data-module-field="travelDurationPreset">${options}</select></label>${customFields}<footer><span>${icon('message')}途中预计释放 ${timing.messageCount} 条预生成消息</span><small>修改只影响下一次出发；关闭酒馆后仍按时间戳继续。</small></footer></section>`;
}

function renderModuleCard(definition) {
    const settings = getSettings();
    const module = settings.modules[definition.id];
    const injectIntoChat = definition.id === 'forum' ? settings.injection.enabled : module.injectIntoChat;
    const tokens = Number(viewState.injectionTokens.modules?.[definition.id] || 0);
    const busy = viewState.moduleBusy.has(definition.id);
    const automationLabels = [['suggest', '只记录建议'], ['confirm', '由我确认'], ['auto', '允许自动执行']];
    const contextLabels = { moderation: '查看管理通知', tasks: '打开委托', fortune: '查看今日运势', travel: '打开旅伴小窝', inventory: '打开我的背包', health: '打开健康与医疗' };
    const independent = module.generationMode === 'independent';
    const runtime = getForumData().world.moduleRuntime?.[definition.id];
    const runtimeText = runtime?.lastDecision || (!module.enabled ? '模块已关闭' : module.generationMode === 'independent' ? '独立模式，等待手动刷新或自动触发' : module.generationMode === 'local' ? '本地模式，等待日期或手动刷新' : '将在下次论坛刷新时参与联动');
    const modeControl = definition.id === 'forum' ? '<span class="tf-mode-note">论坛随“刷新”生成</span>' : definition.id === 'travel' ? '<div class="tf-mode-note tf-travel-once-note"><b>出发时预生成完整行程</b><small>途中消息、返家内容和待带回物品共用一次 API；出发后全部在本地按时间释放。</small></div>' : `<label class="tf-module-mode"><span>生成方式</span><select data-module-field="generationMode"><option value="linked" ${module.generationMode === 'linked' ? 'selected' : ''}>持续联动 · 随论坛刷新判定</option><option value="independent" ${independent ? 'selected' : ''}>独立生成 · 使用本模块 API</option>${definition.id === 'fortune' ? `<option value="local" ${module.generationMode === 'local' ? 'selected' : ''}>本地随机 · 不调用 API</option>` : ''}</select><small>${module.generationMode === 'linked' ? '每轮先按下方概率判定；命中后才与论坛共用本次 API，不保证百分百发生。' : module.generationMode === 'local' ? '按世界内日期缓存，同一天不会重复调用 API。' : '手动或自动单独生成；使用下面选择的独立 API。'}</small></label>`;
    const flowControl = definition.id === 'forum'
        ? `<div class="tf-module-flow tf-direction-summary"><span><b>主聊天读取论坛内容</b><small>${settings.injection.enabled ? '已开启；仅使用单独选中的帖子' : '当前关闭，不会向正文提供帖子'}</small></span><button class="tf-secondary-button" data-action="go-injection-settings">前往“注入主聊天”</button></div>`
        : `<div class="tf-module-flow"><div>${renderSwitch({ checked: injectIntoChat, action: 'toggle-module-injection', label: '允许该模块状态进入正文', disabled: !module.enabled, dataset: { moduleId: definition.id } })}<small data-module-token="${escapeHtml(definition.id)}">${tokens ? `当前约 ${numberLabel(tokens)} Tokens` : '当前没有注入内容'}</small></div></div>`;
    const fortuneApiToggle = definition.id === 'fortune' ? `<div class="tf-module-feature-toggle">${renderSwitch({ checked: module.allowApiDraw, action: 'toggle-fortune-api-draw', label: '允许 AI 生成抽签结果' })}<small>默认关闭。开启后只有主动点击“AI 抽签”才会调用一次文本 API。</small></div>` : '';
    const showApiControls = independent || (definition.id === 'fortune' && module.allowApiDraw);
    const apiControls = `${fortuneApiToggle}${showApiControls ? `<label><span>${independent ? '独立 API' : '抽签 API'}</span><select data-module-field="apiProfileId">${renderModuleApiOptions(module.apiProfileId)}</select></label>` : ''}`;
    const taskVerificationControls = definition.id === 'tasks' ? `<section class="tf-task-verification-settings"><header><div><b>任务验收 API</b><small>独立于任务生成；默认关闭，只在本地证据不足且用户提交验收时调用一次。</small></div>${renderSwitch({ checked: module.verificationApiEnabled, action: 'toggle-task-verification-api', label: '允许 API 判断正文是否完成任务' })}</header><label><span>验收 API</span><select data-module-field="verificationApiProfileId" ${module.verificationApiEnabled ? '' : 'disabled'}>${renderModuleApiOptions(module.verificationApiProfileId)}</select></label></section>` : '';
    const probability = ['forum', 'travel'].includes(definition.id) ? '' : `<label><span>每轮触发概率（%）</span><input type="number" min="0" max="100" data-module-field="probability" value="${Number(module.probability ?? 35)}"></label><label><span>触发冷却（分钟）</span><input type="number" min="0" max="43200" data-module-field="cooldownMinutes" value="${Number(module.cooldownMinutes || 0)}"></label>`;
    const pageButton = definition.id === 'forum'
        ? '<button class="tf-secondary-button" data-action="switch-tab" data-tab="home">打开论坛</button>'
        : `<button class="tf-secondary-button" data-action="open-module-context" data-module-id="${escapeHtml(definition.id)}" ${!module.enabled ? 'disabled' : ''}>${escapeHtml(contextLabels[definition.id] || '查看内容')}</button>${definition.id !== 'travel' && (module.generationMode === 'independent' || module.generationMode === 'local') ? `<button class="tf-secondary-button" data-action="refresh-world-module" data-module-id="${escapeHtml(definition.id)}" ${!module.enabled || busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span>生成中' : `${icon('refresh')}刷新`}</button>` : ''}`;
    const tools = viewState.openModuleToolsId === definition.id ? `<div class="tf-module-tools-menu"><button data-action="export-module" data-module-id="${escapeHtml(definition.id)}">导出此模块设置</button><button data-action="import-module" data-module-id="${escapeHtml(definition.id)}">导入此模块设置</button><button data-action="reset-module" data-module-id="${escapeHtml(definition.id)}">恢复此模块默认设置</button></div>` : '';
    return `<article class="tf-module-card tf-card ${module.enabled ? 'is-enabled' : ''}" data-module-id="${escapeHtml(definition.id)}"><header><span class="tf-module-icon">${icon(definition.icon)}</span><div><h3>${escapeHtml(definition.name)}</h3><p>${escapeHtml(definition.description)}</p></div><div class="tf-module-tools-wrap"><button class="tf-icon-button" data-action="module-tools" data-module-id="${escapeHtml(definition.id)}" aria-label="模块数据工具">${icon('more')}</button>${tools}</div>${renderSwitch({ checked: module.enabled, action: 'toggle-world-module', label: '', dataset: { moduleId: definition.id } })}</header>${modeControl}${flowControl}${definition.id === 'travel' ? renderTravelTimingSettings(module) : ''}${taskVerificationControls}<div class="tf-module-options">${apiControls}${probability}<label><span>自动化权限</span><select data-module-field="automation">${automationLabels.map(([value, label]) => `<option value="${value}" ${module.automation === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div>${definition.id === 'forum' ? '' : `<div class="tf-module-diagnostics"><span>为什么没有生成：${escapeHtml(runtimeText)}</span></div>`}<footer>${pageButton}</footer></article>`;
}

function renderInventoryUseButton(item) {
    if (!item.usable || item.consumed || Number(item.quantity || 0) <= 0) return '';
    const kind = classifyInventoryItem(item);
    const label = kind === 'medical' ? '用于照护' : kind === 'companion' ? '给旅伴' : '使用';
    return `<button data-action="use-inventory-item" data-inventory-use="${kind}">${label}</button>`;
}

function renderWorldStateDashboard(data) {
    const settings = getSettings();
    const world = data.world;
    const taskStatus = { offered: '待接受', accepted: '进行中', completed: '已完成', failed: '失败', abandoned: '已放弃' };
    const tasks = settings.modules.tasks.enabled ? `<section class="tf-card tf-world-board"><header><div><h3>任务</h3><p>任务可以来自普通人、官号、神秘人，也可能是骗局。</p></div><span>${world.tasks.filter(item => ['offered', 'accepted'].includes(item.status)).length} 个进行中</span></header><div>${world.tasks.length ? [...world.tasks].reverse().slice(0, 20).map(task => `<article data-world-item-id="${escapeHtml(task.id)}"><div><b>${escapeHtml(task.title)}${task.scam ? '<em>可疑</em>' : ''}</b><small>${escapeHtml(task.issuer)} · ${taskStatus[task.status] || task.status}</small><p>${escapeHtml(task.description)}</p>${task.reward ? `<span>奖励：${escapeHtml(task.reward)}</span>` : ''}${task.failure ? `<span>失败：${escapeHtml(task.failure)}</span>` : ''}${renderTaskVerificationState(task)}</div><footer>${renderTaskActions(task)}<button class="tf-danger-text" data-action="delete-world-item" data-kind="tasks">删除</button></footer></article>`).join('') : '<p class="tf-empty-mini">还没有任务</p>'}</div></section>` : '';
    const fortune = settings.modules.fortune.enabled ? `<section class="tf-card tf-world-board tf-fortune-board"><header><div><h3>今日运势</h3><p>只影响倾向和概率，不会强制改写剧情。</p></div></header>${world.fortune ? `<div class="tf-fortune-score"><b>${escapeHtml(world.fortune.label)}</b><strong>${Number(world.fortune.score)}</strong><p>${escapeHtml(world.fortune.summary)}</p><ul>${world.fortune.effects.map(effect => `<li>${escapeHtml(effect)}</li>`).join('')}</ul></div>` : '<p class="tf-empty-mini">今天的运势还没有生成</p>'}</section>` : '';
    const trips = settings.modules.travel.enabled ? `<section class="tf-card tf-world-board"><header><div><h3>外出与见闻</h3><p>会自动适配当前世界观，不固定为现代旅行。</p></div></header><div>${world.trips.length ? [...world.trips].reverse().slice(0, 16).map(trip => `<article data-world-item-id="${escapeHtml(trip.id)}"><div><b>${escapeHtml(trip.traveler)} → ${escapeHtml(trip.destination)}</b><small>${escapeHtml(trip.status)}</small><p>${escapeHtml(trip.notes)}</p>${trip.souvenir ? `<span>带回：${escapeHtml(trip.souvenir)}</span>` : ''}</div><footer><button data-action="advance-trip-status">推进状态</button><button class="tf-danger-text" data-action="delete-world-item" data-kind="trips">删除</button></footer></article>`).join('') : '<p class="tf-empty-mini">还没有外出记录</p>'}</div></section>` : '';
    const inventory = settings.modules.inventory.enabled ? `<section class="tf-card tf-world-board"><header><div><h3>背包</h3><p>只有符合当前世界观的物品会进入这里。</p></div></header><div>${world.inventory.length ? [...world.inventory].reverse().slice(0, 30).map(item => `<article class="${item.consumed ? 'is-finished' : ''}" data-world-item-id="${escapeHtml(item.id)}"><div><b>${escapeHtml(item.name)} ×${Number(item.quantity)}</b><small>${escapeHtml(item.source || '来源不明')}</small><p>${escapeHtml(item.description)}</p>${item.effect ? `<span>${escapeHtml(item.effect)}</span>` : ''}</div><footer>${renderInventoryUseButton(item)}<button class="tf-danger-text" data-action="delete-world-item" data-kind="inventory">删除</button></footer></article>`).join('') : '<p class="tf-empty-mini">背包还是空的</p>'}</div></section>` : '';
    const health = settings.modules.health.enabled ? `<section class="tf-card tf-world-board"><header><div><h3>健康</h3><p>只描述虚构角色状态，不提供现实医疗诊断。</p></div></header><div>${world.health.length ? [...world.health].reverse().slice(0, 20).map(item => `<article class="${item.status === 'resolved' ? 'is-finished' : ''}" data-world-item-id="${escapeHtml(item.id)}"><div><b>${escapeHtml(item.subject)} · ${escapeHtml(item.name)}</b><small>${escapeHtml(item.severity)} · ${escapeHtml(item.status)}</small><p>${escapeHtml(item.symptoms)}</p>${item.storyEffect ? `<span>${escapeHtml(item.storyEffect)}</span>` : ''}</div><footer>${item.status !== 'resolved' ? '<button data-action="advance-health-status">推进恢复</button>' : ''}<button class="tf-danger-text" data-action="delete-world-item" data-kind="health">删除</button></footer></article>`).join('') : '<p class="tf-empty-mini">没有正在记录的身体事件</p>'}</div></section>` : '';
    return `<div class="tf-world-dashboard">${fortune}${tasks}${trips}${inventory}${health}</div>`;
}

function renderTaskApp(data) {
    const tasks = [...data.world.tasks].reverse();
    const active = tasks.filter(item => ['offered', 'accepted'].includes(item.status));
    const cards = tasks.map((task, index) => {
        const risk = ({ low: '低风险', medium: '中风险', high: '高风险', unknown: '风险不明' })[task.risk] || '风险不明';
        const code = String(task.id || '').split('-').pop()?.slice(-6).toLocaleUpperCase() || String(index + 1).padStart(3, '0');
        return `<article class="tf-black-task is-${escapeHtml(task.status)} is-risk-${escapeHtml(task.risk)}" data-world-item-id="${escapeHtml(task.id)}"><header><span>ORDER #${escapeHtml(code)}</span><div><em>${escapeHtml(risk)}</em>${task.scam ? '<b>可疑交易</b>' : ''}</div></header><section><small>${task.anonymous ? 'MASKED CLIENT' : `@${escapeHtml(task.issuerHandle || 'client')}`}</small><h3>${escapeHtml(task.title)}</h3><p>${escapeHtml(task.description)}</p><div class="tf-black-task-objective"><span>交付目标</span><b>${escapeHtml(task.objectiveTarget || task.title)} ×${Number(task.objectiveQuantity || 1)}</b><small>${escapeHtml(task.completionCriteria || '完成条件以正文中的实际进展为准')}</small></div>${renderTaskVerificationState(task)}</section><aside><span><small>委托人</small><b>${escapeHtml(task.anonymous ? '匿名委托人' : task.issuer)}</b></span><span><small>报酬</small><b>${escapeHtml(task.reward || '面议')}</b></span><span><small>失败影响</small><b>${escapeHtml(task.failure || '未说明')}</b></span></aside><footer><strong>${escapeHtml(taskStatusLabel(task))}</strong><div>${renderTaskActions(task)}<button class="tf-danger-text" data-action="delete-world-item" data-kind="tasks">删除记录</button></div></footer></article>`;
    }).join('');
    return `<section class="tf-task-market"><header class="tf-task-market-hero"><div><small>NIGHT EXCHANGE · COMMISSIONS</small><h2>夜市委托所</h2><p>实名委托、匿名邀约与来路不明的交易都会在这里留下编号。接受后，必须依据正文证据完成验收。</p></div><div><span><b>${active.length}</b>待处理</span><span><b>${tasks.filter(item => item.status === 'completed').length}</b>已结算</span></div></header><div class="tf-task-market-notice"><span>${icon('message')}</span><div><b>主要联络入口在私信</b><p>可向委托人追问细节；匿名联系人不会公开真实身份。</p></div><button class="tf-secondary-button" data-action="open-task-messages">打开委托私信</button></div><div class="tf-task-market-list">${cards || '<div class="tf-task-market-empty"><span>⌁</span><h3>今晚没有新的交易</h3><p>新的委托会先通过私信送达。</p></div>'}</div></section>`;
}

function renderFortuneApp(data) {
    const fortune = data.world.fortune;
    return `<section class="tf-card tf-world-board-page tf-fortune-app">${fortune ? `<div class="tf-fortune-orb"><small>${escapeHtml(fortune.date)}</small><strong>${Number(fortune.score)}</strong><b>${escapeHtml(fortune.label)}</b></div><div class="tf-fortune-copy"><h3>${escapeHtml(fortune.summary || '今天会平稳地过去。')}</h3><ul>${fortune.effects.map(effect => `<li>${escapeHtml(effect)}</li>`).join('')}</ul></div>` : '<div class="tf-empty"><div class="tf-empty-icon">'+icon('sparkles')+'</div><h3>今天还没有抽取运势</h3></div>'}</section>`;
}

function renderFortuneAppV2(data) {
    const fortune = data.world.fortune;
    if (!fortune) {
        const cards = [['left', '左侧的牌', 'Ⅰ'], ['middle', '中央的牌', 'Ⅱ'], ['right', '右侧的牌', 'Ⅲ']];
        const aiMode = viewState.fortuneAiMode && getSettings().modules.fortune.allowApiDraw;
        const busy = viewState.moduleBusy.has('fortune');
        const apiDraw = getSettings().modules.fortune.allowApiDraw
            ? `<button class="tf-fortune-ai-action ${aiMode ? 'is-active' : ''}" data-action="toggle-ai-fortune-mode" ${busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span><span><b>正在解签</b><small>所选牌正在等待一次 API 返回</small></span>' : aiMode ? `${icon('close')}<span><b>退出 AI 解签</b><small>改回完全本地抽取</small></span>` : `${icon('sparkles')}<span><b>AI 解签</b><small>先开启，再亲手翻一张牌</small></span>`}</button>`
            : '';
        return `<section class="tf-card tf-fortune-ritual ${aiMode ? 'is-ai-mode' : ''} ${busy ? 'is-ai-waiting' : ''}"><header><div><span class="tf-fortune-local-badge">${aiMode ? 'AI 解签模式' : '本地抽取'}</span><small>${escapeHtml(new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }))}</small><h2>让今天的一张牌找到你</h2><p>${aiMode ? '仍由你亲手选牌和翻牌；选中后只调用一次 API 解读当前世界。' : '三张牌仍未揭晓。选择时只使用本地随机，不会调用模型。'}</p></div>${apiDraw}</header><div class="tf-fortune-table"><span class="tf-fortune-moon" aria-hidden="true">☾</span><span class="tf-fortune-star is-one" aria-hidden="true">✦</span><span class="tf-fortune-star is-two" aria-hidden="true">·</span><div class="tf-fortune-deck">${cards.map(([id, title, number], index) => `<button class="tf-fortune-facedown is-${id} ${aiMode ? 'is-ai-choice' : ''} ${busy && viewState.fortuneRevealChoice === id ? 'is-ai-pending' : ''}" data-action="${aiMode ? 'draw-api-fortune' : 'draw-local-fortune'}" data-choice="${id}" aria-label="${aiMode ? '交给 AI 解读' : '选择'}${title}" style="--card-index:${index}" ${busy ? 'disabled' : ''}><span class="tf-fortune-card-back"><i>${busy && viewState.fortuneRevealChoice === id ? '✧' : '✦'}</i><b>${number}</b><em>DAILY SIGN</em></span><small>${aiMode ? '翻开并让 AI 解读' : title}</small></button>`).join('')}</div><p>${busy ? '牌面正在翻转，等待解签结果……' : aiMode ? '凭第一感觉翻开一张；只有选牌后才会调用一次 API。' : '凭第一感觉选一张；结果只影响本地倾向，随时可以撤销。'}</p></div></section>`;
    }
    const aspectLabels = { encounter: '相遇', travel: '旅途', discovery: '发现' };
    const modifierLabels = { travelDeparture: '出发倾向', travelMessage: '来信概率', souvenir: '纪念品', detour: '意外绕路' };
    const direction = fortune.modifiers?.luckyDirection || '';
    const choiceClass = ['left', 'middle', 'right'].includes(fortune.choiceId) ? fortune.choiceId : 'middle';
    const revealClass = viewState.fortuneRevealChoice ? 'is-revealing' : '';
    return `<section class="tf-card tf-fortune-reveal ${revealClass} is-choice-${choiceClass}"><div class="tf-fortune-reveal-stage"><span class="tf-fortune-reveal-glow"></span><span class="tf-fortune-result-card"><small>${escapeHtml(fortune.date)}</small><i>${escapeHtml(fortune.sigil || '◇')}</i><b>${escapeHtml(fortune.label)}</b><strong>${Number(fortune.score)}</strong><em>${escapeHtml(fortune.theme || '今日')}</em></span><p>今日签已经翻开</p></div><div class="tf-fortune-result-copy"><header><span class="tf-fortune-theme">${escapeHtml(fortune.theme || '今日')}</span><h2>${escapeHtml(fortune.summary || '今天会平稳地过去。')}</h2><p>有效至今天结束，或由你手动撤销。</p></header><div class="tf-fortune-aspects">${Object.entries(fortune.aspects || {}).map(([key, value]) => `<div><span>${aspectLabels[key] || key}<b>${Number(value)}</b></span><progress max="100" value="${Number(value)}"></progress></div>`).join('')}</div><section class="tf-fortune-impact"><h3>它会影响什么</h3><article><span>${renderPixelCompanion(data.world.companion.species, data.world.companion.status, true)}</span><div><b>旅伴</b><p>${direction ? `更想往${escapeHtml(direction)}边出发` : '会按自己的心情挑选方向'}；出发与来信概率轻微变化。</p></div></article><article><span>${icon('inventory')}</span><div><b>旅途收获</b><p>纪念品 ${Number(fortune.modifiers?.souvenir || 0) >= 0 ? '+' : ''}${Number(fortune.modifiers?.souvenir || 0)}%，绕路 ${Number(fortune.modifiers?.detour || 0) >= 0 ? '+' : ''}${Number(fortune.modifiers?.detour || 0)}%。</p></div></article><article><span>${icon('users')}</span><div><b>相遇与发现</b><p>相遇 ${Number(fortune.aspects?.encounter || 0)}，发现 ${Number(fortune.aspects?.discovery || 0)}；不会强制改写剧情。</p></div></article></section><section class="tf-fortune-effects"><h3>数值倾向</h3>${Object.entries(fortune.modifiers || {}).filter(([key]) => key !== 'luckyDirection').map(([key, value]) => `<span class="${Number(value) >= 0 ? 'is-positive' : 'is-negative'}"><b>${modifierLabels[key] || key}</b><em>${Number(value) >= 0 ? '+' : ''}${Number(value)}%</em></span>`).join('')}</section><footer><p>所有影响均在本地计算，并且保持轻微、可逆。</p><button class="tf-secondary-button tf-fortune-revoke" data-action="revoke-local-fortune">${icon('repost')}撤销今日运势</button></footer></div></section>`;
}

function getCompanionSpecies(species) {
    const value = String(species || '').toLocaleLowerCase();
    return COMPANION_SPECIES.find(item => value === item.name.toLocaleLowerCase()
        || value === item.id
        || (item.id === 'cat' && /猫|cat/.test(value))
        || (item.id === 'frog' && /蛙|frog/.test(value))
        || (item.id === 'rabbit' && /兔|rabbit|bunny/.test(value))
        || (item.id === 'fox' && /狐|fox/.test(value))
        || (item.id === 'penguin' && /企鹅|penguin/.test(value))
        || (item.id === 'robo-bird' && /机械鸟|机器鸟|机巧鸟|bird|robo-bird/.test(value))) || null;
}

function getLocalCompanionTime(companion, date = new Date()) {
    const automatic = date.getHours() >= 5 && date.getHours() < 9 ? 'dawn'
        : date.getHours() >= 9 && date.getHours() < 17 ? 'day'
            : date.getHours() >= 17 && date.getHours() < 20 ? 'dusk' : 'night';
    const id = ['dawn', 'day', 'dusk', 'night'].includes(companion.timeOfDay) ? companion.timeOfDay : automatic;
    return {
        id,
        automatic: companion.timeOfDay === 'auto' || !companion.timeOfDay,
        ...({
            dawn: { icon: '◒', label: '清晨' },
            day: { icon: '○', label: '白天' },
            dusk: { icon: '◐', label: '黄昏' },
            night: { icon: '☾', label: '夜晚' },
        }[id]),
    };
}

function getLocalCompanionWeather(data, time, date = new Date()) {
    const slot = Math.floor(date.getHours() / 4);
    const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}-${slot}`;
    const source = `${dateKey}|${data.topic || ''}|${data.world.companion.name}|${data.world.companion.species}`;
    let number = 2166136261;
    for (const char of source) number = ((number ^ char.codePointAt(0)) * 16777619) >>> 0;
    const weather = [
        { id: 'sunny', icon: time.id === 'night' ? '☾' : '☀', label: time.id === 'night' ? '清夜' : '晴朗', note: time.id === 'night' ? '窗外安静，像素星光一闪一闪。' : '像素阳光暖暖地落进小窝。' },
        { id: 'cloudy', icon: '☁', label: time.id === 'night' ? '夜间多云' : '多云', note: '几团软云正在缓慢经过。' },
        { id: 'rain', icon: '▥', label: time.id === 'night' ? '夜雨' : '小雨', note: '细细的雨线落在窗外。' },
        { id: 'wind', icon: '≋', label: time.id === 'night' ? '晚风' : '微风', note: '风把小叶片吹得转了几圈。' },
        { id: 'snow', icon: '✣', label: time.id === 'night' ? '夜雪' : '飘雪', note: '屏幕里飘起轻轻的雪点。' },
    ];
    const manualId = data.world.companion.weather;
    const selected = weather.find(item => item.id === manualId) || weather[number % weather.length];
    return {
        ...selected,
        id: `${selected.id} is-time-${time.id}`,
        label: `${time.label} · ${selected.label}`,
        automatic: manualId === 'auto' || !manualId,
        slot,
        dateKey,
    };
}

function renderPixelCompanion(species, status = 'home', mini = false, appearance = null) {
    const kind = getCompanionSpecies(species)?.id || 'mystery';
    const safeStatus = ['home', 'away', 'resting'].includes(status) ? status : 'home';
    const currentCompanion = getForumData()?.world?.companion;
    const previewingAppearance = getSettings().ui.activeTab === 'services'
        && viewState.worldPage === 'travel'
        && viewState.companionProfileOpen
        && viewState.companionAppearanceDraft;
    const liveAppearance = appearance || (currentCompanion && getCompanionSpecies(currentCompanion.species)?.id === kind
        ? { ...currentCompanion, ...(previewingAppearance || {}) }
        : null);
    const safeColor = value => /^#[0-9a-f]{6}$/i.test(String(value || '').trim()) ? String(value).trim().toLocaleLowerCase() : '';
    const bodyColor = safeColor(liveAppearance?.bodyColor);
    const accentColor = safeColor(liveAppearance?.accentColor);
    const accessoryColor = safeColor(liveAppearance?.accessoryColor);
    const accessory = COMPANION_ACCESSORIES.some(item => item.id === liveAppearance?.accessory) ? liveAppearance.accessory : 'none';
    const customStyle = [bodyColor ? `--pet-body-user:${bodyColor}` : '', accentColor ? `--pet-accent-user:${accentColor}` : '', accessoryColor ? `--pet-accessory-user:${accessoryColor}` : ''].filter(Boolean).join(';');
    const shapes = {
        frog: '<g class="tf-pixel-body"><rect x="15" y="21" width="34" height="26"/><rect x="11" y="15" width="15" height="14"/><rect x="38" y="15" width="15" height="14"/><rect x="8" y="44" width="21" height="6"/><rect x="35" y="44" width="21" height="6"/></g><rect class="tf-pixel-light" x="21" y="34" width="22" height="11"/><g class="tf-pixel-eyes"><rect class="tf-pixel-light" x="15" y="18" width="7" height="7"/><rect class="tf-pixel-light" x="42" y="18" width="7" height="7"/><rect class="tf-pixel-ink" x="18" y="19" width="4" height="5"/><rect class="tf-pixel-ink" x="42" y="19" width="4" height="5"/></g><rect class="tf-pixel-ink" x="25" y="37" width="4" height="3"/><rect class="tf-pixel-ink" x="35" y="37" width="4" height="3"/><rect class="tf-pixel-ink" x="28" y="42" width="8" height="2"/>',
        cat: '<g class="tf-pixel-tail"><rect class="tf-pixel-body" x="48" y="31" width="7" height="18"/><rect class="tf-pixel-body" x="52" y="24" width="6" height="12"/><rect class="tf-pixel-accent" x="52" y="23" width="6" height="6"/></g><path class="tf-pixel-body" d="M14 21V9h5l8 9h10l8-9h5v32l-8 10H22L14 41z"/><rect class="tf-pixel-body" x="19" y="45" width="9" height="9"/><rect class="tf-pixel-body" x="36" y="45" width="9" height="9"/><path class="tf-pixel-accent" d="M18 13v9h8zM46 13v9h-8z"/><rect class="tf-pixel-light" x="23" y="27" width="6" height="7"/><rect class="tf-pixel-light" x="36" y="27" width="6" height="7"/><g class="tf-pixel-eyes"><rect class="tf-pixel-ink" x="25" y="28" width="3" height="5"/><rect class="tf-pixel-ink" x="37" y="28" width="3" height="5"/></g><rect class="tf-pixel-accent" x="30" y="35" width="5" height="4"/><path class="tf-pixel-ink" d="M25 41h6v2h3v-2h6v3H25z"/>',
        rabbit: '<g class="tf-pixel-ears"><rect class="tf-pixel-body" x="17" y="5" width="11" height="26"/><rect class="tf-pixel-body" x="36" y="5" width="11" height="26"/><rect class="tf-pixel-accent" x="20" y="9" width="5" height="16"/><rect class="tf-pixel-accent" x="39" y="9" width="5" height="16"/></g><rect class="tf-pixel-body" x="14" y="24" width="36" height="27"/><rect class="tf-pixel-light" x="19" y="37" width="26" height="13"/><rect class="tf-pixel-body" x="9" y="33" width="9" height="14"/><rect class="tf-pixel-body" x="46" y="33" width="9" height="14"/><rect class="tf-pixel-body" x="18" y="48" width="11" height="7"/><rect class="tf-pixel-body" x="35" y="48" width="11" height="7"/><g class="tf-pixel-eyes"><rect class="tf-pixel-ink" x="22" y="30" width="5" height="6"/><rect class="tf-pixel-ink" x="37" y="30" width="5" height="6"/></g><rect class="tf-pixel-accent" x="30" y="37" width="5" height="4"/><path class="tf-pixel-ink" d="M27 43h5v2h3v-2h4v3H27z"/>',
        fox: '<g class="tf-pixel-tail"><path class="tf-pixel-body" d="M42 36h12v4h6v12H45v-5h-9z"/><path class="tf-pixel-light" d="M53 40h7v12H48v-5h5z"/></g><path class="tf-pixel-body" d="M11 11h7l10 10h8l10-10h7v31l-10 11H21L11 42z"/><path class="tf-pixel-accent" d="M16 16h4l7 8H16zM48 16h-4l-7 8h11z"/><path class="tf-pixel-light" d="M20 35h7l5 4 5-4h8v11l-5 6H25l-5-6z"/><g class="tf-pixel-eyes"><rect class="tf-pixel-ink" x="20" y="28" width="6" height="6"/><rect class="tf-pixel-ink" x="39" y="28" width="6" height="6"/></g><rect class="tf-pixel-ink" x="30" y="38" width="5" height="5"/><rect class="tf-pixel-ink" x="27" y="46" width="11" height="3"/>',
        penguin: '<g class="tf-pixel-wings"><rect class="tf-pixel-body" x="11" y="25" width="8" height="22"/><rect class="tf-pixel-body" x="45" y="25" width="8" height="22"/></g><rect class="tf-pixel-body" x="17" y="13" width="30" height="36"/><rect class="tf-pixel-body" x="23" y="8" width="18" height="7"/><path class="tf-pixel-light" d="M22 27h20v19H22z"/><rect class="tf-pixel-light" x="22" y="19" width="8" height="8"/><rect class="tf-pixel-light" x="35" y="19" width="8" height="8"/><g class="tf-pixel-eyes"><rect class="tf-pixel-ink" x="25" y="21" width="4" height="5"/><rect class="tf-pixel-ink" x="36" y="21" width="4" height="5"/></g><rect class="tf-pixel-accent" x="28" y="28" width="9" height="6"/><rect class="tf-pixel-accent" x="19" y="48" width="13" height="6"/><rect class="tf-pixel-accent" x="34" y="48" width="13" height="6"/>',
        'robo-bird': '<g class="tf-pixel-wings"><rect class="tf-pixel-body" x="8" y="25" width="11" height="15"/><rect class="tf-pixel-body" x="45" y="25" width="11" height="15"/></g><rect class="tf-pixel-body" x="17" y="17" width="30" height="28"/><rect class="tf-pixel-light" x="22" y="12" width="20" height="7"/><g class="tf-pixel-antenna"><rect class="tf-pixel-accent" x="30" y="6" width="4" height="7"/><rect class="tf-pixel-accent" x="28" y="4" width="8" height="4"/></g><rect class="tf-pixel-screen" x="21" y="22" width="22" height="11"/><g class="tf-pixel-eyes"><rect class="tf-pixel-accent" x="24" y="24" width="6" height="6"/><rect class="tf-pixel-accent" x="35" y="24" width="6" height="6"/></g><rect class="tf-pixel-accent" x="27" y="36" width="12" height="4"/><rect class="tf-pixel-body" x="22" y="44" width="8" height="10"/><rect class="tf-pixel-body" x="36" y="44" width="8" height="10"/><rect class="tf-pixel-accent" x="47" y="26" width="10" height="7"/>',
        mystery: '<rect class="tf-pixel-body" x="18" y="17" width="28" height="32"/><rect class="tf-pixel-accent" x="13" y="24" width="7" height="18"/><rect class="tf-pixel-accent" x="44" y="24" width="7" height="18"/><rect class="tf-pixel-body" x="22" y="47" width="8" height="7"/><rect class="tf-pixel-body" x="36" y="47" width="8" height="7"/><g class="tf-pixel-eyes"><rect class="tf-pixel-light" x="23" y="26" width="5" height="6"/><rect class="tf-pixel-light" x="36" y="26" width="5" height="6"/></g><rect class="tf-pixel-accent" x="30" y="36" width="4" height="4"/><rect class="tf-pixel-ink" x="27" y="42" width="10" height="2"/>',
    };
    const accessoryArt = {
        scarf: {
            slot: 'neck',
            front: '<path class="tf-pixel-accessory-shadow" d="M17 43h30v5H17z"/><path d="M18 42h28v4H18zM41 45h8v7h-3v8h-6v-12h-4v-3z"/><rect class="tf-pixel-accessory-light" x="43" y="48" width="3" height="2"/>',
        },
        satchel: {
            slot: 'side',
            back: '<path class="tf-pixel-accessory-line" d="M20 25l23 27"/>',
            front: '<path class="tf-pixel-accessory-shadow" d="M37 42h16v14H37z"/><rect x="36" y="40" width="16" height="14"/><rect class="tf-pixel-accessory-light" x="38" y="42" width="12" height="3"/><rect class="tf-pixel-accessory-shadow" x="43" y="46" width="3" height="4"/>',
        },
        flower: {
            slot: 'head',
            front: '<rect class="tf-pixel-accessory-stem" x="48" y="14" width="2" height="9"/><rect x="44" y="8" width="5" height="5"/><rect x="50" y="8" width="5" height="5"/><rect x="47" y="5" width="5" height="5"/><rect x="47" y="12" width="5" height="5"/><rect class="tf-pixel-accessory-light" x="48" y="9" width="3" height="3"/>',
        },
        charm: {
            slot: 'neck',
            front: '<path class="tf-pixel-accessory-line" d="M23 45h18"/><rect class="tf-pixel-accessory-shadow" x="30" y="46" width="5" height="4"/><path d="M27 49h11v8H27z"/><rect class="tf-pixel-accessory-light" x="30" y="51" width="5" height="3"/>',
        },
        ribbon: {
            slot: 'head',
            front: '<path class="tf-pixel-accessory-shadow" d="M13 14h9l5 4v-4h9l5 5-5 6h-9v-4l-5 4h-9l-4-6z"/><path d="M13 12h9l5 4v-4h9l5 5-5 6h-9v-4l-5 4h-9l-4-6z"/><rect class="tf-pixel-accessory-light" x="23" y="15" width="7" height="6"/>',
        },
        glasses: {
            slot: 'face',
            front: '<path class="tf-pixel-accessory-line is-thin" d="M13 27h5m12 2h5m13-2h4"/><rect class="tf-pixel-accessory-frame" x="17" y="25" width="14" height="12" rx="1"/><rect class="tf-pixel-accessory-frame" x="34" y="25" width="14" height="12" rx="1"/><rect class="tf-pixel-accessory-glint" x="20" y="28" width="4" height="2"/><rect class="tf-pixel-accessory-glint" x="37" y="28" width="4" height="2"/>',
        },
        crown: {
            slot: 'head',
            front: '<path class="tf-pixel-accessory-shadow" d="M22 9l6 5 4-9 5 9 7-5v13H22z"/><path d="M22 7l6 5 4-9 5 9 7-5v13H22z"/><rect class="tf-pixel-accessory-light" x="26" y="15" width="14" height="3"/><rect class="tf-pixel-accessory-jewel" x="31" y="12" width="4" height="4"/>',
        },
        leaf: {
            slot: 'head',
            front: '<path class="tf-pixel-accessory-shadow" d="M32 16c3-9 12-12 18-8-2 9-9 13-18 11z"/><path d="M31 14c3-9 12-12 18-8-2 9-9 13-18 11z"/><path class="tf-pixel-accessory-line is-thin" d="M31 16l14-7"/>',
        },
        headphones: {
            slot: 'head',
            back: '<path class="tf-pixel-accessory-line is-wide" d="M14 30V20C14 10 22 5 32 5s18 5 18 15v10"/>',
            front: '<rect class="tf-pixel-accessory-shadow" x="9" y="25" width="10" height="18"/><rect x="10" y="23" width="9" height="18"/><rect class="tf-pixel-accessory-light" x="13" y="27" width="3" height="9"/><rect class="tf-pixel-accessory-shadow" x="46" y="25" width="10" height="18"/><rect x="45" y="23" width="9" height="18"/><rect class="tf-pixel-accessory-light" x="48" y="27" width="3" height="9"/>',
        },
        cape: {
            slot: 'back',
            back: '<path class="tf-pixel-accessory-shadow" d="M18 28h12l4 7-8 22H6l7-23z"/><path d="M18 26h11l4 7-8 22H7l7-23z"/><path class="tf-pixel-accessory-light" d="M18 27h9l3 5-17 4 2-6z"/>',
        },
        bell: {
            slot: 'neck',
            front: '<path class="tf-pixel-accessory-line" d="M21 45h23"/><path class="tf-pixel-accessory-shadow" d="M29 48h8v2h3v6h2v2H24v-2h2v-6h3z"/><path d="M29 46h8v2h3v6h2v2H24v-2h2v-6h3z"/><rect class="tf-pixel-accessory-light" x="29" y="49" width="4" height="3"/><rect class="tf-pixel-accessory-shadow" x="31" y="56" width="5" height="3"/>',
        },
    };
    const accessoryOffsets = {
        frog: { scarf: 'translate(0 3)', flower: 'translate(-2 1)', charm: 'translate(0 3)', ribbon: 'translate(2 4) scale(.72)', glasses: 'translate(0 -7)', crown: 'translate(0 -1) scale(.72)', leaf: 'translate(-1 1) scale(.82)', headphones: 'translate(0 0)', cape: 'translate(0 2)', bell: 'translate(0 3)' },
        cat: { ribbon: 'translate(-1 1) scale(.72)', crown: 'translate(0 -3) scale(.86)', leaf: 'translate(0 0) scale(.88)' },
        rabbit: { scarf: 'translate(0 3)', flower: 'translate(-3 9) scale(.82)', charm: 'translate(0 3)', ribbon: 'translate(-2 10) scale(.68)', glasses: 'translate(0 4)', crown: 'translate(0 9) scale(.72)', leaf: 'translate(-2 9) scale(.78)', headphones: 'translate(0 7)', cape: 'translate(0 2)', bell: 'translate(0 3)' },
        fox: { scarf: 'translate(0 5)', charm: 'translate(0 5)', ribbon: 'translate(-1 1) scale(.72)', glasses: 'translate(0 2)', crown: 'translate(0 -2) scale(.86)', leaf: 'translate(0 0) scale(.88)', bell: 'translate(0 5)' },
        penguin: { scarf: 'translate(0 -7)', flower: 'translate(-1 -2)', charm: 'translate(0 -5)', ribbon: 'translate(-1 -1) scale(.72)', glasses: 'translate(0 -6)', crown: 'translate(0 -6) scale(.82)', leaf: 'translate(0 -4) scale(.86)', headphones: 'translate(0 -3)', bell: 'translate(0 -5)' },
        'robo-bird': { scarf: 'translate(0 -1)', flower: 'translate(1 -1) scale(.82)', charm: 'translate(0 -2)', ribbon: 'translate(-2 0) scale(.68)', glasses: 'translate(0 -2)', crown: 'translate(-10 2) rotate(-8 32 14) scale(.72)', leaf: 'translate(2 -1) scale(.78)', headphones: 'translate(0 1)', bell: 'translate(0 -2)' },
        mystery: {},
    };
    const selectedAccessory = accessoryArt[accessory];
    const accessoryTransform = accessoryOffsets[kind]?.[accessory] || '';
    const renderAccessoryLayer = (layer) => selectedAccessory?.[layer]
        ? `<g class="tf-pixel-accessory is-${accessory} is-slot-${selectedAccessory.slot} is-layer-${layer}" data-accessory="${accessory}" data-slot="${selectedAccessory.slot}"${accessoryTransform ? ` transform="${accessoryTransform}"` : ''}><g class="tf-pixel-accessory-art">${selectedAccessory[layer]}</g></g>`
        : '';
    const accessoryBack = renderAccessoryLayer('back');
    const accessoryFront = renderAccessoryLayer('front');
    const travelKit = '<g class="tf-pixel-travel-kit"><rect class="tf-pixel-accent" x="45" y="23" width="11" height="20"/><rect class="tf-pixel-light" x="48" y="27" width="5" height="5"/><rect class="tf-pixel-ink" x="42" y="28" width="4" height="11"/></g>';
    return `<svg class="tf-pixel-pet is-kind-${kind} is-${safeStatus} is-accessory-${accessory}${mini ? ' is-mini' : ''}" ${customStyle ? `style="${customStyle}"` : ''} viewBox="0 0 64 64" aria-hidden="true" shape-rendering="crispEdges">${accessoryBack}<g class="tf-pixel-character">${shapes[kind]}</g>${travelKit}${accessoryFront}</svg>`;
}

function renderCompanionAvatar(data, large = false) {
    const companion = data.world.companion;
    return `<span class="tf-avatar tf-companion-dm-avatar ${large ? 'tf-avatar-large' : ''}" role="img" aria-label="${escapeHtml(companion.species)}旅伴">${renderPixelCompanion(companion.species, companion.status, true, companion)}</span>`;
}

function renderCompanionApp(data) {
    const companion = data.world.companion;
    const statusLabel = companion.status === 'away' ? `正在${companion.destination || '未知地方'}旅行` : companion.status === 'resting' ? '正在小窝休息' : '在小窝等待出发';
    const statusCode = companion.status === 'away' ? 'TRIP' : companion.status === 'resting' ? 'REST' : 'HOME';
    const mood = companion.mood || '平静';
    const bond = Math.max(0, Math.min(100, Number(companion.bond || 0)));
    const bondLevel = Math.ceil(bond / 20);
    const bondMeter = Array.from({ length: 5 }, (_, index) => `<i class="${index < bondLevel ? 'is-filled' : ''}"></i>`).join('');
    const portrait = renderStoredImage({ url: companion.avatarUrl, alt: `${companion.name}的照片`, className: 'tf-companion-photo' })
        || `<span class="tf-pixel-avatar" role="img" aria-label="${escapeHtml(companion.species)}像素宠物">${renderPixelCompanion(companion.species, companion.status)}</span>`;
    const speciesOptions = COMPANION_SPECIES.map(species => {
        const selected = getCompanionSpecies(companion.species)?.id === species.id && !companion.avatarUrl;
        return `<button type="button" class="tf-pet-species-option ${selected ? 'is-selected' : ''}" data-action="choose-companion-species" data-species-id="${species.id}" aria-pressed="${selected}"><span>${renderPixelCompanion(species.name, 'home', true)}</span><b>${species.name}</b></button>`;
    }).join('');
    return `<div class="tf-companion-page"><section class="tf-card tf-companion-home"><div class="tf-pet-console-wrap"><div class="tf-pet-console"><div class="tf-pet-console-brand"><span>POCKET TRAVELER</span><b>旅伴机 01</b></div><div class="tf-pet-screen-bezel"><div class="tf-pet-screen"><div class="tf-pet-screen-top"><b>${statusCode}</b><span>${escapeHtml(mood)}</span><span class="tf-pet-signal"><i></i><i></i><i></i></span></div><div class="tf-pet-stage">${portrait}<span class="tf-pet-cloud is-one"></span><span class="tf-pet-cloud is-two"></span><span class="tf-pet-ground"></span></div><div class="tf-pet-screen-bottom"><span>${escapeHtml(companion.species)}</span><span>♥ ${String(bond).padStart(3, '0')}</span></div></div></div><div class="tf-pet-device-controls"><button type="button" data-action="focus-companion-field" data-field="name" aria-label="编辑宠物档案"><i></i><span>DATA</span></button><button type="button" data-action="focus-companion-field" data-field="carrying" aria-label="编辑宠物行囊"><i></i><span>PACK</span></button><button type="button" data-action="${companion.status === 'away' ? 'companion-return' : 'refresh-world-module'}" ${companion.status === 'away' ? '' : 'data-module-id="travel"'} ${viewState.moduleBusy.has('travel') ? 'disabled' : ''} aria-label="${companion.status === 'away' ? '让宠物回家' : '让宠物出发'}"><i></i><span>${companion.status === 'away' ? 'HOME' : 'TRIP'}</span></button></div></div></div><div class="tf-companion-status"><span class="tf-pet-kicker">MY LITTLE TRAVELER · ${statusCode}</span><div class="tf-companion-title"><div><h2>${escapeHtml(companion.name)}</h2><small>${escapeHtml(companion.species)}</small></div><b>${escapeHtml(statusLabel)}</b></div><div class="tf-pet-message"><span>MESSAGE</span><p>${escapeHtml(companion.message || '它正安静地看着你。')}</p></div><div class="tf-pet-stats"><div><small>心情 MOOD</small><b>${escapeHtml(mood)}</b></div><div><small>亲密 BOND</small><span class="tf-pet-bond-meter">${bondMeter}</span></div><div><small>行囊 PACK</small><b>${escapeHtml(companion.carrying || '还没有准备')}</b></div></div><footer><button class="tf-primary-button tf-pet-main-action" data-action="refresh-world-module" data-module-id="travel" ${viewState.moduleBusy.has('travel') ? 'disabled' : ''}>${viewState.moduleBusy.has('travel') ? '<span class="tf-spinner"></span>' : icon('sparkles')}${companion.status === 'away' ? '接收新的旅行讯号' : '让它自由出发'}</button>${companion.status === 'away' ? '<button class="tf-secondary-button" data-action="companion-return">等它回家</button>' : ''}</footer></div></section><section class="tf-card tf-companion-settings"><header><div><span class="tf-pet-section-code">PROFILE MODE</span><h3>选择你的旅伴</h3><p>挑选内置像素形象，或者写下属于这个世界的特殊宠物。</p></div></header><div class="tf-pet-species-grid">${speciesOptions}</div><div class="tf-companion-profile-grid"><label><span>名字</span><input data-companion-field="name" value="${escapeHtml(companion.name)}" maxlength="32"></label><label><span>自定义种类</span><input data-companion-field="species" value="${escapeHtml(companion.species)}" placeholder="例如：史莱姆、龙、机械犬"></label><label class="is-wide"><span>准备的行囊</span><input data-companion-field="carrying" value="${escapeHtml(companion.carrying)}" placeholder="食物、护符、地图……"></label></div></section></div>`;
}

function renderCompanionAppV2(data) {
    const companion = data.world.companion;
    const statusLabel = companion.status === 'away' ? `正在${companion.destination || '附近'}旅行` : companion.status === 'resting' ? '正在小窝休息' : '在小窝等你';
    const statusCode = companion.status === 'away' ? 'TRIP' : companion.status === 'resting' ? 'REST' : 'HOME';
    const bond = Math.max(0, Math.min(100, Number(companion.bond || 0)));
    const portrait = `<span class="tf-pixel-avatar" role="img" aria-label="${escapeHtml(companion.species)}像素宠物">${renderPixelCompanion(companion.species, companion.status)}</span>`;
    const fortune = data.world.fortune;
    const luckyDirection = fortune?.modifiers?.luckyDirection || companion.luckyDirection || '';
    const actionCopy = { feed: '吃得很香，满足地晃了晃。', pet: '它靠近你的手心蹭了蹭。', play: '一起玩了一会儿，精神变好了！', rest: '盖好小毯子，进入省电休息模式。', depart: '带好行囊，朝新的方向出发了。', signal: '收到了一枚来自旅途的像素讯号。' };
    const speciesOptions = COMPANION_SPECIES.map(species => {
        const selected = getCompanionSpecies(companion.species)?.id === species.id && !companion.avatarUrl;
        return `<button type="button" class="tf-pet-species-option ${selected ? 'is-selected' : ''}" data-action="choose-companion-species" data-species-id="${species.id}" aria-pressed="${selected}"><span>${renderPixelCompanion(species.name, 'home', true)}</span><b>${species.name}</b></button>`;
    }).join('');
    const stat = (label, value) => `<div><span>${label}<b>${Number(value)}</b></span><progress max="100" value="${Number(value)}"></progress></div>`;
    return `<div class="tf-companion-page tf-companion-v2 is-action-${escapeHtml(companion.lastAction || 'idle')}"><section class="tf-card tf-companion-home"><div class="tf-pet-console-wrap"><div class="tf-pet-console"><div class="tf-pet-console-brand"><span>POCKET TRAVELER</span><b>旅伴机 01</b></div><div class="tf-pet-screen-bezel"><div class="tf-pet-screen"><div class="tf-pet-screen-top"><b>${statusCode}</b><span>${escapeHtml(companion.mood || '好奇')}</span><span class="tf-pet-signal"><i></i><i></i><i></i></span></div><div class="tf-pet-stage">${portrait}<span class="tf-pet-action-fx"><i>✦</i><i>♥</i><i>•</i></span><span class="tf-pet-cloud is-one"></span><span class="tf-pet-cloud is-two"></span><span class="tf-pet-ground"></span></div><div class="tf-pet-screen-bottom"><span>${escapeHtml(companion.species)}</span><span>♥ ${String(bond).padStart(3, '0')}</span></div></div></div><div class="tf-pet-device-controls"><button type="button" data-action="companion-care" data-care="feed"><i></i><span>FEED</span></button><button type="button" data-action="companion-care" data-care="pet"><i></i><span>PET</span></button><button type="button" data-action="companion-care" data-care="play"><i></i><span>PLAY</span></button></div></div></div><div class="tf-companion-status"><span class="tf-pet-kicker">MY LITTLE TRAVELER · ${statusCode}</span><div class="tf-companion-title"><div><h2>${escapeHtml(companion.name)}</h2><small>${escapeHtml(companion.species)}</small></div><b>${escapeHtml(statusLabel)}</b></div><div class="tf-pet-message"><span>${companion.lastAction ? 'REACTION' : 'MESSAGE'}</span><p>${escapeHtml(companion.lastAction ? actionCopy[companion.lastAction] || companion.message : companion.message || '它正安静地看着你。')}</p></div><div class="tf-pet-vitals">${stat('饱腹', companion.satiety ?? 75)}${stat('体力', companion.energy ?? 80)}${stat('快乐', companion.happiness ?? 70)}</div>${luckyDirection ? `<div class="tf-pet-luck-note">${icon('sparkles')}<span>今日幸运方向：<b>${escapeHtml(luckyDirection)}</b> · 运势会影响见闻、绕路与纪念品概率</span></div>` : ''}<div class="tf-pet-care-actions"><button data-action="companion-care" data-care="feed"><span>🍪</span><b>喂食</b></button><button data-action="companion-care" data-care="pet"><span>🖐</span><b>摸摸</b></button><button data-action="companion-care" data-care="play"><span>🧶</span><b>玩耍</b></button><button data-action="companion-care" data-care="rest"><span>☾</span><b>休息</b></button></div><footer><button class="tf-primary-button tf-pet-main-action" data-action="${companion.status === 'away' ? 'companion-signal-local' : 'companion-depart-local'}">${icon(companion.status === 'away' ? 'message' : 'repost')}${companion.status === 'away' ? '等待旅途讯号（本地）' : '让它自由出发（本地）'}</button>${companion.status === 'away' ? '<button class="tf-secondary-button" data-action="companion-return">接它回家</button>' : ''}</footer></div></section><section class="tf-card tf-companion-settings"><header><div><span class="tf-pet-section-code">PROFILE MODE</span><h3>选择你的旅伴</h3><p>每一种旅伴在小窝和私信中都会使用自己的专属像素形象。</p></div></header><div class="tf-pet-species-grid">${speciesOptions}</div><div class="tf-companion-profile-grid"><label><span>名字</span><input data-companion-field="name" value="${escapeHtml(companion.name)}" maxlength="32"></label><label><span>自定义种类</span><input data-companion-field="species" value="${escapeHtml(companion.species)}" placeholder="例如：史莱姆、龙、机械犬"></label><label class="is-wide"><span>准备的行囊</span><input data-companion-field="carrying" value="${escapeHtml(companion.carrying)}" placeholder="食物、护符、地图……"></label></div></section></div>`;
}

function renderCompanionAppV3(data) {
    const companion = data.world.companion;
    const speciesId = getCompanionSpecies(companion.species)?.id || 'mystery';
    const activeTrip = [...data.world.trips].reverse().find(item => item.status === 'away') || null;
    const tripSignals = activeTrip?.messages || [];
    const deliveredSignals = tripSignals.filter(message => message.deliveredAt).length;
    const tripProgress = activeTrip?.returnAt && activeTrip?.schedulePreparedAt
        ? Math.min(100, Math.max(0, Math.round((Date.now() - activeTrip.schedulePreparedAt) / Math.max(1, activeTrip.returnAt - activeTrip.schedulePreparedAt) * 100)))
        : 0;
    const time = getLocalCompanionTime(companion);
    const weather = getLocalCompanionWeather(data, time);
    const statusLabel = companion.status === 'away' ? `正在${companion.destination || '附近'}旅行 · ${formatTimeUntil(activeTrip?.returnAt || companion.expectedReturnAt)}后返家` : companion.status === 'resting' ? '正在小窝休息' : '在小窝等你';
    const statusCode = companion.status === 'away' ? 'TRIP' : companion.status === 'resting' ? 'REST' : 'HOME';
    const bond = Math.max(0, Math.min(100, Number(companion.bond || 0)));
    const fortune = data.world.fortune;
    const luckyDirection = fortune?.modifiers?.luckyDirection || companion.luckyDirection || '';
    const skin = COMPANION_DEVICE_SKINS.find(item => item.id === companion.deviceSkin) || COMPANION_DEVICE_SKINS[0];
    const menuItems = COMPANION_CARE_ACTIONS;
    const menuIndex = Math.max(0, Math.min(menuItems.length - 1, Number(viewState.companionMenuIndex || 0)));
    const actionCopy = { feed: companion.message || '吃得很香，满足地晃了晃。', pet: companion.message, play: companion.message, rest: companion.message, brush: companion.message, dance: companion.message, train: companion.message, hide: companion.message, talk: companion.message, dress: companion.message, depart: '带好行囊，朝新的方向出发了。', signal: '收到了一枚来自旅途的像素讯号。' };
    const portrait = `<button class="tf-pet-sprite-control" data-action="companion-care" data-care="pet" title="摸摸${escapeHtml(companion.name)}"><span class="tf-pixel-avatar" role="img" aria-label="${escapeHtml(companion.species)}像素宠物">${renderPixelCompanion(companion.species, companion.status)}</span></button>`;
    const speciesOptions = COMPANION_SPECIES.map(species => {
        const selected = getCompanionSpecies(companion.species)?.id === species.id;
        return `<button type="button" class="tf-pet-species-option ${selected ? 'is-selected' : ''}" data-action="choose-companion-species" data-species-id="${species.id}" aria-pressed="${selected}"><span>${renderPixelCompanion(species.name, 'home', true)}</span><b>${species.name}</b></button>`;
    }).join('');
    const customSelected = !getCompanionSpecies(companion.species);
    const palette = COMPANION_PALETTES[speciesId];
    const appearanceDraft = viewState.companionAppearanceDraft || { bodyColor: companion.bodyColor, accentColor: companion.accentColor, accessoryColor: companion.accessoryColor, accessory: companion.accessory };
    const appearanceControls = `<section class="tf-pet-appearance-controls ${viewState.companionAppearanceDraft ? 'is-dirty' : 'is-saved'}"><header><div><b>像素形象</b><small class="tf-pet-appearance-state">${viewState.companionAppearanceDraft ? '正在预览，尚未保存' : '已保存 · 会同步用于小窝、世界首页和私信头像'}</small></div></header><div><label><span>主色</span><input type="color" data-companion-appearance-field="bodyColor" value="${escapeHtml(appearanceDraft.bodyColor || palette.body)}"></label><label><span>花纹色</span><input type="color" data-companion-appearance-field="accentColor" value="${escapeHtml(appearanceDraft.accentColor || palette.accent)}"></label><label><span>配件颜色</span><input type="color" data-companion-appearance-field="accessoryColor" value="${escapeHtml(appearanceDraft.accessoryColor || '#d88ba3')}"></label><label><span>随身配件</span><select data-companion-appearance-field="accessory">${COMPANION_ACCESSORIES.map(item => `<option value="${item.id}" ${appearanceDraft.accessory === item.id ? 'selected' : ''}>${item.name}</option>`).join('')}</select></label></div><label class="tf-pet-auto-accessory"><input type="checkbox" data-companion-auto-accessory ${companion.autoAccessory ? 'checked' : ''}><span>允许${escapeHtml(companion.name)}偶尔自己换配件</span></label><footer><button class="tf-secondary-button" data-action="reset-companion-appearance">预览物种默认</button><button class="tf-primary-button" data-action="save-companion-appearance" ${viewState.companionAppearanceDraft ? '' : 'disabled'}>保存形象</button></footer></section>`;
    let deviceOptions = COMPANION_DEVICE_SKINS.map(item => `<button type="button" class="tf-device-skin-option ${skin.id === item.id ? 'is-selected' : ''}" data-action="choose-companion-device" data-device-skin="${item.id}"><span class="tf-device-swatch is-${item.id}"><i></i><b></b></span><div><b>${item.name}</b><small>${item.note}</small></div></button>`).join('');
    const habitatOptions = COMPANION_HABITATS.map(item => `<option value="${item.id}" ${companion.habitat === item.id ? 'selected' : ''}>${item.name}</option>`).join('');
    const environmentControls = `<div class="tf-pet-environment-controls"><label><span>小窝背景</span><select data-companion-environment="habitat">${habitatOptions}</select></label><label><span>小窝天气</span><select data-companion-environment="weather"><option value="auto" ${companion.weather === 'auto' ? 'selected' : ''}>自动（本地时段）</option><option value="sunny" ${companion.weather === 'sunny' ? 'selected' : ''}>晴朗</option><option value="cloudy" ${companion.weather === 'cloudy' ? 'selected' : ''}>多云</option><option value="rain" ${companion.weather === 'rain' ? 'selected' : ''}>小雨</option><option value="wind" ${companion.weather === 'wind' ? 'selected' : ''}>微风</option><option value="snow" ${companion.weather === 'snow' ? 'selected' : ''}>飘雪</option></select></label><label><span>小窝时间</span><select data-companion-environment="timeOfDay"><option value="auto" ${companion.timeOfDay === 'auto' ? 'selected' : ''}>自动（本地时间）</option><option value="dawn" ${companion.timeOfDay === 'dawn' ? 'selected' : ''}>清晨</option><option value="day" ${companion.timeOfDay === 'day' ? 'selected' : ''}>白天</option><option value="dusk" ${companion.timeOfDay === 'dusk' ? 'selected' : ''}>黄昏</option><option value="night" ${companion.timeOfDay === 'night' ? 'selected' : ''}>夜晚</option></select></label></div>`;
    deviceOptions = `${appearanceControls}${environmentControls}${deviceOptions}`;
    const stat = (label, value) => `<div><span>${label}<b>${Number(value)}</b></span><progress max="100" value="${Number(value)}"></progress></div>`;
    const lastFood = COMPANION_FOODS.find(item => item.id === companion.lastFood) || COMPANION_FOODS[0];
    const animationLayer = `<span class="tf-pet-animation-layer" aria-hidden="true"><span class="tf-feed-drop" data-food-animation="${escapeHtml(lastFood.id)}"><i class="tf-food-offering"><b>${escapeHtml(lastFood.symbol)}</b><em></em></i><i class="tf-food-crumb is-one"></i><i class="tf-food-crumb is-two"></i><i class="tf-food-crumb is-three"></i><i class="tf-food-species-fx"></i></span><span class="tf-pet-hearts"><i>♥</i><i>♥</i><i>♥</i><i>♥</i></span><span class="tf-play-ball">◆</span><span class="tf-play-trail"><i></i><i></i><i></i></span><span class="tf-sleep-cloud"><i>Z</i><i>z</i><i>z</i></span><span class="tf-touch-rings"><i></i><i></i><i></i></span><span class="tf-pet-stars"><i>✦</i><i>·</i><i>✦</i><i>·</i></span><span class="tf-action-lines"><i></i><i></i><i></i></span></span>`;
    const weatherLayer = `<span class="tf-pet-weather" aria-hidden="true"><span class="tf-weather-sun"><i></i></span><span class="tf-weather-moon">☾<i>·</i><i>·</i><i>·</i></span><span class="tf-weather-cloud"><i></i><i></i></span><span class="tf-weather-rain">${'<i></i>'.repeat(8)}</span><span class="tf-weather-snow"><i>✣</i><i>·</i><i>✣</i><i>·</i><i>✣</i><i>·</i></span><span class="tf-weather-wind"><i></i><i></i><i></i><b>◆</b></span></span>`;
    const tripSchedule = activeTrip ? `<section class="tf-companion-trip-schedule"><header><span>${icon('message')}预生成行程</span><b>${deliveredSignals}/${tripSignals.length} 则来信</b></header><progress max="100" value="${tripProgress}"></progress><footer><span>预计 ${formatTimeUntil(activeTrip.returnAt)} 后返家</span><small>消息按时间在本地释放，不再调用 API</small></footer></section>` : '';
    return `<div class="tf-companion-page tf-companion-v3 is-species-${speciesId} is-device-${skin.id} is-action-${escapeHtml(companion.lastAction || 'idle')} is-weather-${weather.id}"><section class="tf-card tf-companion-home"><div class="tf-pet-console-wrap"><div class="tf-pet-console"><div class="tf-pet-console-brand"><span>${skin.id === 'terminal' ? 'FIELD UNIT' : skin.id === 'arcane' ? 'FAMILIAR LINK' : 'POCKET TRAVELER'}</span><b>${escapeHtml(skin.name)}</b></div><div class="tf-pet-screen-bezel"><div class="tf-pet-screen"><div class="tf-pet-screen-top"><b>${statusCode}</b><span>${escapeHtml(companion.mood || '好奇')}</span><span class="tf-pet-signal"><i></i><i></i><i></i></span></div><div class="tf-pet-stage">${portrait}${animationLayer}${weatherLayer}<span class="tf-pet-cloud is-one"></span><span class="tf-pet-cloud is-two"></span><span class="tf-pet-ground"></span></div><div class="tf-pet-screen-menu">${menuItems.map((item, index) => `<button class="${index === menuIndex ? 'is-selected' : ''}" data-action="companion-care" data-care="${item.id}" title="${item.label}"><span>${item.symbol}</span><b>${item.label}</b></button>`).join('')}</div><div class="tf-pet-screen-bottom"><span>${escapeHtml(companion.species)}</span><span title="${escapeHtml(weather.note)}">${weather.icon} ${escapeHtml(weather.label)}</span><span>♥ ${String(bond).padStart(3, '0')}</span></div></div></div><div class="tf-pet-device-controls"><button type="button" data-action="companion-menu-nav" data-direction="-1" aria-label="上一个功能"><i></i><span>PREV</span></button><button type="button" data-action="companion-menu-confirm" aria-label="确认当前功能"><i></i><span>OK</span></button><button type="button" data-action="companion-menu-nav" data-direction="1" aria-label="下一个功能"><i></i><span>NEXT</span></button></div></div></div><div class="tf-companion-status"><span class="tf-pet-kicker">MY LITTLE TRAVELER · ${statusCode}</span><div class="tf-companion-title"><div><h2>${escapeHtml(companion.name)}</h2><small>${escapeHtml(companion.species)}</small></div><b>${escapeHtml(statusLabel)}</b></div><div class="tf-pet-message"><span>${companion.lastAction ? 'REACTION LOG' : 'MESSAGE'}</span><p>${escapeHtml(companion.lastAction ? actionCopy[companion.lastAction] || companion.message : companion.message || '它正安静地看着你。')}</p><small>直接在左侧宠物机内操作 · 本地运行</small></div><div class="tf-pet-vitals">${stat('饱腹', companion.satiety ?? 75)}${stat('体力', companion.energy ?? 80)}${stat('快乐', companion.happiness ?? 70)}</div><div class="tf-pet-info-strip"><span><small>亲密</small><b>${bond}</b></span><span><small>行囊</small><b>${escapeHtml(companion.carrying || '未准备')}</b></span><span class="tf-weather-summary" title="${escapeHtml(weather.note)}"><small>天气</small><b>${weather.icon} ${escapeHtml(weather.label)}</b></span>${luckyDirection ? `<span><small>幸运方向</small><b>${escapeHtml(luckyDirection)}</b></span>` : ''}</div>${luckyDirection ? `<div class="tf-pet-luck-note">${icon('sparkles')}<span>运势会影响旅途见闻、绕路与纪念品概率。</span></div>` : ''}${tripSchedule}<footer class="tf-pet-trip-actions"><button class="tf-primary-button tf-pet-main-action" data-action="${companion.status === 'away' ? 'companion-signal-local' : 'companion-depart-ai'}" ${viewState.moduleBusy.has('travel') ? 'disabled' : ''}>${viewState.moduleBusy.has('travel') ? '<span class="tf-spinner"></span>正在规划整趟旅行' : `${icon(companion.status === 'away' ? 'message' : 'repost')}${companion.status === 'away' ? '查看行程进度' : '出发 · 仅调用一次 API'}`}</button>${companion.status === 'away' ? '<button class="tf-secondary-button" data-action="companion-return">立即召回</button>' : ''}</footer></div></section><details class="tf-card tf-companion-profile-card" ${viewState.companionProfileOpen ? 'open' : ''}><summary data-action="toggle-companion-profile"><span class="tf-companion-profile-avatar">${renderPixelCompanion(companion.species, 'home', true)}</span><div><small>TRAVELER PROFILE</small><h3>${escapeHtml(companion.name)} · ${escapeHtml(companion.species)}</h3><p>${escapeHtml(skin.name)} · 点击展开更换旅伴或设备</p></div><span class="tf-profile-expand">编辑档案⌄</span></summary><div class="tf-companion-profile-content"><section><header><div><h3>旅伴图鉴</h3><p>更换形象不会清除亲密度、行囊和旅行记录。</p></div></header><div class="tf-pet-species-grid tf-pet-species-compact">${speciesOptions}<button type="button" class="tf-pet-species-option is-custom ${customSelected ? 'is-selected' : ''}" data-action="choose-companion-custom"><span>＋</span><b>自定义</b></button></div><div class="tf-companion-profile-grid"><label><span>名字</span><input data-companion-field="name" value="${escapeHtml(companion.name)}" maxlength="32"></label>${customSelected ? `<label><span>自定义种类</span><input data-companion-field="species" value="${escapeHtml(companion.species === '自定义旅伴' ? '' : companion.species)}" placeholder="例如：史莱姆、龙、机械犬"></label>` : ''}<label class="is-wide"><span>准备的行囊</span><input data-companion-field="carrying" value="${escapeHtml(companion.carrying)}" placeholder="食物、护符、地图……"></label></div></section><section class="tf-device-skin-section"><header><div><h3>设备外观</h3><p>只改变机身结构、屏幕色调和动画风格，不改变宠物数据。</p></div></header><div class="tf-device-skin-grid">${deviceOptions}</div></section></div></details></div>`;
}

function getCompanionHabit(companion) {
    return COMPANION_HABITS[getCompanionSpecies(companion.species)?.id || 'mystery'] || COMPANION_HABITS.mystery;
}

function personalizeCompanionReaction(companion, value) {
    const name = String(companion?.name || '旅伴').trim() || '旅伴';
    let reaction = String(value || '');
    for (const species of COMPANION_SPECIES) reaction = reaction.replaceAll(species.name, name);
    return reaction.replaceAll('它', name);
}

function getCompanionWeatherReaction(data) {
    const companion = data.world.companion;
    const time = getLocalCompanionTime(companion);
    const weather = getLocalCompanionWeather(data, time);
    const weatherId = weather.id.split(' ')[0];
    const [reaction, mood] = getCompanionHabit(companion).weather[weatherId] || [weather.note, companion.mood || '平静'];
    return [personalizeCompanionReaction(companion, reaction), mood];
}

function getCompanionAmbientReaction(data) {
    const companion = data.world.companion;
    if (companion.status === 'away') return companion.message || '它正在旅途中观察周围。';
    if (Number(companion.satiety || 0) < 22) return `${companion.name}不时看向食物菜单，肚子像是有点饿了。`;
    if (Number(companion.energy || 0) < 22) return `${companion.name}的动作慢了下来，正在寻找适合打盹的位置。`;
    if (Number(companion.happiness || 0) < 28) return `${companion.name}安静地靠近屏幕边缘，希望有人陪一会儿。`;
    if (companion.lastAction && companion.message) return personalizeCompanionReaction(companion, companion.message);
    return getCompanionWeatherReaction(data)[0];
}

function getCompanionExtraReaction(companion, action) {
    const speciesId = getCompanionSpecies(companion.species)?.id || 'mystery';
    return personalizeCompanionReaction(companion, COMPANION_EXTRA_REACTIONS[speciesId]?.[action] || COMPANION_EXTRA_REACTIONS.mystery[action] || '它开心地回应了这次互动。');
}

function maybeCompanionSelfChangeAccessory(companion, { force = false } = {}) {
    if (!force && (!companion.autoAccessory || Math.random() > 0.22)) return false;
    const choices = COMPANION_ACCESSORIES.filter(item => item.id !== 'none' && item.id !== companion.accessory);
    if (!choices.length) return false;
    const selected = choices[Math.floor(Math.random() * choices.length)];
    companion.accessory = selected.id;
    companion.message = `${companion.name}自己翻出${selected.name}戴好，又跑到屏幕前给你看。`;
    companion.mood = '得意';
    return true;
}

function renderCompanionAppV4(data) {
    const companion = data.world.companion;
    const moodClass = Number(companion.energy || 0) < 22 ? 'sleepy' : Number(companion.satiety || 0) < 22 ? 'hungry' : Number(companion.happiness || 0) >= 82 ? 'joyful' : Number(companion.happiness || 0) < 35 ? 'lonely' : 'calm';
    let html = renderCompanionAppV3(data)
        .replace('tf-companion-v3 ', `tf-companion-v3 tf-companion-v4 is-mood-${moodClass} is-habitat-${companion.habitat || 'meadow'} is-food-${companion.lastFood || 'bug-cookie'} `)
        .replace(/<div class="tf-pet-message">[\s\S]*?<\/div><div class="tf-pet-vitals">/, `<div class="tf-pet-message"><span>LIVE REACTION · ${escapeHtml(companion.mood || '平静')}</span><p>${escapeHtml(getCompanionAmbientReaction(data))}</p><small>反应由种类、天气、时间与当前状态在本地计算</small></div><div class="tf-pet-vitals">`);
    if (viewState.companionFoodMenuOpen) {
        const selected = Math.max(0, Math.min(COMPANION_FOODS.length - 1, Number(viewState.companionFoodIndex || 0)));
        const menu = `<div class="tf-pet-screen-menu tf-pet-food-select"><header><b>CHOOSE FOOD</b><button data-action="companion-food-back">×</button></header><div>${COMPANION_FOODS.map((food, index) => `<button class="${index === selected ? 'is-selected' : ''}" data-action="companion-feed-food" data-food-id="${food.id}" title="${food.name}"><span>${food.symbol}</span><b>${food.name}</b></button>`).join('')}</div></div>`;
        html = html.replace(/<div class="tf-pet-screen-menu">[\s\S]*?<\/div><div class="tf-pet-screen-bottom">/, `${menu}<div class="tf-pet-screen-bottom">`);
    }
    return html;
}

function renderInventoryApp(data) {
    const items = [...data.world.inventory].reverse();
    const activeItems = items.filter(item => !item.consumed && Number(item.quantity || 0) > 0);
    const metaFor = item => {
        const kind = classifyInventoryItem(item);
        if (kind === 'companion') return { id: 'companion', label: '食物', symbol: '●', note: '可以给旅伴', accent: '#b98555' };
        if (kind === 'medical') return { id: 'medical', label: '照护', symbol: '✚', note: '可以用于照护', accent: '#5d9a8b' };
        return { id: 'story', label: '纪念', symbol: '◇', note: '故事与收藏物', accent: '#806f9f' };
    };
    const filters = [
        ['all', '全部', activeItems.length],
        ['companion', '食物', activeItems.filter(item => metaFor(item).id === 'companion').length],
        ['medical', '照护', activeItems.filter(item => metaFor(item).id === 'medical').length],
        ['story', '纪念', activeItems.filter(item => metaFor(item).id === 'story').length],
        ['archive', '已用完', items.filter(item => item.consumed || Number(item.quantity || 0) <= 0).length],
    ];
    const allowedFilters = new Set(filters.map(([id]) => id));
    const filter = allowedFilters.has(viewState.inventoryFilter) ? viewState.inventoryFilter : 'all';
    const visible = items.filter(item => filter === 'archive'
        ? item.consumed || Number(item.quantity || 0) <= 0
        : !item.consumed && Number(item.quantity || 0) > 0 && (filter === 'all' || metaFor(item).id === filter));
    const selected = visible.find(item => item.id === viewState.selectedInventoryItemId) || visible[0] || null;
    const selectedMeta = selected ? metaFor(selected) : null;
    const totalQuantity = activeItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const grid = visible.length ? `<div class="tf-inventory-grid">${visible.map(item => {
        const meta = metaFor(item);
        return `<button class="tf-inventory-item ${selected?.id === item.id ? 'is-selected' : ''} ${item.consumed ? 'is-finished' : ''} is-${meta.id}" data-action="select-inventory-item" data-item-id="${escapeHtml(item.id)}" style="--inventory-accent:${meta.accent}"><span class="tf-inventory-item-icon">${meta.symbol}</span><span><b>${escapeHtml(item.name)}</b><small>${escapeHtml(meta.label)}</small></span><em>×${Number(item.quantity || 0)}</em></button>`;
    }).join('')}</div>` : `<div class="tf-inventory-filter-empty"><span>${filter === 'archive' ? '✓' : '＋'}</span><b>${filter === 'archive' ? '还没有用完的物品' : '这个分类还是空的'}</b><p>物品会按用途自动归类，不需要额外调用 API。</p></div>`;
    const detail = selected ? `<aside class="tf-card tf-inventory-detail is-${selectedMeta.id}" data-world-item-id="${escapeHtml(selected.id)}" style="--inventory-accent:${selectedMeta.accent}"><header><span>${selectedMeta.symbol}</span><div><small>${escapeHtml(selectedMeta.label)} · ${escapeHtml(selectedMeta.note)}</small><h3>${escapeHtml(selected.name)}</h3><p>${escapeHtml(selected.source || '来源不明')}</p></div><b>×${Number(selected.quantity || 0)}</b></header><div class="tf-inventory-description"><p>${escapeHtml(selected.description || '没有留下更多说明。')}</p>${selected.effect ? `<span>${icon('sparkles')}<b>物品效果</b>${escapeHtml(selected.effect)}</span>` : ''}</div><footer>${renderInventoryUseButton(selected)}<button class="tf-danger-text" data-action="delete-world-item" data-kind="inventory">删除物品</button></footer></aside>` : '';
    const empty = !items.length ? `<section class="tf-card tf-inventory-empty"><div class="tf-empty-pockets" aria-hidden="true"><span><i>●</i><b>食物</b></span><span><i>✚</i><b>照护</b></span><span><i>◇</i><b>纪念</b></span></div><div><h3>收纳位还空着</h3></div></section>` : '';
    return `<section class="tf-inventory-app"><header class="tf-card tf-inventory-hero"><div><h2>我的背包</h2><div class="tf-inventory-stats"><span><b>${activeItems.length}</b>种类</span><span><b>${totalQuantity}</b>件物品</span><span><b>${filters[1][2] + filters[2][2]}</b>可联动物品</span></div></div><div class="tf-inventory-bag" aria-hidden="true"><span></span><i></i><b>${totalQuantity}</b><em>PACK</em></div></header>${empty || `<nav class="tf-inventory-filters" aria-label="背包分类">${filters.map(([id, label, count]) => `<button class="${filter === id ? 'is-active' : ''}" data-action="set-inventory-filter" data-filter="${id}"><span>${label}</span><b>${count}</b></button>`).join('')}</nav><div class="tf-inventory-layout">${grid}${detail}</div>`}</section>`;
}

function renderHealthApp(data) {
    const items = [...data.world.health].reverse();
    return `<section class="tf-card tf-world-board tf-world-board-page"><header><div><h3>角色状态</h3><p>只记录虚构角色的身体事件与恢复进度。</p></div><span>${items.filter(item => item.status !== 'resolved').length} 项进行中</span></header><div>${items.length ? items.map(item => `<article class="${item.status === 'resolved' ? 'is-finished' : ''}" data-world-item-id="${escapeHtml(item.id)}"><div><b>${escapeHtml(item.subject)} · ${escapeHtml(item.name)}</b><small>${escapeHtml(item.severity)} · ${escapeHtml(item.status)}</small><p>${escapeHtml(item.symptoms)}</p>${item.storyEffect ? `<span>${escapeHtml(item.storyEffect)}</span>` : ''}</div><footer>${item.status !== 'resolved' ? '<button data-action="advance-health-status">推进恢复</button>' : ''}<button class="tf-danger-text" data-action="delete-world-item" data-kind="health">删除</button></footer></article>`).join('') : '<p class="tf-empty-mini">目前没有身体事件</p>'}</div></section>`;
}

function renderHealthAppV2(data) {
    const items = [...data.world.health].reverse();
    const active = items.filter(item => item.status !== 'resolved');
    const roles = getRoleLibrary(data).filter(npc => !npc.blocked);
    const stageLabels = { onset: '刚出现', noticed: '留意中', seeking: '寻找帮助', consulting: '问诊中', treating: '处理中', recovering: '恢复中', resolved: '已结束' };
    const severityLabels = { minor: '轻微', moderate: '需要留意', serious: '较严重' };
    return `<section class="tf-health-app"><header class="tf-card tf-health-hero"><div><small>LOCAL WELLNESS SERVICE</small><h2>健康与医疗</h2><p>让“长智齿、感冒、失眠”等虚构日常事件在论坛内形成发现、求助、就医和恢复的互动链。</p></div><div class="tf-health-start"><select id="tf-health-subject"><option value="">${escapeHtml(getMyDisplayName())}</option>${roles.map(npc => `<option value="${escapeHtml(npc.id)}">${escapeHtml(npc.name)}</option>`).join('')}</select><button class="tf-primary-button" data-action="create-local-health">触发一个日常事件</button><small>本地生成 · 不调用 API</small></div></header><div class="tf-health-list">${items.length ? items.map(item => {
        const providerNpc = item.providerNpcId ? data.npcs.find(npc => npc.id === item.providerNpcId) : null;
        const stages = ['noticed', 'seeking', 'consulting', 'treating', 'recovering', 'resolved'];
        const currentIndex = Math.max(0, stages.indexOf(item.stage || (item.status === 'resolved' ? 'resolved' : 'noticed')));
        return `<article class="tf-card tf-health-case ${item.status === 'resolved' ? 'is-resolved' : ''}" data-world-item-id="${escapeHtml(item.id)}"><header><div><span>${escapeHtml(severityLabels[item.severity] || item.severity)}</span><h3>${escapeHtml(item.subject)} · ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.symptoms)}</p></div><b>${escapeHtml(stageLabels[item.stage] || item.status)}</b></header><div class="tf-health-progress">${stages.map((stage, index) => `<i class="${index <= currentIndex ? 'is-done' : ''}" title="${stageLabels[stage]}"></i>`).join('')}<progress max="100" value="${Number(item.progress || 0)}"></progress></div>${item.provider ? `<div class="tf-health-provider">${icon('heart')}<div><small>正在提供帮助</small><b>${escapeHtml(item.provider)}</b>${item.careNote ? `<p>${escapeHtml(item.careNote)}</p>` : ''}</div>${providerNpc ? `<button class="tf-secondary-button" data-action="open-npc" data-npc-id="${escapeHtml(providerNpc.id)}">查看角色</button>` : ''}</div>` : `<p class="tf-health-story">${escapeHtml(item.storyEffect || '可以先观察，也可以寻找帮助。')}</p>`}<footer>${item.status !== 'resolved' ? `${!['seeking', 'consulting', 'treating', 'recovering'].includes(item.stage) ? '<button data-action="health-observe">先观察</button><button data-action="health-find-provider">寻找医生</button>' : ''}${item.stage === 'seeking' ? '<button data-action="health-consult">开始问诊</button>' : ''}${['consulting', 'treating'].includes(item.stage) ? '<button data-action="health-treat">按方案处理</button>' : ''}${item.stage === 'recovering' ? '<button data-action="health-resolve">确认恢复</button>' : ''}` : '<em>这段身体事件已经结束</em>'}<button class="tf-danger-text" data-action="delete-world-item" data-kind="health">删除记录</button></footer></article>`;
    }).join('') : '<div class="tf-card tf-empty tf-health-empty"><div class="tf-empty-icon">'+icon('heart')+'</div><div><h3>今天没有身体事件</h3><p>需要时可以本地触发；不依赖正文，也不会自动调用模型。</p></div></div>'}</div>${active.length ? '<p class="tf-fictional-care-note">仅用于虚构故事互动，不提供现实医疗判断。</p>' : ''}</section>`;
}

function getHealthSceneMeta(item) {
    const source = `${item.name || ''} ${item.symptoms || ''}`;
    if (/智齿|牙|口腔/.test(source)) return { id: 'tooth', symbol: '牙', label: '口腔护理', prop: '漱口杯', tint: '#fff0f3', accent: '#d46f88', note: '脸颊需要一点温柔照顾' };
    if (/感冒|喷嚏|嗓子|发热/.test(source)) return { id: 'cold', symbol: '暖', label: '感冒照护', prop: '毛毯', tint: '#edf6ff', accent: '#6598c7', note: '裹好毯子，慢慢恢复精神' };
    if (/过敏|发痒|鼻子/.test(source)) return { id: 'allergy', symbol: '敏', label: '过敏观察', prop: '纸巾', tint: '#fff4e8', accent: '#d58a50', note: '先把可能的诱因放远一点' };
    if (/失眠|睡|疲劳/.test(source)) return { id: 'sleep', symbol: '眠', label: '睡眠关怀', prop: '夜灯', tint: '#f1efff', accent: '#8075c7', note: '把灯调暗，让今天慢下来' };
    if (/肠胃|胃|食欲/.test(source)) return { id: 'stomach', symbol: '胃', label: '肠胃照护', prop: '温水', tint: '#eff8ed', accent: '#73a16c', note: '温水与清淡食物已经备好' };
    if (/扭伤|脚踝|肿痛/.test(source)) return { id: 'sprain', symbol: '护', label: '行动保护', prop: '靠垫', tint: '#eef7f7', accent: '#5e9d9c', note: '今天先把脚步放慢一点' };
    if (/肌肉|肩背|酸痛/.test(source)) return { id: 'muscle', symbol: '舒', label: '舒缓护理', prop: '热敷袋', tint: '#fff1ec', accent: '#cb8069', note: '热敷与休息都已安排上' };
    return { id: 'general', symbol: '心', label: '日常关怀', prop: '记录卡', tint: '#fff1f5', accent: '#c97b91', note: '有人正在认真关注这件事' };
}

function renderHealthAppV3(data) {
    const items = [...data.world.health].reverse();
    const active = items.filter(item => item.status !== 'resolved');
    const recovering = active.filter(item => item.stage === 'recovering' || item.status === 'recovering');
    const resolved = items.filter(item => item.status === 'resolved');
    const roles = getRoleLibrary(data).filter(npc => !npc.blocked);
    const stages = ['noticed', 'seeking', 'consulting', 'treating', 'recovering', 'resolved'];
    const stageLabels = { onset: '刚出现', noticed: '留意中', seeking: '寻找帮助', consulting: '问诊中', treating: '处理中', recovering: '恢复中', resolved: '已结束' };
    const severityLabels = { minor: '轻微', moderate: '需要留意', serious: '较严重' };
    const stageAction = item => item.status === 'resolved' ? '<em>这段身体事件已经结束</em>'
        : `${!['seeking', 'consulting', 'treating', 'recovering'].includes(item.stage) ? '<button data-action="health-observe">先观察</button><button data-action="health-find-provider">寻找医生</button>' : ''}${item.stage === 'seeking' ? '<button data-action="health-consult">开始问诊</button>' : ''}${['consulting', 'treating'].includes(item.stage) ? '<button data-action="health-treat">按方案处理</button>' : ''}${item.stage === 'recovering' ? '<button data-action="health-resolve">确认恢复</button>' : ''}`;
    const cards = items.map(item => {
        const providerNpc = item.providerNpcId ? data.npcs.find(npc => npc.id === item.providerNpcId) : null;
        const subjectNpc = item.subjectNpcId ? data.npcs.find(npc => npc.id === item.subjectNpcId) : null;
        const profile = getSettings().profile;
        const scene = getHealthSceneMeta(item);
        const patientAvatarUrl = subjectNpc?.avatarUrl || (!item.subjectNpcId ? profile.avatarUrl : '');
        const patientAvatarKey = subjectNpc?.avatarKey || (!item.subjectNpcId ? profile.avatarKey : '');
        const patientImage = renderStoredImage({ url: patientAvatarUrl, imageKey: patientAvatarKey, alt: item.subject, className: 'tf-care-portrait-image' });
        const patientPortrait = `<span class="tf-care-portrait ${patientImage ? 'has-image' : 'is-fallback'}">${icon('user')}${patientImage}</span>`;
        const stage = stages.includes(item.stage) ? item.stage : item.status === 'resolved' ? 'resolved' : 'noticed';
        const currentIndex = Math.max(0, stages.indexOf(stage));
        const providerScene = currentIndex >= 1 ? `<span class="tf-care-character is-helper ${providerNpc ? 'has-avatar' : ''}"><span class="tf-care-character-head">${providerNpc ? renderAvatar(providerNpc.name, { npcId: providerNpc.id, avatarUrl: providerNpc.avatarUrl, avatarKey: providerNpc.avatarKey }) : `<span class="tf-care-portrait is-provider-fallback">${icon('heart')}</span>`}</span><span class="tf-care-character-body"><i></i><i></i></span><small>${escapeHtml(item.provider || '护理助手')}</small></span>` : '';
        const progress = Math.max(0, Math.min(100, Number(item.progress || 0)));
        const progressLabel = stage === 'resolved' ? '恢复完成' : stage === 'recovering' ? '恢复进度' : '处理进度';
        const stepLabels = { noticed: '发现', seeking: '找帮助', consulting: '问诊', treating: '处理', recovering: '恢复', resolved: '完成' };
        const caseNumber = String(item.id || '').split('-').pop()?.slice(-5).toLocaleUpperCase() || 'LOCAL';
        return `<article class="tf-health-case tf-health-case-v3 tf-health-case-v4 is-stage-${stage} is-severity-${escapeHtml(item.severity)} ${item.status === 'resolved' ? 'is-resolved' : ''}" data-world-item-id="${escapeHtml(item.id)}">
            <header class="tf-clinic-case-bar"><span><small>病例</small><b>#${escapeHtml(caseNumber)}</b></span><em>${escapeHtml(severityLabels[item.severity] || item.severity)}</em><strong>${escapeHtml(stageLabels[stage])}</strong></header>
            <div class="tf-care-scene is-care-${scene.id} is-scene-stage-${stage}" style="--care-tint:${scene.tint};--care-accent:${scene.accent}" aria-label="${escapeHtml(`${scene.label}，${stageLabels[stage]}`)}">
                <header><span class="tf-care-scene-title">${icon('heart')}<b>${escapeHtml(scene.label)}</b></span><em>${escapeHtml(stageLabels[stage])}</em></header>
                <div class="tf-care-room"><span class="tf-care-window"><i></i><i></i></span><span class="tf-care-wall-mark">${escapeHtml(scene.symbol)}</span><span class="tf-care-couch"></span><span class="tf-care-character is-patient"><span class="tf-care-character-head">${patientPortrait}</span><span class="tf-care-character-body"><i></i><i></i></span><span class="tf-care-symptom">${escapeHtml(scene.symbol)}</span></span>${providerScene}<span class="tf-care-side-table"><i></i><b>${escapeHtml(scene.prop)}</b></span><span class="tf-care-instrument" aria-hidden="true"><i></i><i></i><b>${stage === 'noticed' ? 'OBS' : stage === 'seeking' ? 'CALL' : stage === 'consulting' ? 'SCAN' : stage === 'treating' ? 'CARE' : 'REST'}</b></span><span class="tf-care-caption">${escapeHtml(scene.note)}</span></div>
                <footer><span class="tf-care-progress-label">${progressLabel}</span><span class="tf-care-progress"><i style="width:${progress}%"></i></span><b>${progress}%</b></footer>
            </div>
            <div class="tf-health-case-copy"><header><div><small>当前症状</small><h3>${escapeHtml(item.subject)} · ${escapeHtml(item.name)}</h3><p>${escapeHtml(item.symptoms)}</p></div></header><section class="tf-clinic-timeline" aria-label="照护进度"><h4>恢复时间线</h4><div class="tf-health-steps">${stages.map((name, index) => `<span class="${index <= currentIndex ? 'is-done' : ''} ${index === currentIndex ? 'is-current' : ''}"><i></i><b>${stepLabels[name]}</b></span>`).join('')}</div></section>${item.provider ? `<div class="tf-health-provider tf-clinic-appointment">${icon('heart')}<div><small>当前预约 / 照护者</small><b>${escapeHtml(item.provider)}</b>${item.careNote ? `<p>${escapeHtml(item.careNote)}</p>` : ''}</div>${providerNpc ? `<button class="tf-secondary-button" data-action="open-npc" data-npc-id="${escapeHtml(providerNpc.id)}">查看角色</button>` : ''}</div>` : `<div class="tf-clinic-appointment is-pending">${icon('calendar')}<div><small>尚未安排照护</small><b>可以先观察，或寻找合适的医生</b><p>${escapeHtml(item.storyEffect || '这件事可以脱离正文在论坛内继续发展。')}</p></div></div>`}<footer>${stageAction(item)}<button class="tf-danger-text" data-action="delete-world-item" data-kind="health">删除记录</button></footer></div>
        </article>`;
    }).join('');
    return `<section class="tf-health-app tf-health-app-v3 tf-health-app-v4"><header class="tf-clinic-header"><div class="tf-clinic-brand"><span>${icon('heart')}</span><div><small>LOCAL CARE</small><h2>健康与医疗</h2><p>病例、检查、预约与恢复都在本地独立运行。</p></div></div><div class="tf-health-start"><label><span>为谁建立记录</span><select id="tf-health-subject"><option value="">${escapeHtml(getMyDisplayName())}</option>${roles.map(npc => `<option value="${escapeHtml(npc.id)}">${escapeHtml(npc.name)}</option>`).join('')}</select></label><button class="tf-primary-button" data-action="create-local-health">${icon('plus')}新建健康事件</button><small>不会自动调用 API，也不会自动注入正文</small></div></header><section class="tf-clinic-overview" aria-label="病例概览"><span><small>进行中</small><b>${active.length}</b><em>需要关注</em></span><span><small>恢复中</small><b>${recovering.length}</b><em>已有照护方案</em></span><span><small>已结束</small><b>${resolved.length}</b><em>保留在病例记录</em></span></section><div class="tf-health-list">${cards || `<div class="tf-health-empty"><span>${icon('heart')}</span><div><small>今日记录</small><h3>目前没有需要处理的身体事件</h3><p>你可以在上方为自己或角色建立一个本地事件。</p></div></div>`}</div>${active.length ? '<p class="tf-fictional-care-note">这里记录的是虚构角色事件，不提供现实医疗判断。</p>' : ''}</section>`;
}

function renderWorldFeaturePage(data, moduleId) {
    const definition = getModuleDefinition(moduleId);
    if (!definition || moduleId === 'forum' || !getSettings().modules[moduleId]?.enabled) {
        viewState.worldPage = '';
        return renderServicesHub(data);
    }
    const content = moduleId === 'tasks' ? renderTaskApp(data)
        : moduleId === 'fortune' ? renderFortuneAppV2(data)
            : moduleId === 'travel' ? renderCompanionAppV4(data)
                : moduleId === 'inventory' ? renderInventoryApp(data)
                    : moduleId === 'health' ? renderHealthAppV3(data)
                        : renderModeration(data, true);
    const apiButton = ['tasks', 'inventory'].includes(moduleId)
            ? `<button class="tf-secondary-button" data-action="refresh-world-module" data-module-id="${escapeHtml(moduleId)}" ${viewState.moduleBusy.has(moduleId) ? 'disabled' : ''}>${viewState.moduleBusy.has(moduleId) ? '<span class="tf-spinner"></span>' : icon('sparkles')}明确生成</button>` : '';
    return `<section class="tf-world-app-page"><header class="tf-world-app-header"><button class="tf-back-button" data-action="back-world-home">${icon('chevron')}世界</button><div><h1>${escapeHtml(definition.name)}</h1>${moduleId === 'inventory' ? '' : `<p>${escapeHtml(definition.description)}</p>`}</div>${apiButton}</header>${content}</section>`;
}

function renderWorldLayoutSettings(settings = getSettings()) {
    const ui = settings.ui;
    return `<section class="tf-card tf-settings-card tf-world-layout-settings"><header><div><h3>世界主页版面</h3><p>两种版面共用同一份世界数据；切换只改变显示，不调用 API。</p></div></header><div class="tf-world-layout-options"><label class="${ui.worldHomeLayout !== 'window' ? 'is-selected' : ''}"><input type="radio" name="tf-world-home-layout" value="bento" data-setting="ui.worldHomeLayout" ${ui.worldHomeLayout !== 'window' ? 'checked' : ''}><span><i>▦</i><b>生活面板</b><small>旅伴为主视觉，天气和运势放在旁边；手机端自动纵向排列。</small></span></label><label class="${ui.worldHomeLayout === 'window' ? 'is-selected' : ''}"><input type="radio" name="tf-world-home-layout" value="window" data-setting="ui.worldHomeLayout" ${ui.worldHomeLayout === 'window' ? 'checked' : ''}><span><i>▣</i><b>窗景主页</b><small>沉浸式场景窗搭配右侧 App 入口，适合桌面宽屏。</small></span></label></div></section>`;
}

function renderWorldModules(data) {
    const settings = getSettings();
    const linked = WORLD_MODULE_DEFINITIONS.filter(definition => definition.id !== 'forum' && settings.modules[definition.id].enabled && settings.modules[definition.id].generationMode === 'linked');
    const proactive = settings.social.proactiveDms;
    const linkedNames = [...linked.map(item => item.name), ...(proactive.enabled && proactive.withForumRefresh ? ['私信'] : [])];
    const dmControl = `<section class="tf-linked-dm-control"><header><div><b>${icon('message')}主动私信</b><small>命中概率时让已有角色随本轮论坛请求自然发来私信，不增加第二次调用。</small></div>${renderSwitch({ checked: proactive.enabled && proactive.withForumRefresh, action: 'toggle-linked-private-messages', label: '加入论坛联动' })}</header><div><label><span>每轮触发概率（%）</span><input type="number" min="0" max="100" data-setting="social.proactiveDms.probability" value="${Number(proactive.probability ?? 35)}"></label><label><span>每轮最多消息</span><input type="number" min="0" max="8" data-setting="social.proactiveDms.maxPerRun" value="${Number(proactive.maxPerRun || 0)}"></label></div></section>`;
    return `<section class="tf-section-page tf-modules-page"><header><div><h2>世界功能</h2><p>这里决定功能是否存在、如何生成及是否允许正文读取；内容会出现在私信、通知、个人页和角色主页的自然位置。</p></div><button class="tf-primary-button" data-action="generate-posts" ${viewState.busy || !settings.modules.forum.enabled ? 'disabled' : ''}>${viewState.busy ? '<span class="tf-spinner"></span>' : icon('refresh')}刷新论坛</button></header>${renderWorldLayoutSettings(settings)}<section class="tf-card tf-orchestrator-card"><header><div><h3>持续联动</h3><p>${linkedNames.length ? `每次论坛刷新都会按各自概率检查：${linkedNames.join('、')}；命中的内容合并为一次文本 API 调用。` : '当前没有其他功能参与论坛刷新。'}</p></div>${renderSwitch({ checked: settings.orchestration.enabled, action: 'toggle-orchestrator', label: '启用联动' })}</header><div class="tf-form-grid"><label><span>联动 API</span><select data-orchestration-field="apiProfileId">${renderModuleApiOptions(settings.orchestration.apiProfileId)}</select></label><div>${renderSwitch({ checked: settings.orchestration.worldTimeEnabled, action: 'toggle-world-time', label: '提供世界时间' })}</div><label><span>世界时间（可留空自动）</span><input data-orchestration-field="worldTimeLabel" value="${escapeHtml(settings.orchestration.worldTimeLabel)}" placeholder="例如：雨季第三周的夜晚"></label></div>${dmControl}</section><div class="tf-module-grid">${WORLD_MODULE_DEFINITIONS.map(renderModuleCard).join('')}</div></section>`;
}

function renderModeration(data, appMode = false) {
    const settings = getSettings();
    const world = data.world;
    const pendingReports = world.reports.filter(report => ['pending', 'reviewing'].includes(report.status));
    const pendingProposals = world.proposals.filter(proposal => proposal.moduleId === 'moderation' && proposal.status === 'pending');
    const roleOptions = selected => settings.moderation.permissionLevels.map(level => `<option value="${escapeHtml(level.id)}" ${selected === level.id ? 'selected' : ''}>${escapeHtml(level.name)} · 等级 ${Number(level.level)}</option>`).join('');
    const capabilityText = level => [['deletePost', '删帖'], ['adjudicateReport', '审理'], ['pinPost', '置顶'], ['issueTask', '发任务']].filter(([field]) => level?.[field]).map(([, label]) => label).join('、') || '普通成员权限';
    const userLevel = getPermissionLevel(settings, settings.profile.permissionRole);
    const members = [
        `<article class="is-user"><span class="tf-system-admin-avatar">我</span><div><b>${escapeHtml(getMyDisplayName())}<small>用户本人</small></b><span>@${escapeHtml(settings.profile.handle || 'me')}</span><small>${escapeHtml(capabilityText(userLevel))}</small></div><select data-user-permission-role aria-label="我的社区权限">${roleOptions(settings.profile.permissionRole)}</select></article>`,
        ...[...data.npcs].sort((a, b) => Number(b.systemRole) - Number(a.systemRole) || a.name.localeCompare(b.name, 'zh-CN')).map(npc => { const level = getPermissionLevel(settings, npc.permissionRole); return `<article data-npc-id="${escapeHtml(npc.id)}">${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<div><b>${escapeHtml(npc.name)}${npc.systemRole ? '<small>当前 Char</small>' : ''}</b><span>@${escapeHtml(npc.handle)}</span><small>${escapeHtml(capabilityText(level))}</small></div><select data-npc-permission-role aria-label="赋予角色权限">${roleOptions(npc.permissionRole)}</select></article>`; }),
    ];
    const assignments = `<section class="tf-card tf-settings-card tf-permission-assignments"><header><div><h3>成员权限</h3><p>AI 可在论坛生成时按世界观任命成员；你也可以在这里手动调整。</p></div><span>${data.npcs.length + 1} 位成员</span></header><div>${members.join('')}</div></section>`;
    const admins = data.npcs.filter(npc => roleCan(settings, npc, 'adjudicateReport'));
    const adminBusy = viewState.moduleBusy.has('moderator-profiles');
    const adminProfiles = `<section class="tf-card tf-settings-card tf-admin-profiles"><header><div><h3>管理员角色</h3><p>管理员可以有多位；他们是论坛角色，各自拥有符合世界观的人设和管理风格。</p></div><div><button class="tf-secondary-button" data-action="add-manual-moderator">手动新增</button><button class="tf-primary-button" data-action="generate-moderator-profiles" ${adminBusy ? 'disabled' : ''}>${adminBusy ? '<span class="tf-spinner"></span>生成中' : `${icon('sparkles')}按世界观生成`}</button></div></header><div>${admins.length ? admins.map(npc => `<article data-npc-id="${escapeHtml(npc.id)}"><div>${renderAvatar(npc.name, { avatarUrl: npc.avatarUrl, avatarKey: npc.avatarKey })}<label><span>名称</span><input data-npc-field="name" value="${escapeHtml(npc.name)}"></label><label><span>账号</span><input data-npc-field="handle" value="${escapeHtml(npc.handle)}"></label><select data-npc-permission-role>${roleOptions(npc.permissionRole)}</select></div><label><span>管理员人设</span><textarea rows="5" data-npc-field="persona" placeholder="经历、性格、管理原则与说话方式">${escapeHtml(npc.persona || '')}</textarea></label></article>`).join('') : '<p class="tf-empty-mini">目前没有管理员角色。可以手动新增，也可以主动调用一次 API 按世界观生成。</p>'}</div></section>`;
    const systemAdmin = `<section class="tf-card tf-settings-card tf-system-admin-card ${settings.moderation.systemAdminEnabled ? 'is-enabled' : ''}"><header><span class="tf-system-admin-avatar">AI</span><div><h3>AI 治理系统</h3><p>负责审理与权限建议，不代表唯一的管理员角色。驳回举报会直接生效，删除或警告仍遵守自动化权限。</p></div>${renderSwitch({ checked: settings.moderation.systemAdminEnabled, action: 'toggle-system-ai-admin', label: '' })}</header><div class="tf-system-admin-options">${renderSwitch({ checked: settings.moderation.npcReportsEnabled, action: 'toggle-npc-reports', label: '允许 NPC 举报帖子与评论' })}${renderSwitch({ checked: settings.moderation.autoAssignPermissions, action: 'toggle-auto-assign-permissions', label: '允许 AI 自动任命论坛成员' })}<small>举报与权限检查复用论坛原本的一次生成；只有主动审理或生成管理员人设才单独调用 API。</small></div></section>`;
    const heading = appMode ? systemAdmin : `<header><div><h2>社区治理</h2><p>社区规则、成员权限、举报与 AI 裁决都集中在这里。法条由你自行填写。</p></div></header>${systemAdmin}`;
    const reports = world.reports.length ? [...world.reports].reverse().map(report => { const post = data.posts.find(item => item.id === report.postId); const comment = report.commentId ? post?.comments?.find(item => item.id === report.commentId) : null; const target = comment || post; const label = comment ? '评论' : '帖子'; return `<article data-report-id="${escapeHtml(report.id)}"><div><b>${escapeHtml(target ? `${label} · @${target.handle}：${target.content.slice(0, 80)}` : '举报内容已不存在')}</b><p>${escapeHtml(report.reason)}</p><small>${escapeHtml(report.status)}${report.decision ? ` · ${escapeHtml(report.decision)}` : ''}</small></div><footer>${report.status === 'pending' ? `<button data-action="ai-review-report">AI 审理</button><button data-action="dismiss-report">驳回</button><button class="tf-danger-text" data-action="manual-remove-report-post">隐藏${label}</button>` : ''}</footer></article>`; }).join('') : '<p class="tf-empty-mini">暂时没有举报</p>';
    return `<section class="tf-section-page tf-moderation-page">${heading}<section class="tf-card tf-settings-card"><header><div><h3>社区规则</h3><p>AI 治理只按这里的规则判断，不会擅自引用现实法律。</p></div></header><textarea rows="8" data-moderation-rules>${escapeHtml(settings.moderation.communityRules)}</textarea></section>${adminProfiles}${assignments}<section class="tf-card tf-settings-card"><header><div><h3>权限层级</h3><p>角色获得某个身份后，只能使用该层级允许的操作。</p></div></header><div class="tf-permission-levels">${settings.moderation.permissionLevels.map(level => `<article data-permission-id="${escapeHtml(level.id)}"><label><span>名称</span><input data-permission-field="name" value="${escapeHtml(level.name)}"></label><label><span>等级</span><input type="number" data-permission-field="level" value="${Number(level.level)}"></label><div>${[['deletePost','删帖'],['adjudicateReport','审理举报'],['pinPost','置顶'],['issueTask','发布任务']].map(([field, label]) => `<label><input type="checkbox" data-permission-capability="${field}" ${level[field] ? 'checked' : ''}>${label}</label>`).join('')}</div></article>`).join('')}</div></section><section class="tf-card tf-settings-card"><header><div><h3>举报记录</h3><p>AI 驳回会直接结案；隐藏、删除或警告仍按自动化权限处理。</p></div><span>${pendingReports.length}</span></header><div class="tf-report-list">${reports}</div></section>${pendingProposals.length ? `<section class="tf-card tf-settings-card"><header><div><h3>等待确认的破坏性操作</h3><p>“先确认”模式下，隐藏、删除或警告需要有管理权限的用户确认。</p></div></header><div class="tf-proposal-list">${pendingProposals.map(proposal => `<article data-proposal-id="${escapeHtml(proposal.id)}"><div><b>${escapeHtml(proposal.title)}</b><p>${escapeHtml(proposal.description)}</p></div><footer><button data-action="resolve-proposal" data-accepted="true">执行</button><button data-action="resolve-proposal" data-accepted="false">拒绝</button></footer></article>`).join('')}</div></section>` : ''}</section>`;
}

function renderApiBodyExclusions(profile) {
    const excluded = new Set(profile.text.excludedBodyParameters || []);
    const fields = [
        ['model', '模型 model', '接口不接受模型名时排除'],
        ['temperature', '温度 temperature', '推理模型或代理不接受采样温度时排除'],
        ['max_tokens', '输出上限 max_tokens', '由服务端自行决定输出额度时排除'],
        ['response_format', '响应格式 response_format', '接口不支持 JSON 响应格式时排除'],
    ];
    return `<section class="tf-body-exclusion-panel"><header><div><h4>请求主体兼容</h4><p>只勾选当前接口明确不接受的标准字段；未勾选的字段会正常发送。</p></div></header><div>${fields.map(([id, label, note]) => `<label><input type="checkbox" data-api-body-exclusion="${id}" ${excluded.has(id) ? 'checked' : ''}><span><b>${label}</b><small>${note}</small></span></label>`).join('')}</div><small>这不会修改生成内容，只控制发送给独立 API 的请求主体。已保存的旧版额外参数会保留在数据中，但不再从界面发送或编辑。</small></section>`;
}

function renderApiModelPicker(kind, config, profile) {
    const key = `${profile.id}:${kind}`;
    const models = viewState.apiModels.get(key) || [];
    const busy = viewState.apiModelBusy.has(key);
    const listId = `tf-models-${key.replace(/[^a-z0-9_-]/gi, '-')}`;
    const label = kind === 'image' ? '生图模型' : '模型名称';
    const hasSelectedModel = models.includes(config.model);
    const modelCatalog = models.length
        ? `<label class="tf-api-model-catalog"><span>已读取模型</span><select data-api-model-choice="${kind}" aria-label="选择${label}"><option value="" ${hasSelectedModel ? '' : 'selected'}>选择一个模型（${models.length}）</option>${models.map(model => `<option value="${escapeHtml(model)}" ${config.model === model ? 'selected' : ''}>${escapeHtml(model)}</option>`).join('')}</select></label>`
        : '';
    return `<div class="tf-api-model-field"><span>${label}</span><div><input list="${escapeHtml(listId)}" data-api-setting="${kind}.model" value="${escapeHtml(config.model)}" placeholder="可以手动输入模型名称" autocomplete="off"><button type="button" class="tf-secondary-button" data-action="fetch-api-models" data-api-kind="${kind}" ${busy ? 'disabled' : ''}>${busy ? '<span class="tf-spinner"></span>读取中' : `${icon('refresh')}读取模型`}</button></div>${modelCatalog}<datalist id="${escapeHtml(listId)}">${models.map(model => `<option value="${escapeHtml(model)}"></option>`).join('')}</datalist><small>${models.length ? `已读取 ${models.length} 个模型；可直接选择，也可继续手动输入。` : '不会自动请求；点击“读取模型”时才访问一次当前 API 的 /models。'}</small></div>`;
}

function dismissApiModelKeyboard() {
    const activeElement = document.activeElement;
    if (activeElement && typeof activeElement.blur === 'function') activeElement.blur();
    try { globalThis.navigator?.virtualKeyboard?.hide?.(); } catch { /* unsupported mobile browser */ }
}

function renderApiSettings() {
    const settings = getSettings();
    const profile = getActiveApiProfile();
    const textConfig = getApiConfig('text');
    const imageConfig = getApiConfig('image');
    const isSt = textConfig.provider === 'sillytavern';
    const textPanel = isSt
        ? `<div class="tf-st-provider-note">无需填写地址或 Key。切换酒馆主界面的连接后，微坛会自动跟随；采样参数由酒馆当前连接管理。思考模型会消耗更多输出额度，建议论坛最大输出保持 8192 或更高。</div><div class="tf-form-grid"><label><span>论坛最大输出 Tokens</span><input type="number" data-api-setting="text.maxTokens" value="${Number(textConfig.maxTokens)}" min="1024" max="65536" step="256"></label></div>`
        : `<div class="tf-form-grid"><label><span>API 地址</span><input data-api-setting="text.endpoint" value="${escapeHtml(textConfig.endpoint)}" placeholder="https://api.example.com/v1"></label>${renderApiModelPicker('text', textConfig, profile)}<label><span>API Key</span><input type="password" data-secret="text" value="${escapeHtml(textConfig.apiKey)}"></label><label><span>温度</span><input type="number" data-api-setting="text.temperature" value="${Number(textConfig.temperature)}" min="0" max="2" step="0.1"></label><label><span>最大输出 Tokens</span><input type="number" data-api-setting="text.maxTokens" value="${Number(textConfig.maxTokens)}" min="1024" max="65536" step="256"></label></div>${renderApiBodyExclusions(profile)}`;
    return `<section class="tf-section-page"><header><div><h2>API 配置</h2><p>可以直接使用酒馆当前连接，也可以保存多套独立 API 与参数。</p></div></header><section class="tf-card tf-api-profile-bar"><select data-action="select-api-profile">${settings.apiProfiles.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === profile.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select><button class="tf-secondary-button" data-action="new-api-profile">另存为</button><button class="tf-secondary-button" data-action="rename-api-profile" ${profile.reserved ? 'disabled' : ''}>重命名</button><button class="tf-danger-text" data-action="delete-api-profile" ${profile.reserved ? 'disabled' : ''}>删除</button></section><section class="tf-card tf-settings-card"><header><div><h3>文本生成</h3><p>${isSt ? '使用 SillyTavern 当前选中的 API 与模型。' : '使用独立的 OpenAI Chat Completions 兼容接口。'}</p></div><span class="tf-provider-badge">${isSt ? '酒馆默认' : '独立 API'}</span></header>${textPanel}</section><section class="tf-card tf-settings-card"><header><div><h3>帖子与评论图片</h3><p>帖子和评论共用这一套生图配置；没有 API 时可显示文字配图。</p></div></header><div class="tf-form-grid"><div>${renderSwitch({ checked: imageConfig.enabled, action: 'toggle-image-api', label: '启用真实生图 API' })}</div><div>${renderSwitch({ checked: imageConfig.textFallback, action: 'toggle-text-image-fallback', label: '无 API 时显示文字配图' })}</div><label><span>生图地址</span><input data-api-setting="image.endpoint" value="${escapeHtml(imageConfig.endpoint)}"></label>${renderApiModelPicker('image', imageConfig, profile)}<label><span>API Key</span><input type="password" data-secret="image" value="${escapeHtml(imageConfig.apiKey)}"></label><label><span>图片尺寸</span><select data-api-setting="image.size">${['1024x1024','1024x1536','1536x1024','512x512'].map(size => `<option ${imageConfig.size === size ? 'selected' : ''}>${size}</option>`).join('')}</select></label><div>${renderSwitch({ checked: imageConfig.autoGenerate, action: 'toggle-auto-image', label: '自动处理第一张配图' })}</div></div></section><section class="tf-card tf-settings-card"><header><div><h3>API Key 保存</h3><p>默认仅保留在当前页面会话。</p></div>${renderSwitch({ checked: settings.privacy.rememberApiKeys, action: 'toggle-remember-keys', label: '记住 API Key' })}</header></section></section>`;
}

function renderWorldInfoCatalogLegacy(settings) {
    if (viewState.worldLoading) return '<p class="tf-empty-mini"><span class="tf-spinner"></span> 正在读取世界书</p>';
    if (!viewState.worldCatalog.length) return '<p class="tf-empty-mini">没有找到世界书条目。请确认酒馆中已有世界书，然后点击右上角“刷新”。</p>';
    const masterNotice = settings.sources.worldInfo
        ? '<p class="tf-catalog-state is-on">已开启读取：勾选的条目会参与论坛生成。</p>'
        : '<p class="tf-catalog-state">总开关已关闭：可以预先选择条目，但当前不会参与论坛生成。</p>';
    return `${masterNotice}<div class="tf-world-books">${viewState.worldCatalog.map(book => `<details><summary><b>${escapeHtml(book.name)}</b><span>${book.entries.filter(entry => settings.sources.worldInfoEntries[entry.key]).length}/${book.entries.length}</span></summary><div class="tf-world-tools"><button data-action="select-world-book" data-book="${escapeHtml(book.name)}">选择酒馆已启用条目</button><button data-action="clear-world-book" data-book="${escapeHtml(book.name)}">清空</button></div>${book.entries.map(entry => `<label class="tf-world-entry"><input type="checkbox" data-world-entry="${escapeHtml(entry.key)}" ${settings.sources.worldInfoEntries[entry.key] ? 'checked' : ''}><span><b>${escapeHtml(entry.title)}</b><small>${entry.disabledInSillyTavern ? '酒馆中已禁用 · ' : ''}${escapeHtml(entry.content.slice(0, 100))}</small></span></label>`).join('')}</details>`).join('')}</div>`;
}

function renderWorldInfoCatalog(settings) {
    if (viewState.worldLoading) return '<p class="tf-empty-mini"><span class="tf-spinner"></span> 正在读取世界书</p>';
    if (!viewState.worldCatalog.length) return '<p class="tf-empty-mini">没有找到世界书条目。请确认酒馆中已有世界书，然后点击右上角“刷新”。</p>';
    const masterNotice = settings.sources.worldInfo
        ? '<p class="tf-catalog-state is-on">已开启世界书读取。当前 Char 的主要/附加世界书会自动识别，其他世界书需手动打开。</p>'
        : '<p class="tf-catalog-state">世界书总开关已关闭；以下选择会保留，但当前不会参与论坛生成。</p>';
    const renderBook = book => {
        const selectedCount = book.entries.filter(entry => entry.selected).length;
        const effectiveCount = book.enabled ? selectedCount : 0;
        const bindingLabels = {
            primary: '当前 Char · 主要',
            auxiliary: '当前 Char · 附加',
            'primary-and-auxiliary': '当前 Char · 主要/附加',
        };
        const badge = book.characterBound ? `<em class="tf-world-bound-badge">${bindingLabels[book.characterBinding] || '当前 Char 世界书'}</em>` : '';
        return `<details class="${book.enabled ? 'is-enabled' : 'is-disabled'}"><summary><span><b>${escapeHtml(book.name)}</b>${badge}</span><span>${effectiveCount}/${book.entries.length} 条参与读取</span></summary><div class="tf-world-book-master">${renderSwitch({ checked: book.enabled, action: 'toggle-world-book', label: book.enabled ? '读取此世界书' : '暂不读取此世界书', dataset: { book: book.name } })}<small>此开关只控制整本书是否读取，不会改变下面各条目的选择。</small></div><div class="tf-world-tools"><button data-action="select-world-book" data-book="${escapeHtml(book.name)}">按酒馆状态选择条目</button><button data-action="clear-world-book" data-book="${escapeHtml(book.name)}">取消所有条目选择</button></div>${book.entries.map(entry => `<label class="tf-world-entry"><input type="checkbox" data-world-entry="${escapeHtml(entry.key)}" ${entry.selected ? 'checked' : ''}><span><b>${escapeHtml(entry.title)}</b><small>${entry.disabledInSillyTavern ? '酒馆中已禁用 · ' : ''}${escapeHtml(entry.content.slice(0, 100))}</small></span></label>`).join('')}</details>`;
    };
    const visibleBooks = viewState.worldCatalog.filter(book => book.characterBound || book.enabled);
    const hiddenBooks = viewState.worldCatalog.filter(book => !book.characterBound && !book.enabled);
    const books = visibleBooks.length
        ? visibleBooks.map(renderBook).join('')
        : '<p class="tf-empty-mini">当前 Char 没有绑定世界书，也还没有手动打开其他世界书。</p>';
    const otherBooks = hiddenBooks.length
        ? `<details class="tf-world-other-books"><summary><span><b>其他世界书</b><small>默认不读取，手动打开后才显示条目</small></span><span>${hiddenBooks.length} 本</span></summary><div class="tf-world-other-list">${hiddenBooks.map(book => `<div class="tf-world-other-row"><span><b>${escapeHtml(book.name)}</b><small>${book.entries.length} 条</small></span><button class="tf-secondary-button" data-action="open-world-book" data-book="${escapeHtml(book.name)}">打开</button></div>`).join('')}</div></details>`
        : '';
    return `${masterNotice}<div class="tf-world-books">${books}${otherBooks}</div>`;
}

function renderSillyTavernPresetCatalog(settings) {
    const entries = getSillyTavernPresetCatalog();
    if (!entries.length) return '<p class="tf-empty-mini">当前酒馆连接没有可读取的文本预设条目。</p>';
    const roleLabel = { system: '系统', user: '用户', assistant: '助手' };
    const masterNotice = settings.sources.sillyTavernPreset
        ? '<p class="tf-catalog-state is-on">已开启读取：勾选的预设条目会复制到论坛请求。</p>'
        : '<p class="tf-catalog-state">总开关已关闭：可以预先选择条目，但当前不会复制到论坛请求。</p>';
    return `${masterNotice}<div class="tf-preset-catalog">${entries.map(entry => `<label class="tf-world-entry"><input type="checkbox" data-preset-entry="${escapeHtml(entry.id)}" ${settings.sources.presetEntries[entry.id] ? 'checked' : ''}><span><b>${escapeHtml(entry.title)}</b><small>${roleLabel[entry.role] || entry.role}${entry.disabledInSillyTavern ? ' · 酒馆中已禁用' : ' · 酒馆中已启用'} · ${escapeHtml(entry.content.slice(0, 120))}</small></span></label>`).join('')}</div>`;
}

function getForumReadOrderItems(settings = getSettings()) {
    const data = getForumData();
    const sourceContext = viewState.promptSourceContext || {};
    const visiblePosts = data.posts.filter(post => !post.moderation?.hidden);
    const scanText = [
        sourceContext.chat,
        sourceContext.userPersona,
        sourceContext.characterPersona,
        ...(sourceContext.worldInfo || []).map(entry => entry.content),
        ...(sourceContext.facts || []).map(entry => entry.content),
        ...visiblePosts.slice(-6).map(post => post.content),
    ].filter(Boolean).join('\n');
    const items = [
        { id: 'builtin:forum-system', title: '论坛主提示词', type: '内置', role: 'system', defaultPosition: 100, note: '始终发送；内容在“内置提示词”中编辑' },
    ];
    (sourceContext.presetPrompts || []).forEach((entry, index) => items.push({
            id: `preset:${entry.id}`,
            title: entry.title,
            type: '酒馆预设',
            role: entry.role,
            defaultPosition: 200 + (Number.isFinite(Number(entry.order)) ? Number(entry.order) : index),
            note: '论坛只读取这里勾选的酒馆预设副本',
            preview: entry.content.slice(0, 240),
        }));
    getActivePromptEntries(settings.promptEntries, scanText).forEach((entry, index) => items.push({
        id: `forum:${entry.id}`,
        title: entry.title || '未命名论坛设定',
        type: '论坛设定',
        role: entry.role,
        defaultPosition: 300 + index,
        note: entry.constant ? '常驻' : `命中触发词后读取：${(entry.keywords || []).join('、') || '尚未填写'}`,
        entry,
    }));
    if (sourceContext.userPersona) items.push({ id: 'source:user-persona', title: 'User 人设', type: '角色资料', role: 'user', defaultPosition: 400, note: '本轮有内容，会实际发送' });
    if (sourceContext.characterPersona) items.push({ id: 'source:character-persona', title: 'Char 人设', type: '角色资料', role: 'user', defaultPosition: 410, note: '本轮有内容，会实际发送' });
    (sourceContext.worldInfo || []).forEach((entry, index) => items.push({
            id: `world:${entry.key}`,
            title: `${entry.book} / ${entry.title}`,
            type: '世界书',
            role: 'user',
            defaultPosition: 500 + (Number.isFinite(Number(entry.position)) ? Number(entry.position) : index),
            note: '已允许论坛读取',
            preview: entry.content.slice(0, 240),
        }));
    if (sourceContext.chat) items.push({ id: 'source:chat', title: '最近故事正文', type: '聊天', role: 'user', defaultPosition: 600, note: `最近 ${Number(settings.generation.contextMessages || 20)} 条` });
    if ((sourceContext.facts || []).length) items.push({ id: 'source:facts', title: '可公开事实', type: '论坛资料', role: 'user', defaultPosition: 650, note: '仅发送公开且允许发布的事实' });
    if ((sourceContext.roleMemories || []).length) items.push({ id: 'source:role-memories', title: '角色独立社交记忆', type: '论坛资料', role: 'user', defaultPosition: 660, note: '按角色信息边界读取' });
    if (data.npcs.some(npc => npc.blocked)) items.push({ id: 'source:excluded-roles', title: '不得出现的账号', type: '论坛资料', role: 'user', defaultPosition: 670, note: '已拉黑角色' });
    if (visiblePosts.length) items.push({ id: 'source:existing-posts', title: '论坛已有讨论', type: '论坛资料', role: 'user', defaultPosition: 700, note: `最近 ${Math.min(6, visiblePosts.length)} 篇` });
    if (buildLinkedWorldInstruction({ settings, data })) items.push({ id: 'source:linked-world', title: '联动世界模块', type: '世界功能', role: 'user', defaultPosition: 750, note: '本轮会随论坛请求一起发送' });
    items.push({ id: 'builtin:generation', title: '生成与输出格式', type: '内置', role: 'user', defaultPosition: 900, note: '始终发送；包含论坛输出结构要求' });
    return orderForumPromptItems(items, settings.sources.promptOrder);
}

function saveForumReadOrder(items) {
    const settings = getSettings();
    const reorderedIds = items.map(item => item.id);
    const visibleIds = new Set(reorderedIds);
    let cursor = 0;
    const merged = (settings.sources.promptOrder || []).map(id => visibleIds.has(id) ? reorderedIds[cursor++] : id);
    while (cursor < reorderedIds.length) {
        const generationIndex = merged.indexOf('builtin:generation');
        merged.splice(generationIndex < 0 ? merged.length : generationIndex, 0, reorderedIds[cursor++]);
    }
    settings.sources.promptOrder = [...new Set(merged)];
    saveSettings();
}

function moveForumReadOrderItem(sourceId, targetId, placement = 'before') {
    const items = getForumReadOrderItems();
    const sourceIndex = items.findIndex(item => item.id === sourceId);
    const targetIndex = items.findIndex(item => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return false;
    const [item] = items.splice(sourceIndex, 1);
    const adjustedTarget = items.findIndex(entry => entry.id === targetId);
    items.splice(adjustedTarget + (placement === 'after' ? 1 : 0), 0, item);
    saveForumReadOrder(items);
    return true;
}

function moveForumReadOrderByStep(sourceId, direction) {
    const items = getForumReadOrderItems();
    const sourceIndex = items.findIndex(item => item.id === sourceId);
    const targetIndex = sourceIndex + (Number(direction) < 0 ? -1 : 1);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return false;
    [items[sourceIndex], items[targetIndex]] = [items[targetIndex], items[sourceIndex]];
    saveForumReadOrder(items);
    return true;
}

function renderSourcesSettings() {
    const settings = getSettings();
    const tokens = viewState.injectionTokens;
    const overBudget = tokens.total > Number(settings.injection.tokenBudget || 2000);
    const injectionSection = `<section class="tf-card tf-settings-card" data-settings-block="chat-injection">
        <header><div><h3>注入主聊天 <span class="tf-direction-tag">论坛 → 正文</span></h3><p>这是“主聊天读取论坛内容”的统一入口。每篇帖子仍需在右上角“三个点”中单独选择；世界模块在“世界模块”页单独控制。</p></div></header>
        <div class="tf-token-meter ${overBudget ? 'is-over' : ''}"><div><span>当前实际注入</span><b data-injection-token-total>${tokens.loading ? '计算中…' : `${numberLabel(tokens.total)} Tokens`}</b><small data-injection-token-parts>帖子 ${numberLabel(tokens.forum)} · 角色人设 ${numberLabel(tokens.roles)} · 世界模块 ${numberLabel(tokens.world)}</small></div><progress max="${Number(settings.injection.tokenBudget || 2000)}" value="${Math.min(tokens.total, Number(settings.injection.tokenBudget || 2000))}"></progress>${overBudget ? '<strong>已超过提醒预算，请减少注入帖子、评论、角色人设或世界模块。</strong>' : ''}</div>
        <div class="tf-form-grid"><div>${renderSwitch({ checked: settings.injection.enabled, action: 'toggle-master-injection', label: '允许选中的帖子进入正文' })}</div><div>${renderSwitch({ checked: settings.injection.includeComments, action: 'toggle-include-comments', label: '帖子评论也进入正文' })}</div><div>${renderSwitch({ checked: settings.injection.npcEnabled, action: 'toggle-npc-master-injection', label: '角色人设也可进入正文' })}</div><label><span>Token 提醒预算</span><input type="number" data-setting="injection.tokenBudget" value="${Number(settings.injection.tokenBudget || 2000)}" min="100" max="100000"></label><label><span>注入深度</span><input type="number" data-setting="injection.depth" value="${Number(settings.injection.depth)}" min="0" max="10000"></label><label><span>最多注入帖子</span><input type="number" data-setting="injection.maxPosts" value="${Number(settings.injection.maxPosts)}" min="1" max="50"></label></div>
    </section>`;
    const sourceSection = `<section class="tf-card tf-settings-card">
        <header><div><h3>论坛生成素材 <span class="tf-direction-tag">正文 → 论坛</span></h3><p>决定生成论坛内容时能参考哪些酒馆资料；这里的开关不会把论坛内容注入主聊天。</p></div></header>
        <div class="tf-form-grid"><div>${renderSwitch({ checked: settings.sources.chat, action: 'toggle-source-chat', label: '把最近正文作为论坛生成素材' })}</div><div>${renderSwitch({ checked: settings.sources.userPersona, action: 'toggle-source-user', label: '读取 User 人设' })}</div><div>${renderSwitch({ checked: settings.sources.characterPersona, action: 'toggle-source-character', label: '读取 Char 人设' })}</div><div>${renderSwitch({ checked: settings.sources.worldInfo, action: 'toggle-source-world', label: '读取世界书' })}</div><div>${renderSwitch({ checked: settings.sources.sillyTavernPreset, action: 'toggle-source-preset', label: '读取酒馆当前预设' })}</div><div>${renderSwitch({ checked: settings.generation.autoRefreshOnMessage, action: 'toggle-auto-refresh', label: 'Char 新回复后自动刷新论坛' })}<small class="tf-setting-hint">收到新的 Char 正文后自动生成一轮动态；开场白不会触发。</small></div><label><span>最近消息数</span><input type="number" data-setting="generation.contextMessages" value="${Number(settings.generation.contextMessages)}" min="1" max="200"></label></div>
        <div class="tf-generation-ranges"><div><b>每轮帖子数量</b><label>最少<input type="number" data-setting="generation.postsMin" value="${Number(settings.generation.postsMin)}" min="1" max="10"></label><label>最多<input type="number" data-setting="generation.postsMax" value="${Number(settings.generation.postsMax)}" min="1" max="10"></label></div><div><b>每篇初始评论</b><label>最少<input type="number" data-setting="generation.commentsMin" value="${Number(settings.generation.commentsMin)}" min="0" max="8"></label><label>最多<input type="number" data-setting="generation.commentsMax" value="${Number(settings.generation.commentsMax)}" min="0" max="8"></label></div><div><b>回帖后的 AI 跟帖</b><label>最少<input type="number" data-setting="generation.repliesMin" value="${Number(settings.generation.repliesMin)}" min="1" max="8"></label><label>最多<input type="number" data-setting="generation.repliesMax" value="${Number(settings.generation.repliesMax)}" min="1" max="8"></label></div></div><div class="tf-source-order-link"><span>${icon('list')}<b>发送顺序由“论坛设定”统一管理</b><small>这里仅决定哪些来源允许读取，不再保存另一套排序。</small></span><button class="tf-secondary-button" data-action="open-settings" data-section="prompts">管理发送顺序</button></div>
        <div class="tf-world-head"><b>酒馆预设逐条选择（只读副本）</b><small>这里的开关不会修改酒馆预设原条目</small></div>${renderSillyTavernPresetCatalog(settings)}
        <div class="tf-world-head"><b>世界书逐条选择</b><button class="tf-secondary-button" data-action="refresh-world-info">刷新</button></div>${renderWorldInfoCatalog(settings)}
    </section>`;
    const cleanupSection = `<section class="tf-card tf-settings-card"><header><div><h3>自动清理</h3><p>收藏帖始终保留。</p></div></header><div class="tf-form-grid"><div>${renderSwitch({ checked: settings.retention.autoCleanup, action: 'toggle-auto-cleanup', label: '启用自动清理' })}</div><label><span>帖子数量上限</span><input type="number" data-setting="retention.maxPosts" value="${Number(settings.retention.maxPosts)}" min="1" max="5000"></label></div><footer><button class="tf-secondary-button" data-action="cleanup-now">立即清理</button></footer></section>`;
    return `<section class="tf-section-page"><header><div><h2>内容与正文联动</h2><p>分别管理两个相反方向：主聊天读取论坛内容，以及论坛生成读取酒馆资料。</p></div></header>${injectionSection}${sourceSection}${cleanupSection}</section>`;
}

function renderAppearanceSettingsLegacyOld() {
    const appearance = getSettings().appearance;
    return `<section class="tf-section-page"><header><div><h2>外观</h2><p>名称、字体、颜色和自定义 CSS 都会即时生效。</p></div></header><section class="tf-card tf-settings-card"><header><div><h3>基础外观</h3><p>字体留空时自动跟随 SillyTavern。</p></div></header><div class="tf-form-grid"><label><span>论坛名称</span><input data-appearance="forumName" value="${escapeHtml(appearance.forumName)}" maxlength="30"></label><label><span>自定义字体</span><input data-appearance="fontFamily" value="${escapeHtml(appearance.fontFamily)}" placeholder="留空跟随酒馆；例：霞鹜文楷"></label><label class="tf-color-field"><span>主题色</span><input type="color" data-appearance="primaryColor" value="${escapeHtml(appearance.primaryColor)}"><code>${escapeHtml(appearance.primaryColor)}</code></label><label class="tf-color-field"><span>背景色</span><input type="color" data-appearance="backgroundColor" value="${escapeHtml(appearance.backgroundColor)}"><code>${escapeHtml(appearance.backgroundColor)}</code></label><label class="tf-color-field"><span>卡片色</span><input type="color" data-appearance="cardColor" value="${escapeHtml(appearance.cardColor)}"><code>${escapeHtml(appearance.cardColor)}</code></label><label class="tf-color-field"><span>文字色</span><input type="color" data-appearance="textColor" value="${escapeHtml(appearance.textColor)}"><code>${escapeHtml(appearance.textColor)}</code></label></div></section><section class="tf-card tf-settings-card"><header><div><h3>导入 CSS 美化</h3><p>导入 .css 文件或直接粘贴。建议只使用 #tavern-forum-root 下的选择器。</p></div><div><button class="tf-secondary-button" data-action="import-css">导入 CSS</button><button class="tf-danger-text" data-action="clear-css">清空</button></div></header><textarea class="tf-custom-css" data-appearance="customCss" rows="16" placeholder="#tavern-forum-root .tf-post { ... }">${escapeHtml(appearance.customCss)}</textarea></section></section>`;
}

function renderAppearanceSettingsLegacy(beforeCss = '') {
    const appearance = getSettings().appearance;
    const colorField = (field, label) => `<label class="tf-color-field"><span>${label}</span><input type="color" data-appearance="${field}" value="${escapeHtml(appearance[field])}"><code>${escapeHtml(appearance[field])}</code></label>`;
    const cssValue = getEffectiveCustomCss(appearance);
    return `<section class="tf-section-page"><header><div><h2>外观</h2><p>名称、字体、颜色和自定义 CSS 都会即时生效。</p></div></header>
        <section class="tf-card tf-settings-card"><header><div><h3>基础外观</h3><p>字体留空时自动跟随 SillyTavern。</p></div></header><div class="tf-form-grid"><label><span>论坛名称</span><input data-appearance="forumName" value="${escapeHtml(appearance.forumName)}" maxlength="30"></label><label><span>自定义字体</span><input data-appearance="fontFamily" value="${escapeHtml(appearance.fontFamily)}" placeholder="留空跟随酒馆；例：霞鹜文楷"></label>${colorField('primaryColor', '主题色')}${colorField('backgroundColor', '整体背景色')}${colorField('cardColor', '普通卡片色')}${colorField('textColor', '文字色')}</div></section>
        <section class="tf-card tf-settings-card"><header><div><h3>界面区域颜色</h3><p>可直接去掉原来的固定蓝色，不需要编写 CSS。</p></div></header><div class="tf-form-grid">${colorField('topNavColor', '顶部导航')}${colorField('sideNavColor', '左侧设置导航')}${colorField('activeNavColor', '选中导航项')}${colorField('postColor', '帖子卡片')}${colorField('commentColor', '评论区域')}</div></section>
        ${beforeCss}
        <section class="tf-card tf-settings-card"><header><div><h3>全局 CSS 主题</h3><p>v2 模板已适配论坛、个人页、消息、世界主页、独立 App、设置中心和手机端；只会作用于插件内部。</p></div><div class="tf-css-actions"><button class="tf-secondary-button" data-action="import-css">导入 CSS</button><button class="tf-secondary-button" data-action="restore-standard-css">恢复标准模板</button><button class="tf-danger-text" data-action="clear-css">清空</button></div></header><textarea class="tf-custom-css" data-appearance="customCss" rows="24" spellcheck="false" aria-label="全局 CSS 主题" placeholder="#tavern-forum-root .tf-post { ... }">${escapeHtml(cssValue)}</textarea><footer class="tf-custom-css-scope-note"><span>作用域</span><code>#tavern-forum-root</code><small>自定义内容会即时预览；建议保留此前缀，避免影响酒馆界面。</small></footer></section>
    </section>`;
}

function renderWindowThemeSettings(settings) {
    const labels = {
        home: ['首页', '论坛信息流与帖子'],
        messages: ['消息', '私信与通知'],
        me: ['“我”与普通设置', '个人主页及大部分设置页'],
        profile: ['帖子与角色主页', '完整帖子、角色公开主页与角色编辑'],
        modules: ['世界模块', '任务、运势、外出、背包和健康'],
        moderation: ['社区治理', '规则、权限与举报后台'],
    };
    return `<section class="tf-card tf-settings-card tf-view-theme-settings"><header><div><h3>每个窗口独立外观</h3><p>每个窗口可以继承全局，也可以拥有自己的底色、卡片色、壁纸和 CSS。</p></div></header><div class="tf-view-theme-list">${Object.entries(labels).map(([id, [title, description]]) => { const theme = settings.appearance.viewThemes[id]; const preview = renderStoredImage({ url: theme.wallpaperUrl, imageKey: theme.wallpaperKey, alt: `${title}壁纸` }); return `<details data-view-theme-id="${escapeHtml(id)}"><summary><div><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></div><span>${theme.inherit ? '继承全局' : '独立外观'}</span></summary><div class="tf-view-theme-editor"><div>${renderSwitch({ checked: theme.inherit, action: 'toggle-view-theme-inherit', label: '继承全局外观', dataset: { viewId: id } })}</div><label><span>窗口底色</span><input type="color" data-view-theme-field="backgroundColor" value="${escapeHtml(theme.backgroundColor || settings.appearance.backgroundColor)}" ${theme.inherit ? 'disabled' : ''}></label><label><span>卡片底色</span><input type="color" data-view-theme-field="cardColor" value="${escapeHtml(theme.cardColor || settings.appearance.cardColor)}" ${theme.inherit ? 'disabled' : ''}></label><div class="tf-view-wallpaper-preview">${preview || '<span>没有独立壁纸</span>'}</div><label class="is-wide"><span>壁纸图床直链</span><input data-view-theme-field="wallpaperUrl" value="${escapeHtml(theme.wallpaperKey ? '' : theme.wallpaperUrl)}" placeholder="https://example.com/background.jpg" ${theme.inherit ? 'disabled' : ''}></label><div class="tf-image-source-row"><button class="tf-secondary-button" data-action="upload-view-wallpaper" data-view-id="${escapeHtml(id)}" ${theme.inherit ? 'disabled' : ''}>导入本地壁纸</button><button class="tf-danger-text" data-action="clear-view-wallpaper" data-view-id="${escapeHtml(id)}" ${theme.inherit ? 'disabled' : ''}>清除</button></div><label class="is-wide"><span>本窗口 CSS</span><textarea rows="6" data-view-theme-field="customCss" placeholder="#tavern-forum-root .tf-app[data-tf-view='${escapeHtml(id)}'] { ... }" ${theme.inherit ? 'disabled' : ''}>${escapeHtml(theme.customCss)}</textarea></label></div></details>`; }).join('')}</div></section>`;
}

function renderAppearanceSettings() {
    const settings = getSettings();
    const appearance = settings.appearance;
    const ui = settings.ui;
    const brandImage = renderStoredImage({ url: appearance.brandIconUrl, imageKey: appearance.brandIconKey, alt: '论坛名称图标' });
    const wallpaper = renderStoredImage({ url: appearance.wallpaperUrl, imageKey: appearance.wallpaperKey, alt: '论坛壁纸' });
    const launcherImage = renderStoredImage({ url: ui.floatingButtonImageUrl, imageKey: ui.floatingButtonImageKey, alt: '悬浮入口图片' });
    const visualSection = `<section class="tf-card tf-settings-card tf-visual-assets-settings"><header><div><h3>图标、壁纸与帖子毛玻璃</h3><p>透明度只作用于帖子和评论承载区；文字、头像、图标与照片始终保持清晰。</p></div></header><div class="tf-visual-assets-grid"><div><b>论坛名称图标</b><div class="tf-brand-icon-preview">${brandImage || '◎'}</div><label><span>图床直链</span><input data-appearance-image-url="brandIcon" value="${escapeHtml(appearance.brandIconKey ? '' : appearance.brandIconUrl)}" placeholder="https://example.com/icon.png"></label><div class="tf-image-source-row"><button class="tf-secondary-button" data-action="upload-brand-icon">导入本地图片</button><button class="tf-danger-text" data-action="clear-brand-icon">恢复默认</button></div></div><div><b>论坛壁纸</b><div class="tf-wallpaper-preview">${wallpaper || '<span>尚未设置壁纸</span>'}</div><label><span>图床直链</span><input data-appearance-image-url="wallpaper" value="${escapeHtml(appearance.wallpaperKey ? '' : appearance.wallpaperUrl)}" placeholder="https://example.com/wallpaper.jpg"></label><div class="tf-image-source-row"><button class="tf-secondary-button" data-action="upload-forum-wallpaper">导入本地图片</button><button class="tf-danger-text" data-action="clear-forum-wallpaper">清除壁纸</button></div></div></div><div class="tf-glass-controls"><label><span>帖子透明度 <output>${Math.round(Number(appearance.postOpacity ?? 0.85) * 100)}%</output></span><input type="range" min="0.2" max="1" step="0.01" value="${Number(appearance.postOpacity ?? 0.85)}" data-appearance-number="postOpacity"></label><label><span>评论透明度 <output>${Math.round(Number(appearance.commentOpacity ?? 0.94) * 100)}%</output></span><input type="range" min="0.2" max="1" step="0.01" value="${Number(appearance.commentOpacity ?? 0.94)}" data-appearance-number="commentOpacity"></label><label><span>帖子模糊强度 <output>${Number(appearance.postBlur ?? 16)}px</output></span><input type="range" min="0" max="40" step="1" value="${Number(appearance.postBlur ?? 16)}" data-appearance-number="postBlur"></label></div></section>`;
    const launcherSection = `<section class="tf-card tf-settings-card tf-launcher-settings"><header><div><h3>悬浮入口</h3><p>可显示或关闭，也可以更换图片。关闭后仍可从酒馆扩展菜单打开论坛。</p></div>${renderSwitch({ checked: ui.floatingButton, action: 'toggle-floating-button', label: '显示悬浮入口' })}</header><div class="tf-launcher-settings-body"><div class="tf-launcher-preview">${launcherImage || icon('message')}</div><div><label><span>图片图床直链</span><input data-floating-button-image-url value="${escapeHtml(ui.floatingButtonImageKey ? '' : ui.floatingButtonImageUrl)}" placeholder="https://example.com/forum-icon.png"></label><div class="tf-image-source-row"><button class="tf-secondary-button" data-action="upload-floating-button-image">导入本地图片</button><button class="tf-danger-text" data-action="clear-floating-button-image">恢复默认图标</button><button class="tf-secondary-button" data-action="reset-floating-button-position">恢复默认位置</button></div><small>关闭设置页后，可直接拖动页面上的悬浮入口改变位置；手机端也支持触摸拖动。</small></div></div></section>`;
    const page = renderAppearanceSettingsLegacy(visualSection);
    const end = page.lastIndexOf('</section>');
    const additions = `${renderWindowThemeSettings(settings)}${launcherSection}`;
    return end === -1 ? `${page}${additions}` : `${page.slice(0, end)}${additions}${page.slice(end)}`;
}

function renderRuntimeBackend(data) {
    const logs = [...(data.generationLogs || [])].reverse();
    return `<section class="tf-section-page tf-runtime-page"><header><div><h2>运行后台</h2><p>查看论坛生成的原始输出、模型推理字段与真正的失败详情；这里的内容不会进入正文注入。</p></div><button class="tf-danger-text" data-action="clear-generation-logs" ${logs.length || data.lastGenerationTrace ? '' : 'disabled'}>清空记录</button></header><section class="tf-runtime-summary tf-card"><span><b>${logs.length}</b>最近记录</span><span><b>${logs.filter(log => log.status === 'success').length}</b>成功</span><span><b>${logs.filter(log => log.status === 'error').length}</b>失败</span><small>本地格式整理属于成功；最多保存 20 条，每次论坛生成最多调用一次文本 API。</small></section><div class="tf-runtime-list">${logs.length ? logs.map(log => `<details class="tf-runtime-entry tf-card is-${escapeHtml(log.status)}"><summary><i></i><div><b>${log.status === 'success' ? '成功' : '失败'}${log.locallyRepaired ? ' · 已本地整理' : ''}</b><span>${escapeHtml(new Date(log.createdAt).toLocaleString('zh-CN'))} · ${escapeHtml(log.provider)} / ${escapeHtml(log.model)}</span></div><em>${log.automatic ? '自动更新' : '手动生成'}${log.postCount ? ` · ${log.postCount} 篇` : ''}</em>${icon('chevron')}</summary><div class="tf-runtime-detail">${log.error ? `<section class="is-error"><h3>失败详情</h3><pre>${escapeHtml(log.error)}</pre></section>` : ''}${log.reasoning ? `<details><summary>模型返回的推理记录</summary><pre>${escapeHtml(log.reasoning)}</pre></details>` : ''}${log.output ? `<details><summary>模型原始输出</summary><pre>${escapeHtml(log.output)}</pre></details>` : ''}${!log.error && !log.reasoning && !log.output ? '<p>该次请求没有可显示的文本记录。</p>' : ''}</div></details>`).join('') : data.lastGenerationTrace ? `<details class="tf-runtime-entry tf-card"><summary><i></i><div><b>最近一次旧版记录</b><span>${data.lastGenerationAt ? escapeHtml(new Date(data.lastGenerationAt).toLocaleString('zh-CN')) : '时间未知'}</span></div>${icon('chevron')}</summary><div class="tf-runtime-detail"><section><h3>模型原始记录</h3><pre>${escapeHtml(data.lastGenerationTrace)}</pre></section></div></details>` : '<div class="tf-card tf-empty"><div class="tf-empty-icon">'+icon('database')+'</div><h3>后台还没有记录</h3><p>生成一次论坛动态后，成功记录或真正的失败详情会显示在这里。</p></div>'}</div></section>`;
}

function renderDataSettings() {
    const settings = getSettings();
    return `<section class="tf-section-page"><header><div><h2>数据</h2><p>导入、导出与清理微坛数据。</p></div></header><section class="tf-card tf-settings-card"><header><div><h3>界面入口</h3><p>控制右下角快捷按钮。</p></div>${renderSwitch({ checked: settings.ui.floatingButton, action: 'toggle-floating-button', label: '显示悬浮按钮' })}</header></section><section class="tf-card tf-data-actions"><button class="tf-secondary-button" data-action="export-forum">导出当前论坛 JSON</button><button class="tf-secondary-button" data-action="import-forum">导入论坛 JSON</button><button class="tf-danger-button" data-action="clear-data">清空微坛数据</button></section></section>`;
}

function renderNotificationSettings() {
    const settings = getSettings().notifications;
    return `<section class="tf-section-page"><header><div><h2>通知设置</h2><p>生成成功只在插件内部提示，不再调用酒馆通知。</p></div></header><section class="tf-card tf-settings-card"><header><div><h3>接收的消息类型</h3><p>关闭后只是不再产生该类新通知，不会删除旧通知。</p></div></header><div class="tf-notification-settings"><div>${renderSwitch({ checked: settings.reply, action: 'toggle-notification-reply', label: '别人回复了我的评论' })}</div><div>${renderSwitch({ checked: settings.mention, action: 'toggle-notification-mention', label: '@提及了我' })}</div><div>${renderSwitch({ checked: settings.like, action: 'toggle-notification-like', label: '赞了我的内容' })}</div><div>${renderSwitch({ checked: settings.follow, action: 'toggle-notification-follow', label: '有人关注了我' })}</div><div>${renderSwitch({ checked: settings.mutual, action: 'toggle-notification-mutual', label: '成为互相关注' })}</div><div>${renderSwitch({ checked: settings.tasks, action: 'toggle-notification-tasks', label: '任务与委托' })}</div><div>${renderSwitch({ checked: settings.companion, action: 'toggle-notification-companion', label: '旅伴归来与寄信' })}</div><div>${renderSwitch({ checked: settings.health, action: 'toggle-notification-health', label: '角色状态变化' })}</div><div>${renderSwitch({ checked: settings.moderation, action: 'toggle-notification-moderation', label: '举报与裁决' })}</div><div>${renderSwitch({ checked: settings.system, action: 'toggle-notification-system', label: '插件内部状态' })}</div></div></section></section>`;
}

function renderAutomationSettings() {
    const settings = getSettings();
    const quiet = settings.automation.quietHours;
    const proactive = settings.social.proactiveDms;
    const forbidden = settings.automation.forbiddenEvents;
    const ban = (field, label, description) => `<div>${renderSwitch({ checked: forbidden[field], action: `toggle-forbidden-${field}`, label })}<small>${description}</small></div>`;
    return `<section class="tf-section-page"><header><div><h2>自动化与剧情安全</h2><p>这些限制在本地判断；禁区不会在发生前询问，而是直接让对应事件概率为零。</p></div></header>
        <section class="tf-card tf-settings-card"><header><div><h3>主动私信</h3><p>开启后，角色可随论坛刷新自然地发来私信；不会额外调用第二次 API。</p></div>${renderSwitch({ checked: proactive.enabled, action: 'toggle-proactive-dms', label: '允许角色主动私信' })}</header><div class="tf-form-grid"><div>${renderSwitch({ checked: proactive.withForumRefresh, action: 'toggle-proactive-with-forum', label: '跟随每次论坛刷新' })}</div><div>${renderSwitch({ checked: proactive.withAutomaticRefresh, action: 'toggle-proactive-with-auto', label: '跟随正文自动刷新' })}</div><div>${renderSwitch({ checked: proactive.requireFollow, action: 'toggle-proactive-require-follow', label: '仅允许已关注我的角色' })}</div><label><span>每轮最多主动私信</span><input type="number" min="0" max="8" data-setting="social.proactiveDms.maxPerRun" value="${Number(proactive.maxPerRun)}"></label></div></section>
        <section class="tf-card tf-settings-card"><header><div><h3>安静时段</h3><p>手动刷新和你主动点击的 AI 回复不受影响。</p></div>${renderSwitch({ checked: quiet.enabled, action: 'toggle-quiet-hours', label: '启用安静时段' })}</header><div class="tf-form-grid"><label><span>开始</span><input type="time" data-setting="automation.quietHours.start" value="${escapeHtml(quiet.start)}"></label><label><span>结束</span><input type="time" data-setting="automation.quietHours.end" value="${escapeHtml(quiet.end)}"></label><label><span>安静方式</span><select data-setting="automation.quietHours.behavior"><option value="postpone" ${quiet.behavior === 'postpone' ? 'selected' : ''}>顺延主动生成，不调用 API</option><option value="mute" ${quiet.behavior === 'mute' ? 'selected' : ''}>仍生成，只静默保存通知</option></select></label></div></section>
        <section class="tf-card tf-settings-card"><header><div><h3>剧情强度</h3><p>限制连续出现重病、破产、骗局等高强度事件。</p></div></header><div class="tf-form-grid"><label><span>整体强度</span><select data-setting="automation.narrativeIntensity"><option value="gentle" ${settings.automation.narrativeIntensity === 'gentle' ? 'selected' : ''}>温和</option><option value="balanced" ${settings.automation.narrativeIntensity === 'balanced' ? 'selected' : ''}>平衡</option><option value="dramatic" ${settings.automation.narrativeIntensity === 'dramatic' ? 'selected' : ''}>戏剧化</option><option value="custom" ${settings.automation.narrativeIntensity === 'custom' ? 'selected' : ''}>自定义</option></select></label><label><span>每 10 轮最多重大事件</span><input type="number" min="0" max="10" data-setting="automation.maxSevereEventsPerTenRuns" value="${Number(settings.automation.maxSevereEventsPerTenRuns)}"></label><label><span>同类重大事件冷却（小时）</span><input type="number" min="0" max="720" data-setting="automation.severeCooldownHours" value="${Number(settings.automation.severeCooldownHours)}"></label></div><div class="tf-notification-settings tf-story-bans">${ban('permanentDeath', '禁止永久死亡', '开启后，模型输出中的死亡事件会在本地被丢弃。')}${ban('irreversibleInjury', '禁止不可逆伤残', '允许可恢复的小伤，不允许永久伤残。')}${ban('severeIllness', '禁止重病', '轻微不适与恢复事件仍可出现。')}${ban('bankruptcy', '禁止破产或无家可归', '普通经济波动仍可出现。')}${ban('scam', '禁止骗局', '神秘任务仍可出现，但不会是诈骗。')}${ban('permanentTaskFailure', '禁止永久任务失败', '失败必须保留补救或重新尝试的可能。')}</div></section>
    </section>`;
}

const SETTINGS_SEARCH_INDEX = [
    ['私信 主动私信 陌生人 角色之间', 'privacyRelations', '隐私与关系', '我 → 隐私与关系'],
    ['私信 主动私信 安静时段 概率 剧情 禁区 死亡 重病 骗局', 'automation', '自动化与剧情安全', '我 → 自动化与安全'],
    ['私信 通知 回复 关注 任务 旅伴 举报', 'notifications', '通知设置', '我 → 通知设置'],
        ['世界书 预设 正文 user char 注入 token', 'sources', '正文联动', '设置中心 → 正文联动'],
    ['世界书 信息边界 知道 秘密', 'boundaries', '信息边界', '我 → 信息边界'],
    ['提示词 role 系统 用户 助手 论坛设定', 'prompts', '论坛设定', '我 → 论坛设定'],
    ['内置提示词 私信 任务 运势 旅伴 健康', 'builtinPrompts', '内置提示词', '我 → 内置提示词'],
        ['api 参数 模型 生图', 'api', 'API', '我 → API'],
    ['任务 运势 旅伴 背包 健康 联动 本地随机', 'modules', '世界功能', '我 → 世界功能'],
    ['字体 颜色 css 壁纸 透明 毛玻璃', 'appearance', '外观', '我 → 外观'],
];

function renderSettingsSearch() {
    const query = viewState.settingsSearch.trim().toLocaleLowerCase();
    const results = SETTINGS_SEARCH_INDEX.filter(([keywords, , title, path]) => `${keywords} ${title} ${path}`.toLocaleLowerCase().includes(query));
    return `<section class="tf-section-page tf-settings-search-page"><header><div><h2>设置搜索</h2><p>“${escapeHtml(viewState.settingsSearch)}”的相关配置</p></div><button class="tf-secondary-button" data-action="clear-settings-search">清除搜索</button></header><div>${results.length ? results.map(([, section, title, path]) => `<button class="tf-card" data-action="settings-search-result" data-section="${section}"><b>${escapeHtml(title)}</b><span>${escapeHtml(path)}</span>${icon('chevron')}</button>`).join('') : '<div class="tf-card tf-empty"><h3>没有找到相关设置</h3></div>'}</div></section>`;
}

function renderBoundarySettings(data) {
    const settings = getSettings();
    const boundary = settings.informationBoundary;
    const visibilityOptions = selected => [['public', '公开：所有角色可知'], ['restricted', '指定角色可知'], ['private', '仅私信可使用'], ['forbidden', '任何生成都不可读']].map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
    const roleChecks = fact => `<div class="tf-boundary-roles">${data.npcs.map(npc => `<label><input type="checkbox" data-fact-known-role="${escapeHtml(fact.id)}" data-role-id="${escapeHtml(npc.id)}" ${(fact.knownBy || []).includes(npc.id) ? 'checked' : ''}>${escapeHtml(npc.name)}</label>`).join('') || '<small>暂无角色</small>'}</div>`;
    const activeWorldBooks = viewState.worldCatalog.filter(book => book.enabled && book.entries.some(entry => entry.selected));
    const world = activeWorldBooks.length ? `<div class="tf-world-boundaries">${activeWorldBooks.map(book => `<details><summary><span>${escapeHtml(book.name)}${book.characterBound ? ' · 角色绑定' : ' · 手动添加'}</span><small>${book.entries.filter(entry => entry.selected).length} 条正在读取</small></summary>${book.entries.filter(entry => entry.selected).map(entry => {
        const policy = boundary.worldInfoEntries[entry.key] || { visibility: 'public', knownBy: [] };
        return `<div class="tf-world-boundary-row"><div><b>${escapeHtml(entry.title)}</b><small>${escapeHtml(entry.content.slice(0, 80))}</small></div><select data-world-boundary="${escapeHtml(entry.key)}">${visibilityOptions(policy.visibility)}</select><input data-world-boundary-roles="${escapeHtml(entry.key)}" value="${escapeHtml((policy.knownBy || []).map(id => data.npcs.find(npc => npc.id === id)?.handle || id).join(', '))}" placeholder="指定角色账号，逗号分隔"></div>`;
        }).join('')}</details>`).join('')}</div>` : '<p class="tf-empty-mini">当前没有正在读取的世界书条目。请先在“正文联动”里打开角色绑定或手动添加的世界书。</p>';
    return `<section class="tf-section-page"><header><div><h2>信息边界</h2><p>控制每条事实由谁知道；角色之间私信默认关闭且永不注入公共正文。</p></div><button class="tf-secondary-button" data-action="refresh-world-info">刷新正在读取的条目</button></header><section class="tf-card tf-settings-card"><header><div><h3>总开关</h3><p>关闭信息边界只建议用于测试。</p></div></header><div class="tf-notification-settings"><div>${renderSwitch({ checked: boundary.enabled, action: 'toggle-information-boundary', label: '启用角色知识隔离' })}<small>公开生成只读取公开事实；私信按参与者过滤。</small></div><div>${renderSwitch({ checked: settings.social.roleDirectMessages, action: 'toggle-role-direct-messages', label: '允许角色之间私信' })}<small>开启后，用户可创建 A ↔ B 私密会话并决定下一位发言者。</small></div></div></section><section class="tf-card tf-settings-card"><header><div><h3>事实库</h3><p>把容易泄露的秘密或认知差异拆成单独事实。</p></div></header><div class="tf-boundary-add"><input id="tf-new-fact" placeholder="例如：A 已经知道钥匙藏在书房"><select id="tf-new-fact-visibility">${visibilityOptions('restricted')}</select><button class="tf-primary-button" data-action="add-fact">新增事实</button></div><div class="tf-fact-list">${data.facts.length ? data.facts.map(fact => `<article class="tf-fact" data-fact-id="${escapeHtml(fact.id)}"><textarea data-fact-content rows="2">${escapeHtml(fact.content)}</textarea><div><select data-fact-visibility>${visibilityOptions(fact.visibility)}</select>${renderSwitch({ checked: fact.publishable, action: 'toggle-fact-publishable', label: '允许公开发布' })}<button class="tf-icon-button" data-action="delete-fact" data-fact-id="${escapeHtml(fact.id)}">${icon('trash')}</button></div>${['restricted', 'private'].includes(fact.visibility) ? roleChecks(fact) : ''}</article>`).join('') : '<p class="tf-empty-mini">还没有手动事实。公开正文仍按原有读取开关工作。</p>'}</div></section><section class="tf-card tf-settings-card"><header><div><h3>正在读取的世界书知识边界</h3><p>只显示角色绑定或你手动添加、且条目开关已打开的世界书。</p></div></header>${world}</section></section>`;
}

function renderMe(data) {
    const section = getSettings().ui.meSection || 'overview';
    const pages = { overview: () => renderMeOverview(data), profileEdit: renderProfileEditor, backpack: () => renderInventoryApp(data), favorites: () => renderFavorites(data), memory: () => renderRoleMemoryPage(data), privacyRelations: () => renderPrivacyRelations(data) };
    return `<div class="tf-profile-page-shell">${(pages[section] || pages.overview)()}</div>`;
}

function renderSettings(data) {
    const section = getSettings().ui.meSection || 'modules';
    const pages = {
        npcs: () => renderNpcs(data),
        modules: () => renderWorldModules(data), moderation: () => renderModeration(data), automation: renderAutomationSettings,
        prompts: renderPrompts, builtinPrompts: renderBuiltinPrompts, api: renderApiSettings, sources: renderSourcesSettings,
        boundaries: () => renderBoundarySettings(data), appearance: renderAppearanceSettings, notifications: renderNotificationSettings, runtime: () => renderRuntimeBackend(data), data: renderDataSettings,
    };
    return `<div class="tf-me-page tf-settings-page">${renderMeNav()}<div class="tf-me-content ${viewState.settingsHighlight === section ? 'is-search-highlighted' : ''}">${viewState.settingsSearch.trim() ? renderSettingsSearch() : (pages[section] || pages.modules)()}</div></div>`;
}

function renderMain(data) {
    if (viewState.selectedPostId) return renderPostDetail(data, data.posts.find(post => post.id === viewState.selectedPostId));
    if (viewState.publicNpcId) {
        const npc = data.npcs.find(item => item.id === viewState.publicNpcId);
        if (npc) return renderPublicNpcProfile(data, npc);
        viewState.publicNpcId = '';
    }
    const tab = getSettings().ui.activeTab;
    if (tab === 'services' && viewState.worldPage) return renderWorldFeaturePage(data, viewState.worldPage);
    if (tab === 'services') return renderServicesHub(data);
    if (tab === 'messages') return renderMessages(data);
    if (tab === 'me') return renderMe(data);
    if (tab === 'settings') return renderSettings(data);
    return renderHome(data);
}

function renderMainNav() {
    const tab = getSettings().ui.activeTab;
    const unread = visibleNotifications(getForumData()).filter(item => !item.read).length;
    return `<nav class="tf-main-nav"><button class="${tab === 'home' ? 'is-active' : ''}" data-action="switch-tab" data-tab="home">${icon('home')}<span>首页</span></button><button class="${tab === 'services' ? 'is-active' : ''}" data-action="switch-tab" data-tab="services">${icon('sparkles')}<span>世界</span></button><button class="${tab === 'messages' ? 'is-active' : ''}" data-action="switch-tab" data-tab="messages">${icon('message')}<span>消息</span>${unread ? `<i class="tf-nav-badge">${unread > 99 ? '99+' : unread}</i>` : ''}</button><button class="${tab === 'me' ? 'is-active' : ''}" data-action="switch-tab" data-tab="me">${icon('user')}<span>我</span></button></nav>`;
}

function renderShellLegacy() {
    const settings = getSettings();
    const data = getForumData();
    if (hasActiveChat()) {
        const before = data.npcs.length;
        ensureCharacterRole(data, getChatSnapshot());
        if (data.npcs.length !== before) void saveForumData(data, true);
    }
    const tab = settings.ui.activeTab;
    const searchPlaceholder = tab === 'messages' ? '搜索联系人' : tab === 'settings' ? '搜索设置，例如“私信”' : tab === 'services' ? '搜索世界功能' : '搜索帖子、用户或话题';
    const searchValue = tab === 'settings' ? viewState.settingsSearch : viewState.searchQuery;
    return `<div class="tf-backdrop" data-action="close"></div><section class="tf-app" data-tf-version="5"><header class="tf-topbar"><button class="tf-brand" data-action="switch-tab" data-tab="home"><span class="tf-brand-mark">◎</span><b class="tf-brand-name">${escapeHtml(settings.appearance.forumName)}</b></button><label class="tf-search"><span>${icon('search')}</span><input class="tf-search-input" value="${escapeHtml(searchValue)}" placeholder="${searchPlaceholder}"></label>${renderMainNav()}<div class="tf-top-actions"><button class="tf-injection-dot ${settings.injection.enabled ? 'is-on' : ''}" data-action="go-injection-settings" title="${settings.injection.enabled ? '注入已开启' : '注入未开启'}" aria-label="注入状态"></button><button class="tf-icon-button tf-settings-entry" data-action="open-settings" data-section="modules" title="设置" aria-label="打开设置">${icon('settings')}</button><button class="tf-close" data-action="close" title="关闭">${icon('close')}</button></div></header><main class="tf-view">${renderMain(data)}</main><div class="tf-mobile-main-nav">${renderMainNav()}</div><input id="tf-import-prompts-file" type="file" accept="application/json,.json" hidden><input id="tf-import-forum-file" type="file" accept="application/json,.json" hidden><input id="tf-import-css-file" type="file" accept="text/css,.css" hidden><input id="tf-import-profile-avatar-file" type="file" accept="image/*" hidden><input id="tf-import-profile-background-file" type="file" accept="image/*" hidden><input id="tf-import-avatar-library-file" type="file" accept="image/*" hidden><input id="tf-import-npc-avatar-file" type="file" accept="image/*" hidden></section>`;
}

function getActiveAppearanceScope() {
    if (viewState.selectedPostId || viewState.publicNpcId || viewState.selectedNpcId) return 'profile';
    const settings = getSettings();
    if (settings.ui.activeTab === 'messages') return 'messages';
    if (settings.ui.activeTab === 'services') return 'modules';
    if (settings.ui.activeTab === 'settings') return settings.ui.meSection === 'moderation' ? 'moderation' : 'modules';
    if (settings.ui.activeTab === 'home') return 'home';
    if (settings.ui.meSection === 'modules') return 'modules';
    if (settings.ui.meSection === 'moderation') return 'moderation';
    return 'me';
}

function getActiveAppearanceTheme() {
    const settings = getSettings();
    const scope = getActiveAppearanceScope();
    const view = settings.appearance.viewThemes?.[scope];
    return { scope, view, inherited: !view || view.inherit !== false };
}

function renderShell() {
    const settings = getSettings();
    const theme = getActiveAppearanceTheme();
    const brandImage = renderStoredImage({ url: settings.appearance.brandIconUrl, imageKey: settings.appearance.brandIconKey, alt: `${settings.appearance.forumName} 图标`, className: 'tf-brand-icon-image' });
    const wallpaperSource = theme.inherited ? settings.appearance : theme.view;
    const wallpaper = renderStoredImage({ url: wallpaperSource.wallpaperUrl, imageKey: wallpaperSource.wallpaperKey, alt: `${theme.scope} 窗口壁纸`, className: 'tf-wallpaper-image' });
    let shell = renderShellLegacy()
        .replace('data-tf-version="5"', 'data-tf-version="7"')
        .replace('class="tf-app"', `class="tf-app" data-tf-view="${escapeHtml(theme.scope)}"`)
        .replace(/<span class="tf-brand-mark">.*?<\/span>/, `<span class="tf-brand-mark"><i class="tf-brand-fallback" aria-hidden="true">◎</i>${brandImage}</span>`)
        .replace(/(<section class="tf-app"[^>]*>)/, `$1<div class="tf-wallpaper">${wallpaper}</div>`);
    const closing = shell.lastIndexOf('</section>');
    if (closing !== -1) shell = `${shell.slice(0, closing)}<div class="tf-in-app-toasts" aria-live="polite"></div>${shell.slice(closing)}`;
    return wallpaper ? shell.replace('class="tf-app"', 'class="tf-app has-wallpaper"') : shell;
}

function colorWithOpacity(color, opacity) {
    const value = String(color || '').trim();
    const match = /^#([\da-f]{6})$/i.exec(value);
    if (!match) return value;
    const integer = Number.parseInt(match[1], 16);
    const alpha = Math.min(1, Math.max(0.15, Number(opacity) || 0.92));
    return `rgb(${(integer >> 16) & 255} ${(integer >> 8) & 255} ${integer & 255} / ${alpha})`;
}

function applyAppearance() {
    const settings = getSettings();
    const theme = getActiveAppearanceTheme();
    const backgroundColor = theme.inherited || !theme.view.backgroundColor ? settings.appearance.backgroundColor : theme.view.backgroundColor;
    const cardColor = theme.inherited || !theme.view.cardColor ? settings.appearance.cardColor : theme.view.cardColor;
    const root = getRoot();
    if (root) {
        root.style.setProperty('--tf-primary', settings.appearance.primaryColor);
        root.style.setProperty('--tf-bg', backgroundColor);
        root.style.setProperty('--tf-card', cardColor);
        root.style.setProperty('--tf-text', settings.appearance.textColor);
        root.style.setProperty('--tf-font', settings.appearance.fontFamily ? settings.appearance.fontFamily : 'inherit');
        root.style.setProperty('--tf-top-nav-bg', settings.appearance.topNavColor);
        root.style.setProperty('--tf-side-nav-bg', settings.appearance.sideNavColor);
        root.style.setProperty('--tf-nav-active-bg', settings.appearance.activeNavColor);
        root.style.setProperty('--tf-nav-border', settings.appearance.navDividerColor);
        root.style.setProperty('--tf-post-bg', colorWithOpacity(settings.appearance.postColor, settings.appearance.postOpacity));
        root.style.setProperty('--tf-comment-bg', colorWithOpacity(settings.appearance.commentColor, settings.appearance.commentOpacity));
        root.style.setProperty('--tf-post-solid', settings.appearance.postColor);
        root.style.setProperty('--tf-comment-solid', settings.appearance.commentColor);
        root.style.setProperty('--tf-post-blur', `${Math.min(40, Math.max(0, Number(settings.appearance.postBlur) || 0))}px`);
    }
    let custom = document.getElementById(CUSTOM_STYLE_ID);
    if (!custom) {
        custom = document.createElement('style');
        custom.id = CUSTOM_STYLE_ID;
        document.head.append(custom);
    }
    const baseCss = getEffectiveCustomCss(settings.appearance);
    const viewCss = theme.inherited ? '' : String(theme.view.customCss || '');
    custom.textContent = `${baseCss}\n${viewCss}`;
}

function applySearchFilter() {
    const query = viewState.searchQuery.trim().toLocaleLowerCase();
    const tab = getSettings().ui.activeTab;
    const selector = tab === 'messages' ? '[data-contact-search]' : '[data-search-text]';
    let visible = 0;
    getRoot()?.querySelectorAll(selector).forEach(element => {
        const text = tab === 'messages' ? element.dataset.contactSearch : element.dataset.searchText;
        const matches = !query || String(text || '').includes(query);
        element.toggleAttribute('hidden', !matches);
        if (matches) visible += 1;
    });
    const label = getRoot()?.querySelector('[data-search-count]');
    if (label) label.textContent = String(visible);
}

function getRenderScrollKey() {
    const settings = getSettings();
    const tab = settings.ui.activeTab;
    if (viewState.selectedPostId) return `${tab}:post:${viewState.selectedPostId}`;
    if (viewState.publicNpcId) return `${tab}:public:${viewState.publicNpcId}`;
    if (viewState.selectedNpcId) return `${tab}:role:${viewState.selectedNpcId}`;
    if (tab === 'services') return `${tab}:${viewState.worldPage || 'hub'}`;
    if (tab === 'messages') return `${tab}:${viewState.messageMode}:${viewState.selectedConversationId || 'list'}:${viewState.mobileDmChat ? 'chat' : 'split'}`;
    if (tab === 'me' || tab === 'settings') return `${tab}:${settings.ui.meSection || 'overview'}`;
    return tab;
}

function wallpaperIdentity(element) {
    const image = element?.querySelector('img');
    if (!image) return '';
    const key = image.dataset.imageKey || '';
    const source = image.getAttribute('src') || '';
    return key ? `key:${key}` : source ? `src:${source}` : '';
}

function sameWallpaper(current, next) {
    const currentIdentity = wallpaperIdentity(current);
    const nextIdentity = wallpaperIdentity(next);
    if (currentIdentity === nextIdentity) return true;
    const currentImage = current?.querySelector('img');
    const nextImage = next?.querySelector('img');
    const currentKey = currentImage?.dataset.imageKey || '';
    const nextKey = nextImage?.dataset.imageKey || '';
    const currentSource = currentImage?.getAttribute('src') || '';
    const nextSource = nextImage?.getAttribute('src') || '';
    return Boolean((currentKey && imageMemory.get(currentKey) === nextSource)
        || (nextKey && imageMemory.get(nextKey) === currentSource));
}

function updateStableShell(root, markup) {
    const template = document.createElement('template');
    template.innerHTML = markup.trim();
    const nextApp = template.content.querySelector('.tf-app');
    const currentApp = root.querySelector('.tf-app');
    if (!nextApp || !currentApp) {
        root.replaceChildren(template.content);
        return false;
    }
    const currentView = currentApp.querySelector('.tf-view');
    const nextView = nextApp.querySelector('.tf-view');
    const currentTopbar = currentApp.querySelector('.tf-topbar');
    const nextTopbar = nextApp.querySelector('.tf-topbar');
    const currentMobileNav = currentApp.querySelector('.tf-mobile-main-nav');
    const nextMobileNav = nextApp.querySelector('.tf-mobile-main-nav');
    if (!currentView || !nextView || !currentTopbar || !nextTopbar || !currentMobileNav || !nextMobileNav) {
        root.replaceChildren(template.content);
        return false;
    }
    const currentWallpaper = currentApp.querySelector('.tf-wallpaper');
    const nextWallpaper = nextApp.querySelector('.tf-wallpaper');
    currentApp.className = nextApp.className;
    currentApp.dataset.tfVersion = nextApp.dataset.tfVersion || '';
    currentApp.dataset.tfView = nextApp.dataset.tfView || '';
    if (currentWallpaper && nextWallpaper && !sameWallpaper(currentWallpaper, nextWallpaper)) currentWallpaper.replaceWith(nextWallpaper);
    else if (currentWallpaper && nextWallpaper) {
        const currentImage = currentWallpaper.querySelector('img');
        const nextImage = nextWallpaper.querySelector('img');
        if (currentImage && nextImage) currentImage.alt = nextImage.alt;
    }
    currentTopbar.replaceWith(nextTopbar);
    currentView.replaceChildren(...nextView.childNodes);
    currentMobileNav.replaceWith(nextMobileNav);
    return true;
}

function render({ preserveScroll = false } = {}) {
    const root = getRoot();
    if (!root) return;
    const previousView = root.querySelector('.tf-view');
    const previousScrollTop = Number(previousView?.scrollTop || 0);
    const previousScrollLeft = Number(previousView?.scrollLeft || 0);
    const previousStories = root.querySelector('.tf-stories');
    if (previousStories) viewState.storiesScrollLeft = Number(previousStories.scrollLeft || 0);
    const previousSettingsNav = root.querySelector('.tf-settings-page .tf-me-nav');
    if (previousSettingsNav) viewState.settingsNavScrollLeft = Number(previousSettingsNav.scrollLeft || 0);
    const nextScrollKey = getRenderScrollKey();
    const previousScrollKey = viewState.renderedScrollKey;
    if (previousView && previousScrollKey) viewState.scrollPositions.set(previousScrollKey, { top: previousScrollTop, left: previousScrollLeft });
    if (previousScrollKey === 'home' && nextScrollKey.startsWith('home:post:')) viewState.homeScrollTop = previousScrollTop;
    const shouldPreserveScroll = preserveScroll || (Boolean(viewState.renderedScrollKey) && viewState.renderedScrollKey === nextScrollKey);
    const savedPosition = viewState.scrollPositions.get(nextScrollKey);
    updateStableShell(root, renderShell());
    viewState.renderedScrollKey = nextScrollKey;
    if (!getSettings().moderation.systemAdminEnabled) root.querySelectorAll('[data-action="ai-review-report"]').forEach(button => { button.disabled = true; button.title = '请先开启系统 AI 管理员'; });
    if (!root.querySelector('#tf-import-npc-background-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-npc-background-file" type="file" accept="image/*" hidden>');
    if (!root.querySelector('#tf-import-floating-button-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-floating-button-file" type="file" accept="image/*" hidden>');
    if (!root.querySelector('#tf-import-brand-icon-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-brand-icon-file" type="file" accept="image/*" hidden>');
    if (!root.querySelector('#tf-import-forum-wallpaper-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-forum-wallpaper-file" type="file" accept="image/*" hidden>');
    if (!root.querySelector('#tf-import-view-wallpaper-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-view-wallpaper-file" type="file" accept="image/*" hidden>');
    if (!root.querySelector('#tf-import-module-file')) root.insertAdjacentHTML('beforeend', '<input id="tf-import-module-file" type="file" accept="application/json,.json" hidden>');
    root.toggleAttribute('hidden', !viewState.open);
    document.body.classList.toggle('tf-modal-open', viewState.open);
    applyAppearance();
    paintInAppToasts();
    applySearchFilter();
    updateLaunchers();
    if (getSettings().ui.activeTab === 'settings' && ['sources', 'modules'].includes(getSettings().ui.meSection)) void refreshInjectionTokenCount();
    void hydrateImages();
    const restoreScroll = () => {
        const view = root.querySelector('.tf-view');
        if (view && viewState.renderedScrollKey === nextScrollKey) {
            const position = shouldPreserveScroll ? { top: previousScrollTop, left: previousScrollLeft } : savedPosition;
            view.scrollTop = Number(position?.top || 0);
            view.scrollLeft = Number(position?.left || 0);
        }
        const stories = root.querySelector('.tf-stories');
        if (stories) stories.scrollLeft = viewState.storiesScrollLeft;
        const settingsNav = root.querySelector('.tf-settings-page .tf-me-nav');
        if (settingsNav) {
            settingsNav.scrollLeft = viewState.settingsNavScrollLeft;
            viewState.settingsNavScrollLeft = Number(settingsNav.scrollLeft || 0);
        }
        const settingsBlock = viewState.pendingSettingsBlock && root.querySelector(`[data-settings-block="${viewState.pendingSettingsBlock}"]`);
        if (settingsBlock && view) {
            const viewBox = view.getBoundingClientRect();
            const blockBox = settingsBlock.getBoundingClientRect();
            view.scrollTop += blockBox.top - viewBox.top - 18;
        }
        const messages = root.querySelector('.tf-dm-messages');
        if (messages && !shouldPreserveScroll) messages.scrollTop = messages.scrollHeight;
    };
    restoreScroll();
    queueMicrotask(() => {
        restoreScroll();
        requestAnimationFrame(() => {
            restoreScroll();
            viewState.pendingSettingsBlock = '';
        });
    });
}

async function refreshInjectionTokenCount() {
    if (viewState.injectionTokens.loading) return;
    viewState.injectionTokens.loading = true;
    try {
        const settings = getSettings();
        const data = getForumData();
        const { forumValue, npcValue, worldValue } = syncInjection();
        const context = globalThis.SillyTavern?.getContext?.();
        const count = async value => {
            if (!value) return 0;
            if (typeof context?.getTokenCountAsync === 'function') return Number(await context.getTokenCountAsync(value) || 0);
            return Math.ceil(Array.from(value).reduce((sum, char) => sum + (/[^\x00-\xff]/.test(char) ? 1 : 0.28), 0));
        };
        const moduleValues = Object.fromEntries(WORLD_MODULE_DEFINITIONS.map(definition => [definition.id, definition.id === 'forum' ? forumValue : buildWorldModuleInjection(data, settings, definition.id)]));
        const [forum, roles, world, total, moduleCounts] = await Promise.all([
            count(forumValue), count(npcValue), count(worldValue), count([forumValue, npcValue, worldValue].filter(Boolean).join('\n')),
            Promise.all(Object.entries(moduleValues).map(async ([id, value]) => [id, await count(value)])),
        ]);
        const modules = Object.fromEntries(moduleCounts);
        viewState.injectionTokens = { total, forum, roles, world, modules, loading: false };
        const root = getRoot();
        root?.querySelector('[data-injection-token-total]')?.replaceChildren(`${numberLabel(total)} Tokens`);
        root?.querySelector('[data-injection-token-parts]')?.replaceChildren(`帖子 ${numberLabel(forum)} · 角色人设 ${numberLabel(roles)} · 世界模块 ${numberLabel(world)}`);
        for (const [id, value] of Object.entries(modules)) root?.querySelector(`[data-module-token="${id}"]`)?.replaceChildren(value ? `当前约 ${numberLabel(value)} Tokens` : '当前没有注入内容');
        const meter = root?.querySelector('.tf-token-meter');
        const budget = Number(getSettings().injection.tokenBudget || 2000);
        meter?.classList.toggle('is-over', total > budget);
        const progress = meter?.querySelector('progress');
        if (progress) { progress.max = budget; progress.value = Math.min(total, budget); }
    } catch (error) {
        viewState.injectionTokens.loading = false;
        console.warn('[微坛] 注入 Token 统计失败', error);
    }
}

async function hydrateImages() {
    const localforage = globalThis.SillyTavern?.libs?.localforage;
    if (!localforage) return;
    for (const image of document.querySelectorAll(`#${ROOT_ID} img[data-image-key], #${FAB_ID} img[data-image-key]`)) {
        const key = image.dataset.imageKey;
        try {
            const value = imageMemory.get(key) || await localforage.getItem(key);
            if (!value) { image.hidden = true; image.closest('.tf-image-loading')?.remove(); continue; }
            imageMemory.set(key, value);
            image.src = value;
            image.closest('.tf-image-loading')?.classList.add('is-loaded');
        } catch (error) {
            console.warn('[微坛] 读取图片失败', error);
        }
    }
}

function setActiveTab(tab) {
    if (!['home', 'services', 'messages', 'me', 'settings'].includes(tab)) tab = 'home';
    const settings = getSettings();
    const currentTab = settings.ui.activeTab;
    const nested = Boolean(viewState.selectedPostId || viewState.publicNpcId || (tab === 'services' && viewState.worldPage)
        || (tab === 'messages' && viewState.mobileDmChat) || (tab === 'me' && settings.ui.meSection !== 'overview'));
    if (tab === currentTab && !nested) {
        const view = getRoot()?.querySelector('.tf-view');
        view?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        viewState.scrollPositions.set(getRenderScrollKey(), { top: 0, left: 0 });
        return;
    }
    settings.ui.activeTab = tab;
    // “我”是一个真正的个人主页入口。设置页可以从主页侧栏继续进入，
    // 但不应因为上次停留位置而让用户误以为个人主页不存在。
    if (tab === 'me') settings.ui.meSection = 'overview';
    if (tab === 'settings' && ['overview', 'profileEdit', 'backpack', 'favorites', 'memory', 'privacyRelations'].includes(settings.ui.meSection)) settings.ui.meSection = 'modules';
    if (tab === 'messages') viewState.mobileDmChat = false;
    viewState.selectedPostId = '';
    viewState.publicNpcId = '';
    viewState.worldPage = '';
    viewState.searchQuery = '';
    if (tab === 'messages') prepareConversations(getForumData());
    saveSettings();
    render();
}

function setMeSection(section) {
    const profileSections = ['overview', 'profileEdit', 'backpack', 'favorites', 'memory', 'privacyRelations'];
    getSettings().ui.activeTab = profileSections.includes(section) ? 'me' : 'settings';
    getSettings().ui.meSection = section;
    viewState.selectedPostId = '';
    viewState.publicNpcId = '';
    if (section === 'prompts') viewState.promptSourceContext = null;
    saveSettings();
    render();
    if (section === 'prompts' || (['sources', 'boundaries'].includes(section) && !viewState.worldCatalog.length)) void refreshWorldCatalog();
}

function findPost(postId) {
    return getForumData().posts.find(post => post.id === postId);
}

async function removePostImages(posts) {
    for (const post of posts || []) {
        const keys = [post.imageKey, ...(post.comments || []).map(comment => comment.imageKey)].filter(Boolean);
        for (const key of keys) {
            await globalThis.SillyTavern?.libs?.localforage?.removeItem(key);
            imageMemory.delete(key);
        }
    }
}

async function enforcePostRetention(data, force = false) {
    const settings = getSettings();
    if (!force && !settings.retention.autoCleanup) return 0;
    const result = prunePosts(data.posts, settings.retention.maxPosts);
    if (!result.removed.length) return 0;
    await removePostImages(result.removed);
    data.posts = result.posts;
    return result.removed.length;
}

async function refreshWorldCatalog(showNotice = false) {
    if (viewState.worldLoading) return;
    viewState.worldLoading = true;
    render({ preserveScroll: true });
    try {
        [viewState.worldCatalog, viewState.promptSourceContext] = await Promise.all([
            getWorldInfoCatalog(),
            getGenerationSourceContext(),
        ]);
        if (showNotice) notify('success', `已读取 ${viewState.worldCatalog.reduce((sum, book) => sum + book.entries.length, 0)} 条世界书条目`);
    } catch (error) {
        notify('error', `世界书读取失败：${error.message}`);
    } finally {
        viewState.worldLoading = false;
        render({ preserveScroll: true });
    }
}

function addMentionNotifications(data, posts) {
    if (!getSettings().notifications.mention) return;
    const myHandle = String(getSettings().profile.handle || 'me').replace(/^@/, '').toLocaleLowerCase();
    for (const post of posts || []) {
        const items = [post, ...(post.comments || [])];
        for (const item of items) {
            if (!extractMentions(item.content).includes(myHandle) || isMyHandle(item.handle)) continue;
            const npc = data.npcs.find(role => role.id === item.npcId);
            if (npc?.muted || npc?.blocked) continue;
            data.notifications.unshift(createNotification({ type: 'mention', actorNpcId: item.npcId, actorName: item.author, postId: post.id, content: `${item.author} 在${item === post ? '帖子' : '评论'}中提及了你：${item.content}` }));
        }
    }
}

function addModuleNotification(data, type, content, options = {}) {
    const preferences = getSettings().notifications;
    if (preferences[type] === false) return null;
    const item = createNotification({ type, category: type, content, ...options });
    if (!canSeeNotification(data, item)) return null;
    data.notifications.unshift(item);
    return item;
}

function addConversationMessage(conversation, content, extra = {}) {
    if (!conversation || !String(content || '').trim()) return null;
    const message = {
        id: createId('dm'), role: 'assistant', senderNpcId: extra.senderNpcId || '', senderName: extra.senderName || conversation.name,
        content: String(content).trim(), private: false, createdAt: Date.now(), ...extra,
    };
    conversation.messages.push(message);
    conversation.unread = Number(conversation.unread || 0) + 1;
    conversation.updatedAt = Date.now();
    return message;
}

function ensureTaskDelivery(data, task, { notifyUser = true } = {}) {
    const { npc, conversation } = ensureTaskIssuerConversation(data, task);
    if (!conversation) return null;
    const exists = conversation.messages.some(message => message.taskId === task.id && message.kind === 'task');
    if (!exists) {
        const identity = task.anonymous ? '匿名频道已建立；对方身份经过隐藏。' : `来自 @${task.issuerHandle || npc?.handle || 'client'} 的实名委托。`;
        const content = `委托邀请：${task.title}\n${identity}\n${task.description}${task.reward ? `\n可能奖励：${task.reward}` : ''}${task.failure ? `\n失败影响：${task.failure}` : ''}`;
        addConversationMessage(conversation, content, { senderNpcId: npc?.id || '', senderName: task.anonymous ? '匿名委托人' : task.issuer, kind: 'task', taskId: task.id });
    }
    if (notifyUser && !data.notifications.some(item => item.moduleId === 'tasks' && item.itemId === task.id)) {
        addModuleNotification(data, 'tasks', `${task.anonymous ? '匿名委托人' : task.issuer} 发来一份委托：${task.title}`, { actorNpcId: npc?.id || '', actorName: task.anonymous ? '匿名委托人' : task.issuer, conversationId: conversation.id, moduleId: 'tasks', itemId: task.id });
    }
    return conversation;
}

function routeWorldUpdatesToApp(data, updates, before = {}) {
    const routed = [];
    for (const task of updates.tasks || []) {
        ensureTaskDelivery(data, task);
        routed.push('委托消息');
    }
    if (updates.companion || (updates.travel || []).length) {
        const conversation = ensureCompanionConversation(data);
        const companion = data.world.companion;
        const newest = (updates.travel || []).at(-1);
        const content = companion.message || newest?.notes || `${companion.name}寄回了一条消息。`;
        addConversationMessage(conversation, content, { kind: 'companion', tripId: newest?.id || '' });
        const returnedItem = newest?.status === 'returned' && newest.souvenir ? `，${newest.souvenir}已进入背包` : '';
        addModuleNotification(data, 'companion', `${companion.name}寄回了新消息${returnedItem}`, { actorName: companion.name, conversationId: conversation.id, moduleId: 'travel', itemId: newest?.id || '' });
        routed.push('旅伴消息');
    }
    for (const item of updates.inventory || []) {
        addModuleNotification(data, 'system', `背包获得：${item.name} ×${item.quantity}`, { actorName: '背包', moduleId: 'inventory', itemId: item.id });
        routed.push('背包提醒');
    }
    for (const item of updates.health || []) {
        const npc = data.npcs.find(role => role.id === item.subjectNpcId || role.name === item.subject);
        addModuleNotification(data, 'health', `${item.subject} 的状态发生变化：${item.name}`, { actorNpcId: npc?.id || '', actorName: item.subject, moduleId: 'health', itemId: item.id });
        routed.push('角色状态提醒');
    }
    if ((updates.moderationActions || []).length || (data.world.reports?.length || 0) > Number(before.reportCount || 0)) {
        const actionReportId = (updates.moderationActions || []).find(action => action.reportId)?.reportId;
        const newestReport = data.world.reports.slice(Number(before.reportCount || 0)).at(-1);
        const reportId = actionReportId || newestReport?.id || '';
        if (addModuleNotification(data, 'moderation', '社区管理有新的举报或裁决需要查看', { actorName: '社区管理', moduleId: 'moderation', itemId: reportId })) routed.push('管理通知');
    }
    return [...new Set(routed)];
}

function routeProactiveDirectMessages(data, events) {
    const settings = getSettings();
    const routed = [];
    for (const event of (events || []).slice(0, settings.social.proactiveDms.maxPerRun)) {
        const key = event.targetHandle.replace(/^@/, '').toLocaleLowerCase();
        const npc = data.npcs.find(item => String(item.handle || '').replace(/^@/, '').toLocaleLowerCase() === key);
        if (!npc || !isRoleLibraryMember(npc) || npc.blocked || (settings.social.proactiveDms.requireFollow && !npc.followsUser)) continue;
        const conversation = npc.systemRole ? ensureCharacterConversation(data, getChatSnapshot()) : ensureNpcConversation(data, npc);
        const message = addConversationMessage(conversation, event.content, { senderNpcId: npc.id, senderName: npc.name, kind: 'proactive' });
        if (!message) continue;
        addModuleNotification(data, 'system', `${npc.name} 发来一条私信`, { actorNpcId: npc.id, actorName: npc.name, conversationId: conversation.id });
        routed.push(npc.name);
    }
    return routed;
}

async function runGeneration({ automatic = false } = {}) {
    if (viewState.busy) return;
    if (!hasActiveChat()) {
        if (!automatic) notify('warning', '请先打开一个角色聊天');
        return;
    }
    const initialSettings = getSettings();
    const initialData = getForumData();
    if (automatic && initialSettings.automation.quietHours.behavior === 'postpone' && isQuietHours(initialSettings)) {
        setModuleDecision(initialData, 'forum', 'quiet-hours', '当前处于安静时段，自动刷新已顺延');
        await saveForumData(initialData, true);
        return;
    }
    viewState.busy = true;
    render();
    let result = null;
    let raw = '';
    let textConfig = null;
    let logEntry = null;
    let generationComplete = false;
    try {
        const settings = getSettings();
        if (!settings.modules.forum.enabled) throw new Error('论坛模块当前已关闭，请先在“我 → 世界模块”中开启');
        const data = getForumData();
        const generationSettings = {
            ...settings,
            modules: Object.fromEntries(Object.entries(settings.modules).map(([id, value]) => [id, { ...value }])),
            social: { ...settings.social, proactiveDms: { ...settings.social.proactiveDms } },
        };
        const linkedIds = [];
        for (const definition of WORLD_MODULE_DEFINITIONS.filter(item => item.id !== 'forum')) {
            const module = settings.modules[definition.id];
            if (!module?.enabled || module.generationMode !== 'linked') continue;
            const decision = evaluateModuleGeneration(settings, data, definition.id, { automatic, applyProbability: true });
            setModuleDecision(data, definition.id, decision.code, decision.message);
            if (decision.allowed) linkedIds.push(definition.id);
            else generationSettings.modules[definition.id].generationMode = 'independent';
        }
        const proactiveSettings = settings.social.proactiveDms;
        const proactiveAllowed = proactiveSettings.enabled
            && proactiveSettings.withForumRefresh
            && settings.orchestration.enabled
            && (!automatic || proactiveSettings.withAutomaticRefresh)
            && (Math.floor(Math.random() * 100) + 1) <= Number(proactiveSettings.probability ?? 35);
        generationSettings.social.proactiveDms.enabled = proactiveAllowed;
        const localUpdates = {};
        const fortuneModule = settings.modules.fortune;
        if (fortuneModule?.enabled && fortuneModule.generationMode === 'local') {
            const decision = evaluateModuleGeneration(settings, data, 'fortune', { automatic });
            if (decision.allowed) {
                const fortune = createLocalFortune(new Date(), `${data.topic}|${getChatSnapshot().characterId}`);
                if (data.world.fortune?.date !== fortune.date || !data.world.fortune?.local) localUpdates.fortune = fortune;
                setModuleDecision(data, 'fortune', 'local', localUpdates.fortune ? '已按世界日期生成本地运势，未调用 API' : '今日本地运势已存在，未重复生成', { generated: Boolean(localUpdates.fortune) });
            } else setModuleDecision(data, 'fortune', decision.code, decision.message);
        }
        const instructionSettings = settings.orchestration.enabled ? generationSettings : {
            ...generationSettings,
            modules: Object.fromEntries(Object.entries(generationSettings.modules || {}).map(([id, value]) => [id, { ...value, generationMode: 'independent', joinGeneration: false }])),
        };
        const linkedWorldInstruction = settings.orchestration.enabled
            ? buildLinkedWorldInstruction({ settings: instructionSettings, data })
            : '';
        const request = buildForumGenerationRequest({ ...getChatSnapshot(), settings, existingPosts: data.posts, sourceContext: await getGenerationSourceContext(), excludedRoles: data.npcs.filter(npc => npc.blocked), linkedWorldInstruction });
        textConfig = getModuleApiConfig('forum', 'text', { orchestrated: settings.orchestration.enabled && Boolean(linkedWorldInstruction) });
        result = await generateForumTextResult(textConfig, request, { captureTrace: true });
        raw = result.text;
        let generated;
        let repairedFormat = false;
        try {
            generated = normalizeGeneratedForum(raw);
        } catch (firstError) {
            try {
                generated = recoverGeneratedForum(raw, Date.now(), [result.reasoning]);
                repairedFormat = true;
                console.info('[微坛] 已在本地整理模型格式并读取完整帖子；没有再次调用 API。', firstError);
            } catch (localError) {
                console.error('[微坛] 模型内容无法在本地恢复。', firstError, localError, raw);
                throw localError;
            }
        }
        const postsMaximum = Math.max(1, Math.min(10, Number(settings.generation.postsMax || 5)));
        const commentsMaximum = Math.max(0, Math.min(8, Number(settings.generation.commentsMax ?? 3)));
        generated.posts = generated.posts.slice(0, postsMaximum);
        const isBlockedAuthor = author => data.npcs.some(npc => npc.blocked && (
            (String(npc.handle || '').replace(/^@/, '').toLocaleLowerCase() === String(author?.handle || '').replace(/^@/, '').toLocaleLowerCase())
            || (String(npc.name || '').trim() && String(npc.name || '').trim() === String(author?.author || author?.name || '').trim())
        ));
        generated.posts = generated.posts.filter(post => !isBlockedAuthor(post));
        for (const post of generated.posts) post.comments = (post.comments || []).filter(comment => !isBlockedAuthor(comment)).slice(0, commentsMaximum);
        if (!generated.posts.length) throw new Error('模型只返回了已拉黑角色的内容，请重新刷新论坛');
        data.topic = generated.topic;
        data.lastGenerationTrace = buildGenerationTrace(raw, result.reasoning);
        data.lastGenerationAt = Date.now();
        advanceSocialEngagement(data.posts);
        connectGeneratedReposts(data.posts, generated.posts);
        data.posts.push(...generated.posts);
        linkNpcAuthors(data, generated.posts);
        let worldApplied = [];
        let routed = [];
        let safetyBlocked = [];
        try {
            const normalizedUpdates = { ...normalizeWorldUpdates(raw), ...localUpdates };
            const filtered = filterWorldUpdatesBySafety(normalizedUpdates, settings, data);
            safetyBlocked = filtered.blocked;
            const before = { reportCount: data.world.reports.length };
            worldApplied = applyWorldUpdates(data, filtered.updates, settings);
            if (filtered.updates.permissionAssignments?.length) saveSettings();
            routed = routeWorldUpdatesToApp(data, filtered.updates, before);
            for (const moduleId of linkedIds) setModuleDecision(data, moduleId, 'generated', '已随论坛刷新联动生成，共用一次 API 请求', { generated: true });
            const proactiveNames = routeProactiveDirectMessages(data, normalizeProactiveDirectMessages(raw));
            if (proactiveNames.length) routed.push(`主动私信 ${proactiveNames.length}`);
            if (safetyBlocked.length) data.world.auditLog.push({ id: createId('audit'), moduleId: 'safety', summary: `已按剧情禁区拦截：${safetyBlocked.join('、')}`, createdAt: Date.now() });
            for (let index = 0; index < Number(filtered.acceptedSevere || 0); index += 1) data.world.auditLog.push({ id: createId('audit'), moduleId: 'severity', summary: '本轮允许了一项重大剧情事件', createdAt: Date.now() });
        }
        catch (worldError) { console.warn('[微坛] 帖子已生成，但联动模块数据无法读取', worldError); }
        setModuleDecision(data, 'forum', 'generated', automatic ? '已跟随酒馆正文自动刷新' : '已由用户手动刷新', { generated: true });
        addMentionNotifications(data, generated.posts);
        const removed = await enforcePostRetention(data);
        logEntry = appendGenerationLog(data, {
            status: 'success',
            locallyRepaired: repairedFormat,
            automatic,
            provider: textConfig.provider,
            model: textConfig.provider === 'sillytavern' ? '酒馆当前模型' : textConfig.model,
            postCount: generated.posts.length,
            reasoning: result.reasoning,
            output: raw,
        });
        await saveForumData(data, true);
        syncInjection();
        if (!(automatic && settings.automation.quietHours.behavior === 'mute' && isQuietHours(settings))) {
            notify('success', `${automatic ? '论坛已自动更新' : `已生成 ${generated.posts.length} 篇动态`}${worldApplied.length ? `，并更新 ${worldApplied.join('、')}` : ''}${routed.length ? `；${[...new Set(routed)].join('、')}已送达` : ''}${safetyBlocked.length ? `；已拦截禁区事件：${safetyBlocked.join('、')}` : ''}${removed ? `，清理 ${removed} 篇旧帖` : ''}`);
        }
        generationComplete = true;
        if (getApiConfig('image').autoGenerate) {
            const target = generated.posts.find(post => post.imagePrompt);
            if (target) await runImageGeneration(target.id, false);
            else {
                const postWithCommentImage = generated.posts.find(post => post.comments?.some(comment => comment.imagePrompt));
                const comment = postWithCommentImage?.comments.find(item => item.imagePrompt);
                if (postWithCommentImage && comment) await runCommentImageGeneration(postWithCommentImage.id, comment.id, false);
            }
        }
    } catch (error) {
        console.error('[微坛] 生成失败', error);
        if (!generationComplete) {
            const data = getForumData();
            setModuleDecision(data, 'forum', 'error', `生成失败：${error?.message || error}`);
            if (logEntry) {
                logEntry.status = 'error';
                logEntry.error = String(error?.stack || error?.message || error || '生成失败').slice(0, 10000);
            } else {
                logEntry = appendGenerationLog(data, {
                    status: 'error',
                    automatic,
                    provider: textConfig?.provider || 'unknown',
                    model: textConfig?.provider === 'sillytavern' ? '酒馆当前模型' : textConfig?.model,
                    reasoning: result?.reasoning,
                    output: raw,
                    error: error?.stack || error?.message || error,
                });
            }
            data.lastGenerationTrace = buildGenerationTrace(raw, result?.reasoning);
            data.lastGenerationAt = Date.now();
            try { await saveForumData(data, true); } catch (saveError) { console.error('[微坛] 无法保存运行后台记录', saveError); }
        }
        notify('error', `${automatic ? '论坛自动更新失败' : '论坛生成失败'}，详情已保存到“我 → 运行后台”`);
    } finally {
        viewState.busy = false;
        render();
    }
}

function appendWorldRequestInstruction(request, instruction) {
    const content = String(instruction || '').trim();
    if (!content) return;
    request.user = `${request.user || ''}\n\n${content}`.trim();
    const messages = Array.isArray(request.messages) ? request.messages : [];
    const userMessage = [...messages].reverse().find(message => message?.role === 'user');
    if (userMessage) userMessage.content = `${userMessage.content || ''}\n\n${content}`.trim();
    else messages.push({ role: 'user', content: request.user });
    request.messages = messages;
}

async function runWorldModuleGeneration(moduleId, { reportId = '', forceApi = false, fortuneChoice = '', startJourney = false } = {}) {
    const settings = getSettings();
    const definition = getModuleDefinition(moduleId);
    if (!definition || moduleId === 'forum' || !settings.modules[moduleId]?.enabled) return;
    if (viewState.moduleBusy.has(moduleId)) return;
    if (!hasActiveChat()) return notify('warning', '请先打开一个角色聊天');
    if (moduleId === 'fortune' && forceApi && !settings.modules.fortune.allowApiDraw) return notify('warning', '请先在运势模块设置中开启“允许 AI 生成抽签结果”');
    if (startJourney && getForumData().world.companion.status === 'away') return notify('info', '旅伴已经在旅行中');
    if (moduleId === 'moderation' && reportId && !settings.moderation.systemAdminEnabled) return notify('warning', '系统 AI 管理员当前未开启');
    if (settings.modules[moduleId].generationMode === 'linked' && !reportId && !forceApi) return notify('info', `${definition.name}正在持续联动；请刷新论坛，仍只调用一次 API`);
    viewState.moduleBusy.add(moduleId);
    render();
    let result = null;
    let config = null;
    const travelTimingRoll = startJourney ? Math.random() : 0;
    try {
        const data = getForumData();
        if (moduleId === 'fortune' && settings.modules.fortune.generationMode === 'local' && !forceApi) {
            const fortune = createLocalFortune(new Date(), `${data.topic}|${getChatSnapshot().characterId}`);
            const changed = data.world.fortune?.date !== fortune.date || !data.world.fortune?.local;
            if (changed) {
                const updates = { fortune };
                applyWorldUpdates(data, updates, settings);
                routeWorldUpdatesToApp(data, updates);
            }
            setModuleDecision(data, 'fortune', 'local', changed ? '已生成今日本地运势，未调用 API' : '今日本地运势已经生成，未调用 API', { generated: changed });
            await saveForumData(data, true);
            syncInjection();
            notify('success', changed ? '今日运势已在本地生成，没有调用 API' : '今日运势没有变化，也没有调用 API');
            return;
        }
        const sourceContext = await getGenerationSourceContext();
        const request = buildWorldModuleRequest({ moduleId, settings, data, sourceContext });
        if (moduleId === 'fortune' && forceApi) appendWorldRequestInstruction(request, `【用户主动 AI 抽签】\n这是用户明确选择并翻开“${fortuneChoice || 'middle'}”位置牌面后发起的一次 AI 解签。请结合当前世界资料生成全新的今日签，但保持影响轻微、可逆，不得强制剧情结果。`);
        if (moduleId === 'travel' && startJourney) {
            const timing = resolveCompanionTravelTiming(settings.modules.travel, () => travelTimingRoll);
            appendWorldRequestInstruction(request, `【用户主动让旅伴出发：只调用这一次 API】\n请一次性规划完整旅程。旅行将持续约 ${formatTravelDuration(timing.durationMinutes)}，请生成 ${timing.messageCount} 条按先后顺序释放的途中消息；每条 messages 使用 progress 表示旅程进度（0.08～0.92）。同时预先生成 departureMessage、returnMessage、完整 notes，以及返家后才揭晓的 souvenir、souvenirDescription、souvenirEffect。journey.status 与 companion.status 必须为 away。不要把纪念品写进 companion.carrying，不要在出发留言或途中消息中提前透露纪念品，不要返回 inventory。本次返回后，插件只用本地时间戳发送消息和结算返家，不会再次调用 API。`);
        }
        if (reportId) {
            const report = data.world.reports.find(item => item.id === reportId);
            const post = report && data.posts.find(item => item.id === report.postId);
            const comment = report?.commentId ? post?.comments?.find(item => item.id === report.commentId) : null;
            if (!report || !post || (report.commentId && !comment)) throw new Error('举报内容已不存在');
            const targetText = comment
                ? `举报目标：评论\n评论ID：${comment.id}\n评论作者：@${comment.handle}\n评论正文：${comment.content}\n所属帖子：${post.id}`
                : `举报目标：帖子\n原帖ID：${post.id}\n作者：@${post.handle}\n正文：${post.content}`;
            appendWorldRequestInstruction(request, `【本次必须审理的举报】\n你是系统 AI 治理程序。举报原因：${report.reason}\n${targetText}\n请严格依据社区规则，只为这份举报返回一条 moderationActions；驳回举报属于非破坏性裁决，会直接生效。处理评论时必须填写 commentId。actorHandle 可以留空。`);
            report.status = 'reviewing';
        }
        config = getModuleApiConfig(moduleId);
        result = await generateForumTextResult(config, request, { captureTrace: true });
        const filtered = filterWorldUpdatesBySafety(normalizeWorldUpdates(result.text), settings, data);
        const updates = filtered.updates;
        if (moduleId === 'fortune' && forceApi && updates.fortune) {
            updates.fortune.choiceId = ['left', 'middle', 'right'].includes(fortuneChoice) ? fortuneChoice : 'middle';
            updates.fortune.local = false;
        }
        if (reportId) {
            const report = data.world.reports.find(item => item.id === reportId);
            const action = updates.moderationActions?.find(item => item.postId === report?.postId && (!report?.commentId || !item.commentId || item.commentId === report.commentId));
            if (action) {
                action.systemAdmin = true;
                action.reportId = reportId;
                action.commentId = report?.commentId || action.commentId || '';
            }
        }
        let preparedJourney = null;
        if (moduleId === 'travel' && startJourney) {
            const journey = updates.travel?.[0];
            if (!journey) throw new Error('旅伴模块没有返回完整旅行计划');
            journey.id = createId('trip');
            journey.status = 'away';
            journey.departureMessage = journey.departureMessage || updates.companion?.message || '';
            updates.travel = [];
            updates.companion = {
                status: 'away',
                destination: journey.destination,
                mood: updates.companion?.mood || data.world.companion.mood,
                message: journey.departureMessage || updates.companion?.message || data.world.companion.message,
            };
            data.world.trips.push(journey);
            preparedJourney = prepareCompanionJourney(data, journey.id, settings.modules.travel, { random: () => travelTimingRoll });
            if (!preparedJourney) throw new Error('无法建立旅伴旅行时间表');
        }
        if (!Object.keys(updates).length) throw new Error(`${definition.name}模块没有返回可读取的数据`);
        const before = { reportCount: data.world.reports.length };
        const applied = applyWorldUpdates(data, updates, settings);
        if (updates.permissionAssignments?.length) saveSettings();
        if (preparedJourney) {
            applied.push(`完整行程 ${preparedJourney.timing.messageCount} 则来信`);
            const conversation = ensureCompanionConversation(data);
            addConversationMessage(conversation, data.world.companion.message, { kind: 'companion', tripId: preparedJourney.trip.id });
            addModuleNotification(data, 'companion', `${data.world.companion.name}已经出发：${preparedJourney.trip.destination}`, { actorName: data.world.companion.name, moduleId: 'travel', itemId: preparedJourney.trip.id, conversationId: conversation.id });
        } else routeWorldUpdatesToApp(data, updates, before);
        setModuleDecision(data, moduleId, 'generated', preparedJourney ? '已用一次 API 预生成完整行程；后续消息与返家均在本地执行' : '已使用本模块独立 API 生成', { generated: true });
        if (filtered.blocked.length) data.world.auditLog.push({ id: createId('audit'), moduleId: 'safety', summary: `已按剧情禁区拦截：${filtered.blocked.join('、')}`, createdAt: Date.now() });
        for (let index = 0; index < Number(filtered.acceptedSevere || 0); index += 1) data.world.auditLog.push({ id: createId('audit'), moduleId: 'severity', summary: '本轮允许了一项重大剧情事件', createdAt: Date.now() });
        if (reportId) {
            const report = data.world.reports.find(item => item.id === reportId);
            const action = updates.moderationActions?.find(item => item.postId === report?.postId && (item.commentId || '') === (report?.commentId || ''));
            if (report && action) {
                report.status = action.action === 'dismiss' ? 'dismissed' : settings.modules.moderation.automation === 'auto' ? 'actioned' : 'reviewing';
                report.decision = action.reason;
                report.action = action.action === 'dismiss' ? 'none' : action.action;
                report.reviewerNpcId = 'system-ai-admin';
                report.updatedAt = Date.now();
            }
        }
        appendGenerationLog(data, {
            status: 'success', automatic: false, provider: config.provider,
            model: config.provider === 'sillytavern' ? '酒馆当前模型' : config.model,
            reasoning: result.reasoning, output: result.text, postCount: 0,
        });
        await saveForumData(data, true);
        syncInjection();
        if (preparedJourney) wakeCompanionJourneyClock();
        if (moduleId === 'fortune' && forceApi) viewState.fortuneAiMode = false;
        notify('success', `${applied.length ? `${definition.name}已更新：${applied.join('、')}` : `${definition.name}已生成，等待你确认操作`}${filtered.blocked.length ? `；已拦截禁区事件：${filtered.blocked.join('、')}` : ''}`);
    } catch (error) {
        const data = getForumData();
        setModuleDecision(data, moduleId, 'error', `生成失败：${error?.message || error}`);
        if (reportId) {
            const report = data.world.reports.find(item => item.id === reportId);
            if (report) report.status = 'pending';
        }
        appendGenerationLog(data, {
            status: 'error', automatic: false, provider: config?.provider || 'unknown',
            model: config?.provider === 'sillytavern' ? '酒馆当前模型' : config?.model,
            reasoning: result?.reasoning, output: result?.text, error: error?.stack || error?.message || error,
        });
        try { await saveForumData(data, true); } catch { /* keep the original error */ }
        notify('error', `${definition.name}生成失败，详情已保存到运行后台`);
    } finally {
        viewState.moduleBusy.delete(moduleId);
        render();
        if (moduleId === 'fortune' && forceApi && getForumData().world.fortune) {
            setTimeout(() => { viewState.fortuneRevealChoice = ''; }, 1400);
        }
    }
}

async function processCompanionJourneyClock({ forceReturn = false } = {}) {
    if (viewState.companionJourneyBusy) return null;
    viewState.companionJourneyBusy = true;
    try {
        const data = getForumData();
        const result = advanceCompanionJourney(data, { forceReturn });
        if (!result.changed) return result;
        const companion = data.world.companion;
        const conversation = ensureCompanionConversation(data);
        if (result.delivered.length) {
            if (result.delivered.length <= 2) {
                for (const message of result.delivered) addConversationMessage(conversation, message.content, { kind: 'companion', tripId: result.trip.id, journeyMessageId: message.id });
            } else {
                const latest = result.delivered.at(-1);
                addConversationMessage(conversation, `回来查看时收到了 ${result.delivered.length} 则途中消息。最新一则：${latest.content}`, { kind: 'companion', tripId: result.trip.id, journeyMessageId: latest.id });
            }
            const latest = result.delivered.at(-1);
            addModuleNotification(data, 'companion', `${companion.name}寄回旅途消息：${latest.content}`, { actorName: companion.name, moduleId: 'travel', itemId: result.trip.id, conversationId: conversation.id });
        }
        if (result.returned) {
            addConversationMessage(conversation, companion.message, { kind: 'companion', tripId: result.trip.id });
            addModuleNotification(data, 'companion', `${companion.name}旅行归来了${result.souvenir ? `，并带回${result.souvenir}` : ''}`, { actorName: companion.name, moduleId: 'travel', itemId: result.trip.id, conversationId: conversation.id });
            setModuleDecision(data, 'travel', 'returned', '预生成行程已按本地时间完成返家与背包结算', { generated: false });
        } else setModuleDecision(data, 'travel', 'local-signal', '已按本地时间释放预生成旅途消息，未调用 API', { generated: false });
        await saveForumData(data, true);
        syncInjection();
        if (viewState.open) render({ preserveScroll: true });
        return result;
    } finally {
        viewState.companionJourneyBusy = false;
    }
}

function startCompanionJourneyClock() {
    if (viewState.companionJourneyTimer) return;
    const tick = async () => {
        viewState.companionJourneyTimer = 0;
        try { await processCompanionJourneyClock(); } catch (error) { console.error('[微坛] 旅伴本地行程时钟更新失败', error); }
        const away = getForumData().world.companion.status === 'away';
        viewState.companionJourneyTimer = window.setTimeout(tick, away ? 5000 : 30000);
    };
    void tick();
}

function wakeCompanionJourneyClock() {
    if (viewState.companionJourneyTimer) window.clearTimeout(viewState.companionJourneyTimer);
    viewState.companionJourneyTimer = 0;
    startCompanionJourneyClock();
}

async function runThreadContinuation(postId, userComment) {
    const post = findPost(postId);
    if (!post || viewState.replyingPosts.has(postId)) return;
    viewState.replyingPosts.add(postId);
    render();
    try {
        const data = getForumData();
        const request = buildThreadReplyRequest({ post, userComment, npcs: data.npcs, sourceContext: await getGenerationSourceContext(), settings: getSettings() });
        const replyMaximum = Math.max(1, Math.min(8, Number(getSettings().generation.repliesMax || 3)));
        const replies = normalizeThreadReplies(await generateForumText(getModuleApiConfig('forum'), request)).filter(reply => !data.npcs.some(npc => npc.blocked && (
            String(npc.handle || '').replace(/^@/, '').toLocaleLowerCase() === String(reply.handle || '').replace(/^@/, '').toLocaleLowerCase()
            || (String(npc.name || '').trim() && String(npc.name || '').trim() === String(reply.author || '').trim())
        ))).slice(0, replyMaximum);
        for (const reply of replies) {
            const targetComment = [...post.comments].reverse().find(comment => String(comment.handle || '').replace(/^@/, '').toLocaleLowerCase() === String(reply.replyTo || '').toLocaleLowerCase());
            reply.parentId = reply.parentId || targetComment?.id || userComment?.id || '';
        }
        post.comments.push(...replies);
        linkNpcAuthors(data, [{ ...post, comments: replies }]);
        if (userComment && getSettings().notifications.reply) {
            for (const reply of replies) {
                data.notifications.unshift(createNotification({
                    type: 'reply',
                    actorNpcId: reply.npcId,
                    actorName: reply.author,
                    postId: post.id,
                    content: `${reply.author} 回复了你的评论：${reply.content}`,
                }));
            }
        }
        addMentionNotifications(data, [{ ...post, comments: replies }]);
        if (getSettings().notifications.like && userComment && replies[0]) {
            userComment.likes = Number(userComment.likes || 0) + 1;
            data.notifications.unshift(createNotification({ type: 'like', actorNpcId: replies[0].npcId, actorName: replies[0].author, postId: post.id, content: `${replies[0].author} 赞了你的评论` }));
        }
        await saveForumData(data, true);
        syncInjection();
    } catch (error) {
        notify('error', userComment ? `你的评论已保存，但 AI 续回复失败：${error.message}` : `角色回帖生成失败：${error.message}`);
    } finally {
        viewState.replyingPosts.delete(postId);
        render();
    }
}

async function runNpcProfileGeneration(npcId) {
    const data = getForumData();
    const npc = data.npcs.find(item => item.id === npcId);
    if (!npc || viewState.npcBusy.has(npcId)) return;
    viewState.npcBusy.add(npcId);
    render();
    try {
        const evidence = collectNpcEvidence(data, npcId);
        if (npc.bindingContent) evidence.push(`绑定资料（${npc.bindingLabel || '已绑定'}）：${npc.bindingContent}`);
        const request = buildNpcProfileRequest({ npc, evidence, sourceContext: await getGenerationSourceContext(), settings: getSettings() });
        applyNpcProfile(npc, normalizeNpcProfile(await generateForumText(getModuleApiConfig('forum'), request)));
        await saveForumData(data, true);
        syncInjection();
        notify('success', `${npc.name} 的主页与人设已生成`);
    } catch (error) {
        notify('error', `角色人设生成失败：${error.message}`);
    } finally {
        viewState.npcBusy.delete(npcId);
        render();
    }
}

async function runImageGeneration(postId, rerender = true) {
    const post = findPost(postId);
    if (!post || viewState.imageBusy.has(postId)) return;
    let promptText = String(post.imagePrompt || '').trim();
    if (promptText && !/[\u3400-\u9fff]/u.test(promptText)) {
        promptText = localizedImagePrompt(post);
        post.imagePrompt = promptText;
    }
    if (!promptText) {
        promptText = window.prompt('请输入配图画面描述：', post.content.slice(0, 200))?.trim() || '';
        if (!promptText) return;
        post.imagePrompt = promptText;
    }
    const config = getApiConfig('image');
    if (!hasUsableImageApi(config)) {
        await saveForumData(getForumData(), true);
        notify(config.textFallback ? 'success' : 'warning', config.textFallback ? '已使用文字配图' : '请先开启生图 API 或文字配图');
        if (rerender) render();
        return;
    }
    viewState.imageBusy.add(postId);
    if (rerender) render();
    try {
        const image = await generateForumImage(config, promptText);
        if (post.imageKey) await globalThis.SillyTavern?.libs?.localforage?.removeItem(post.imageKey);
        if (image.type === 'base64') {
            const key = `tavern-forum:image:${post.id}`;
            if (!globalThis.SillyTavern?.libs?.localforage) throw new Error('当前酒馆不支持本地图片存储');
            await globalThis.SillyTavern.libs.localforage.setItem(key, image.value);
            imageMemory.set(key, image.value);
            post.imageKey = key;
            post.imageUrl = '';
        } else {
            post.imageUrl = image.value;
            post.imageKey = '';
        }
        await saveForumData(getForumData(), true);
    } catch (error) {
        notify('error', error.message || '生图失败');
    } finally {
        viewState.imageBusy.delete(postId);
        if (rerender) render();
    }
}

async function runCommentImageGeneration(postId, commentId, rerender = true) {
    const post = findPost(postId);
    const comment = post?.comments?.find(item => item.id === commentId);
    const busyKey = `comment-${commentId}`;
    if (!comment || viewState.imageBusy.has(busyKey)) return;
    let promptText = String(comment.imagePrompt || '').trim();
    if (promptText && !/[\u3400-\u9fff]/u.test(promptText)) {
        promptText = localizedImagePrompt(comment);
        comment.imagePrompt = promptText;
    }
    if (!promptText) {
        promptText = window.prompt('请输入评论配图画面描述：', comment.content.slice(0, 200))?.trim() || '';
        if (!promptText) return;
        comment.imagePrompt = promptText;
    }
    const config = getApiConfig('image');
    if (!hasUsableImageApi(config)) {
        await saveForumData(getForumData(), true);
        notify(config.textFallback ? 'success' : 'warning', config.textFallback ? '已使用文字配图' : '请先开启生图 API 或文字配图');
        if (rerender) render();
        return;
    }
    viewState.imageBusy.add(busyKey);
    if (rerender) render();
    try {
        const image = await generateForumImage(config, promptText);
        if (comment.imageKey) await globalThis.SillyTavern?.libs?.localforage?.removeItem(comment.imageKey);
        if (image.type === 'base64') {
            const key = `tavern-forum:comment-image:${comment.id}`;
            if (!globalThis.SillyTavern?.libs?.localforage) throw new Error('当前酒馆不支持本地图片存储');
            await globalThis.SillyTavern.libs.localforage.setItem(key, image.value);
            imageMemory.set(key, image.value);
            comment.imageKey = key;
            comment.imageUrl = '';
        } else {
            comment.imageUrl = image.value;
            comment.imageKey = '';
        }
        await saveForumData(getForumData(), true);
    } catch (error) {
        notify('error', error.message || '评论生图失败');
    } finally {
        viewState.imageBusy.delete(busyKey);
        if (rerender) render();
    }
}

function findTaskConversation(data, task) {
    return data.conversations.find(conversation => conversation.messages?.some(message => message.taskId === task.id))
        || data.conversations.find(conversation => conversation.type === 'npc' && conversation.targetId === task.issuerNpcId)
        || null;
}

function addTaskConversationUpdate(data, task, content) {
    const conversation = findTaskConversation(data, task) || ensureTaskDelivery(data, task, { notifyUser: false });
    if (conversation) addConversationMessage(conversation, content, { senderNpcId: task.issuerNpcId, senderName: task.anonymous ? '匿名委托人' : task.issuer, kind: 'task-status', taskId: '' });
}

function settleVerifiedTask(data, task, verification) {
    task.status = 'completed';
    task.verificationStatus = 'verified';
    task.verificationMethod = verification.method;
    task.verificationReason = verification.reason;
    task.evidenceMessageIndex = Number(verification.messageIndex ?? -1);
    task.evidenceExcerpt = String(verification.excerpt || '').slice(0, 500);
    task.verifiedAt = Date.now();
    task.updatedAt = Date.now();
    if (task.reward) {
        const source = `任务奖励 · ${task.id}`;
        if (!data.world.inventory.some(item => item.source === source)) data.world.inventory.push({ id: createId('item'), name: task.reward, description: `完成“${task.title}”并通过正文证据验收后获得的奖励。`, quantity: 1, effect: '按任务描述在合适的情境中使用。', source, usable: true, consumed: false, createdAt: Date.now(), updatedAt: Date.now() });
    }
    const methodLabel = verification.method === 'api' ? '验收 API' : '本地正文核对';
    addTaskConversationUpdate(data, task, `验收通过：已经通过${methodLabel}确认“${task.title}”完成。${task.reward ? `奖励“${task.reward}”已进入背包。` : ''}`);
    addModuleNotification(data, 'tasks', `${task.title}已通过正文验收${task.reward ? `，奖励“${task.reward}”已进入背包` : ''}`, { actorNpcId: task.issuerNpcId, actorName: task.anonymous ? '匿名委托人' : task.issuer, moduleId: 'tasks', itemId: task.id });
}

async function runTaskVerification(taskId) {
    const data = getForumData();
    const task = data.world.tasks.find(item => item.id === taskId);
    if (!task || task.status !== 'accepted' || viewState.taskVerificationBusy.has(task.id)) return;
    const settings = getSettings();
    const snapshot = getChatSnapshot();
    viewState.taskVerificationBusy.add(task.id);
    task.verificationStatus = 'checking';
    task.verificationReason = '';
    render({ preserveScroll: true });
    try {
        const local = findLocalTaskEvidence(task, snapshot.chat);
        if (local.eligible) {
            settleVerifiedTask(data, task, { method: 'local', reason: local.reason, messageIndex: local.messageIndex, excerpt: local.excerpt });
            await saveForumData(data, true);
            syncInjection();
            notify('success', '正文证据已确认，任务完成');
            return;
        }
        if (!settings.modules.tasks.verificationApiEnabled) {
            task.verificationStatus = 'rejected';
            task.verificationMethod = 'local';
            task.verificationReason = local.reason;
            task.updatedAt = Date.now();
            await saveForumData(data, true);
            notify('warning', local.reason);
            return;
        }
        const request = buildTaskVerificationRequest({ task, chat: snapshot.chat, names: snapshot.names });
        const result = normalizeTaskVerification(await generateForumText(getTaskVerificationApiConfig(), request));
        if (result.completed) {
            settleVerifiedTask(data, task, { method: 'api', reason: result.reason, messageIndex: result.evidenceMessageIndex, excerpt: result.evidenceExcerpt });
            notify('success', '验收 API 已确认正文中的完成证据');
        } else {
            task.verificationStatus = 'rejected';
            task.verificationMethod = 'api';
            task.verificationReason = result.reason;
            task.evidenceMessageIndex = result.evidenceMessageIndex;
            task.evidenceExcerpt = result.evidenceExcerpt;
            task.updatedAt = Date.now();
            addTaskConversationUpdate(data, task, `暂未通过验收：${result.reason}`);
            notify('warning', `任务尚未完成：${result.reason}`);
        }
        await saveForumData(data, true);
        syncInjection();
    } catch (error) {
        task.verificationStatus = 'rejected';
        task.verificationReason = `验收失败：${error.message}`;
        task.updatedAt = Date.now();
        await saveForumData(data, true);
        notify('error', `任务验收失败：${error.message}`);
    } finally {
        viewState.taskVerificationBusy.delete(task.id);
        render({ preserveScroll: true });
    }
}

async function sendDirectMessage(conversationId, content) {
    const data = getForumData();
    const conversation = data.conversations.find(item => item.id === conversationId);
    if (!conversation || viewState.dmBusy) return;
    if (!isConversationAllowed(data, conversation)) return notify('warning', '已拉黑的角色不能继续私信');
    const clean = String(content || '').trim();
    if (!clean) return;
    conversation.messages.push({ id: createId('dm'), role: 'user', content: clean, createdAt: Date.now() });
    conversation.updatedAt = Date.now();
    await saveForumData(data, true);
    render();
}

async function runDirectMessageReply(conversationId) {
    const data = getForumData();
    const conversation = data.conversations.find(item => item.id === conversationId);
    if (!conversation || viewState.dmBusy) return;
    if (!isConversationAllowed(data, conversation)) return notify('warning', '已拉黑的角色不能继续私信');
    if (!(conversation.messages || []).length) return notify('warning', '请先发送一条私信，再让角色回复');
    viewState.dmBusy = true;
    render();
    try {
        const baseNpc = conversation.type === 'npc' ? data.npcs.find(item => item.id === conversation.targetId) : null;
        const npc = baseNpc ? { ...baseNpc, persona: [baseNpc.persona, baseNpc.bindingContent].filter(Boolean).join('\n绑定资料：') } : null;
        const charRole = conversation.type === 'char' ? data.npcs.find(item => item.bindingType === 'char' && item.bindingTarget === conversation.targetId) : null;
        const scopedRole = baseNpc || charRole;
        const request = buildDirectMessageRequest({ conversation, messages: conversation.messages, npc, sourceContext: scopedRole ? await getRoleScopedSourceContext(scopedRole.id) : await getGenerationSourceContext(), userName: getChatSnapshot().names.user || 'User', settings: getSettings() });
        const reply = normalizeDirectMessage(await generateForumText(getModuleApiConfig('forum'), request));
        conversation.messages.push({ id: createId('dm'), role: 'assistant', content: reply, createdAt: Date.now() });
        if (scopedRole) {
            const lastUserMessage = [...conversation.messages].reverse().find(message => message.role === 'user')?.content || '';
            scopedRole.memory.privateTalks.push(`与用户私信：用户说“${lastUserMessage}”；${scopedRole.name}回复“${reply}”`);
            scopedRole.memory.privateTalks = scopedRole.memory.privateTalks.slice(-80);
        }
        conversation.updatedAt = Date.now();
        await saveForumData(data, true);
    } catch (error) {
        notify('error', `AI 回复生成失败：${error.message}`);
    } finally {
        viewState.dmBusy = false;
        render();
    }
}

async function runRoleDirectMessage(conversationId, speakerId, direction = '') {
    if (!getSettings().social.roleDirectMessages) return notify('warning', '角色之间私信当前已关闭');
    const data = getForumData();
    const conversation = data.conversations.find(item => item.id === conversationId && item.type === 'role_dm');
    if (!conversation || viewState.dmBusy) return;
    const speaker = data.npcs.find(npc => npc.id === speakerId && conversation.participantIds.includes(npc.id));
    const otherRole = data.npcs.find(npc => conversation.participantIds.includes(npc.id) && npc.id !== speaker?.id);
    if (!speaker || !otherRole || speaker.blocked || otherRole.blocked) return notify('warning', '私信参与者不存在或已被拉黑');
    viewState.dmBusy = true;
    render();
    try {
        const request = buildRoleDirectMessageRequest({ conversation, messages: conversation.messages, speaker, otherRole, sourceContext: await getRoleScopedSourceContext(speaker.id, { channel: 'private', otherRoleId: otherRole.id }), direction, settings: getSettings() });
        const reply = normalizeDirectMessage(await generateForumText(getModuleApiConfig('forum'), request));
        conversation.messages.push({ id: createId('dm'), role: 'assistant', senderNpcId: speaker.id, senderName: speaker.name, content: reply, private: true, createdAt: Date.now() });
        conversation.updatedAt = Date.now();
        const memoryLine = `与${otherRole.name}的私信：${speaker.name}说“${reply}”`;
        for (const npc of [speaker, otherRole]) {
            npc.memory.privateTalks.push(memoryLine);
            npc.memory.privateTalks = npc.memory.privateTalks.slice(-80);
            npc.updatedAt = Date.now();
        }
        await saveForumData(data, true);
    } catch (error) {
        notify('error', `角色私信生成失败：${error.message}`);
    } finally {
        viewState.dmBusy = false;
        render();
    }
}

function downloadJson(filename, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function readFile(input) {
    const file = input.files?.[0];
    input.value = '';
    return file ? file.text() : Promise.resolve(null);
}

async function readImageAsset(input, prefix) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return null;
    if (!String(file.type || '').startsWith('image/')) throw new Error('请选择图片文件');
    if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10MB');
    const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('图片读取失败'));
        reader.readAsDataURL(file);
    });
    const localforage = globalThis.SillyTavern?.libs?.localforage;
    if (!localforage) return { url: dataUrl, imageKey: '', name: file.name };
    const imageKey = `tavern-forum:asset:${prefix}:${createId('image')}`;
    await localforage.setItem(imageKey, dataUrl);
    imageMemory.set(imageKey, dataUrl);
    return { url: '', imageKey, name: file.name };
}

async function removeImageAsset(imageKey) {
    if (!imageKey) return;
    await globalThis.SillyTavern?.libs?.localforage?.removeItem(imageKey);
    imageMemory.delete(imageKey);
}

function updateNpcAvatar(npc, { url = '', imageKey = '', avatarId = '' } = {}) {
    if (!npc) return;
    npc.avatarUrl = url;
    npc.avatarKey = imageKey;
    npc.avatarId = avatarId;
    npc.avatarCustomized = true;
    npc.updatedAt = Date.now();
    for (const conversation of getForumData().conversations.filter(item => item.type === 'npc' && item.targetId === npc.id)) {
        conversation.avatarUrl = url;
        conversation.avatarKey = imageKey;
    }
}

function applyNpcBinding(npc, type, targetId = '') {
    npc.bindingType = ['char', 'world'].includes(type) ? type : 'none';
    npc.bindingTarget = targetId;
    npc.bindingLabel = '';
    npc.bindingContent = '';
    if (npc.bindingType === 'char') {
        const character = getCharacterCatalog().find(item => item.id === targetId);
        if (character) {
            npc.bindingLabel = character.name;
            npc.bindingContent = character.persona;
            if (character.avatarUrl && !npc.avatarCustomized) npc.avatarUrl = character.avatarUrl;
        }
    } else if (npc.bindingType === 'world') {
        for (const book of viewState.worldCatalog) {
            const entry = book.entries.find(item => item.key === targetId);
            if (!entry) continue;
            npc.bindingLabel = `${book.name} · ${entry.title}`;
            npc.bindingContent = entry.content;
            break;
        }
    }
    npc.updatedAt = Date.now();
}

function getSettingByPath(path) {
    return path.split('.').reduce((value, key) => value?.[key], getSettings());
}

function setSettingByPath(path, value) {
    const parts = path.split('.');
    const key = parts.pop();
    const parent = parts.reduce((target, part) => target[part], getSettings());
    parent[key] = value;
    saveSettings();
    if (path.startsWith('injection.')) syncInjection();
}

function handleSwitchAction(action, checked) {
    if (action === 'toggle-linked-private-messages') {
        const proactive = getSettings().social.proactiveDms;
        proactive.enabled = checked;
        proactive.withForumRefresh = checked;
        saveSettings();
        return render({ preserveScroll: true });
    }
    const paths = {
        'toggle-master-injection': 'injection.enabled', 'toggle-include-comments': 'injection.includeComments',
        'toggle-npc-master-injection': 'injection.npcEnabled', 'toggle-source-chat': 'sources.chat',
        'toggle-source-user': 'sources.userPersona', 'toggle-source-character': 'sources.characterPersona',
        'toggle-source-world': 'sources.worldInfo', 'toggle-source-preset': 'sources.sillyTavernPreset', 'toggle-auto-refresh': 'generation.autoRefreshOnMessage',
        'toggle-auto-cleanup': 'retention.autoCleanup',
        'toggle-notification-reply': 'notifications.reply', 'toggle-notification-mention': 'notifications.mention',
        'toggle-notification-like': 'notifications.like', 'toggle-notification-follow': 'notifications.follow',
        'toggle-notification-mutual': 'notifications.mutual', 'toggle-notification-system': 'notifications.system',
        'toggle-notification-tasks': 'notifications.tasks', 'toggle-notification-companion': 'notifications.companion',
        'toggle-notification-health': 'notifications.health', 'toggle-notification-moderation': 'notifications.moderation',
        'toggle-information-boundary': 'informationBoundary.enabled', 'toggle-role-direct-messages': 'social.roleDirectMessages',
        'toggle-role-follow-before-dm': 'social.requireRoleFollowBeforeDm',
        'toggle-proactive-dms': 'social.proactiveDms.enabled', 'toggle-proactive-with-forum': 'social.proactiveDms.withForumRefresh',
        'toggle-proactive-with-auto': 'social.proactiveDms.withAutomaticRefresh', 'toggle-proactive-require-follow': 'social.proactiveDms.requireFollow',
        'toggle-quiet-hours': 'automation.quietHours.enabled',
        'toggle-forbidden-permanentDeath': 'automation.forbiddenEvents.permanentDeath',
        'toggle-forbidden-irreversibleInjury': 'automation.forbiddenEvents.irreversibleInjury',
        'toggle-forbidden-severeIllness': 'automation.forbiddenEvents.severeIllness',
        'toggle-forbidden-bankruptcy': 'automation.forbiddenEvents.bankruptcy',
        'toggle-forbidden-scam': 'automation.forbiddenEvents.scam',
        'toggle-forbidden-permanentTaskFailure': 'automation.forbiddenEvents.permanentTaskFailure',
        'toggle-fortune-api-draw': 'modules.fortune.allowApiDraw',
        'toggle-task-verification-api': 'modules.tasks.verificationApiEnabled',
        'toggle-system-ai-admin': 'moderation.systemAdminEnabled',
        'toggle-npc-reports': 'moderation.npcReportsEnabled',
        'toggle-auto-assign-permissions': 'moderation.autoAssignPermissions',
        'toggle-orchestrator': 'orchestration.enabled', 'toggle-combined-generation': 'orchestration.combinedGeneration',
        'toggle-world-time': 'orchestration.worldTimeEnabled',
        'toggle-floating-button': 'ui.floatingButton',
    };
    if (paths[action]) setSettingByPath(paths[action], checked);
    else if (action === 'toggle-image-api') updateApiConfig('image', 'enabled', checked);
    else if (action === 'toggle-text-image-fallback') updateApiConfig('image', 'textFallback', checked);
    else if (action === 'toggle-auto-image') updateApiConfig('image', 'autoGenerate', checked);
    else if (action === 'toggle-remember-keys') setRememberApiKeys(checked);
    if (action === 'toggle-fortune-api-draw' && !checked) viewState.fortuneAiMode = false;
    if (action === 'toggle-source-world' && checked && !viewState.worldCatalog.length) void refreshWorldCatalog();
    render({ preserveScroll: true });
}

async function setRoleModeration(npcId, kind, enabled) {
    const data = getForumData();
    const npc = data.npcs.find(item => item.id === npcId);
    if (!npc) return false;
    if (kind === 'muted') {
        npc.muted = Boolean(enabled);
    } else {
        npc.blocked = Boolean(enabled);
        npc.socialState = npc.blocked ? 'blocked' : 'normal';
        if (npc.blocked) {
            npc.followedByUser = false;
            npc.followsUser = false;
            data.notifications = data.notifications.filter(item => item.actorNpcId !== npc.id);
            if (!isConversationAllowed(data, data.conversations.find(item => item.id === viewState.selectedConversationId))) {
                viewState.selectedConversationId = '';
                viewState.mobileDmChat = false;
            }
        }
    }
    npc.updatedAt = Date.now();
    await saveForumData(data, true);
    syncInjection();
    return true;
}

async function handleRootClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const action = target.dataset.action;
    if (action === 'close') return closeForum();
    if (action === 'dismiss-toast') {
        viewState.toasts = viewState.toasts.filter(item => item.id !== target.dataset.toastId);
        return paintInAppToasts();
    }
    if (action === 'switch-tab') return setActiveTab(target.dataset.tab);
    if (action === 'open-settings') return setMeSection(target.dataset.section || 'modules');
    if (action === 'open-world-page') {
        const moduleId = target.dataset.moduleId;
        if (!getSettings().modules[moduleId]?.enabled) return;
        getSettings().ui.activeTab = 'services';
        viewState.worldPage = moduleId;
        viewState.selectedPostId = '';
        viewState.publicNpcId = '';
        saveSettings();
        return render();
    }
    if (action === 'back-world-home') { viewState.worldPage = ''; return render(); }
    if (action === 'choose-companion-species') {
        const species = COMPANION_SPECIES.find(item => item.id === target.dataset.speciesId);
        if (!species) return;
        const data = getForumData();
        data.world.companion.species = species.name;
        data.world.companion.avatarUrl = '';
        data.world.companion.bodyColor = '';
        data.world.companion.accentColor = '';
        data.world.companion.updatedAt = Date.now();
        viewState.companionAppearanceDraft = null;
        ensureCompanionConversation(data);
        await saveForumData(data, true);
        syncInjection();
        return render({ preserveScroll: true });
    }
    if (action === 'focus-companion-field') {
        const field = target.dataset.field;
        const input = getRoot().querySelector(`[data-companion-field="${field}"]`);
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus({ preventScroll: true });
        return;
    }
    if (action === 'toggle-companion-profile') {
        event.preventDefault();
        viewState.companionProfileOpen = !viewState.companionProfileOpen;
        return render({ preserveScroll: true });
    }
    if (action === 'companion-menu-nav') {
        const total = viewState.companionFoodMenuOpen ? COMPANION_FOODS.length : COMPANION_CARE_ACTIONS.length;
        const direction = Number(target.dataset.direction || 1);
        if (viewState.companionFoodMenuOpen) viewState.companionFoodIndex = (Number(viewState.companionFoodIndex || 0) + direction + total) % total;
        else viewState.companionMenuIndex = (Number(viewState.companionMenuIndex || 0) + direction + total) % total;
        return render({ preserveScroll: true });
    }
    if (action === 'companion-menu-confirm') {
        if (viewState.companionFoodMenuOpen) {
            const food = COMPANION_FOODS[Math.max(0, Math.min(COMPANION_FOODS.length - 1, Number(viewState.companionFoodIndex || 0)))];
            getRoot().querySelector(`[data-action="companion-feed-food"][data-food-id="${food.id}"]`)?.click();
            return;
        }
        const care = COMPANION_CARE_ACTIONS[Math.max(0, Math.min(COMPANION_CARE_ACTIONS.length - 1, Number(viewState.companionMenuIndex || 0)))]?.id;
        getRoot().querySelector(`[data-action="companion-care"][data-care="${care}"]`)?.click();
        return;
    }
    if (action === 'companion-food-back') {
        viewState.companionFoodMenuOpen = false;
        return render({ preserveScroll: true });
    }
    if (action === 'companion-feed-food') {
        const food = COMPANION_FOODS.find(item => item.id === target.dataset.foodId);
        if (!food) return;
        const data = getForumData();
        const companion = data.world.companion;
        const habit = getCompanionHabit(companion);
        const favorite = food.id === habit.favorite;
        const liked = favorite || habit.likes.includes(food.id);
        const happiness = food.happiness + (favorite ? 8 : liked ? 3 : -4);
        companion.satiety = Math.min(100, Number(companion.satiety || 0) + food.satiety);
        companion.energy = Math.min(100, Number(companion.energy || 0) + food.energy);
        companion.happiness = Math.max(0, Math.min(100, Number(companion.happiness || 0) + happiness));
        companion.bond = Math.min(100, Number(companion.bond || 0) + (favorite ? 3 : liked ? 2 : 1));
        companion.mood = favorite ? '最喜欢' : liked ? '满足' : '迟疑';
        companion.lastFood = food.id;
        companion.lastAction = 'feed';
        companion.message = favorite ? `${companion.name}一眼认出最喜欢的${food.name}，开心得整只都跳了起来！` : liked ? `${companion.name}认真吃完${food.name}，满足地靠近了屏幕。` : `${companion.name}试探着尝了一口${food.name}；这并不是它最习惯的食物。`;
        companion.lastInteractionAt = Date.now();
        companion.updatedAt = Date.now();
        if (companion.status === 'resting') companion.status = 'home';
        viewState.companionFoodMenuOpen = false;
        await saveForumData(data, true);
        syncInjection();
        return render({ preserveScroll: true });
    }
    if (action === 'choose-companion-device') {
        const skin = COMPANION_DEVICE_SKINS.find(item => item.id === target.dataset.deviceSkin);
        if (!skin) return;
        const data = getForumData();
        data.world.companion.deviceSkin = skin.id;
        data.world.companion.updatedAt = Date.now();
        await saveForumData(data, true);
        return render({ preserveScroll: true });
    }
    if (action === 'choose-companion-custom') {
        const data = getForumData();
        data.world.companion.species = '自定义旅伴';
        data.world.companion.avatarUrl = '';
        data.world.companion.updatedAt = Date.now();
        viewState.companionAppearanceDraft = null;
        ensureCompanionConversation(data);
        await saveForumData(data, true);
        syncInjection();
        render({ preserveScroll: true });
        queueMicrotask(() => getRoot()?.querySelector('[data-companion-field="species"]')?.focus());
        return;
    }
    if (action === 'companion-care') {
        const data = getForumData();
        const companion = data.world.companion;
        const care = target.dataset.care;
        if (care === 'feed') {
            viewState.companionMenuIndex = 0;
            viewState.companionFoodIndex = 0;
            viewState.companionFoodMenuOpen = true;
            return render({ preserveScroll: true });
        }
        const deltas = {
            pet: { satiety: 0, energy: 1, happiness: 12, bond: 3, mood: '亲昵' },
            play: { satiety: -5, energy: -9, happiness: 16, bond: 2, mood: '兴奋' },
            rest: { satiety: -2, energy: 22, happiness: 3, bond: 1, mood: '安心' },
            brush: { satiety: 0, energy: -2, happiness: 10, bond: 3, mood: '舒适' },
            dance: { satiety: -4, energy: -8, happiness: 15, bond: 2, mood: '雀跃' },
            train: { satiety: -3, energy: -7, happiness: 9, bond: 3, mood: '专注' },
            hide: { satiety: -1, energy: -3, happiness: 11, bond: 2, mood: '顽皮' },
            talk: { satiety: 0, energy: -1, happiness: 9, bond: 3, mood: '亲近' },
            dress: { satiety: 0, energy: -1, happiness: 10, bond: 2, mood: '得意' },
        }[care];
        if (!deltas) return;
        viewState.companionMenuIndex = COMPANION_CARE_ACTIONS.findIndex(item => item.id === care);
        for (const field of ['satiety', 'energy', 'happiness', 'bond']) companion[field] = Math.max(0, Math.min(100, Number(companion[field] || 0) + deltas[field]));
        companion.mood = deltas.mood;
        companion.lastAction = care;
        companion.message = ['pet', 'play', 'rest'].includes(care)
            ? personalizeCompanionReaction(companion, getCompanionHabit(companion)[care])
            : getCompanionExtraReaction(companion, care);
        if (care === 'dress') maybeCompanionSelfChangeAccessory(companion, { force: true });
        else maybeCompanionSelfChangeAccessory(companion);
        companion.lastInteractionAt = Date.now();
        companion.updatedAt = Date.now();
        if (care === 'rest') companion.status = 'resting';
        else if (companion.status === 'resting') companion.status = 'home';
        await saveForumData(data, true);
        syncInjection();
        return render({ preserveScroll: true });
    }
    if (action === 'companion-depart-ai' || action === 'companion-depart-local') {
        const companion = getForumData().world.companion;
        if (companion.status === 'away') return notify('info', '旅伴已经在旅行中');
        if (Number(companion.energy || 0) < 15 || Number(companion.satiety || 0) < 10) return notify('warning', '旅伴有点累或饿，先照顾它一下吧');
        return void runWorldModuleGeneration('travel', { forceApi: true, startJourney: true });
    }
    if (action === 'companion-signal-local') {
        await processCompanionJourneyClock();
        const trip = [...getForumData().world.trips].reverse().find(item => item.status === 'away');
        if (!trip) return notify('info', '现在还没有进行中的旅途');
        const nextMessage = trip.messages.find(message => !message.deliveredAt && !message.skippedAt);
        return notify('info', nextMessage ? `下一条旅途消息约在 ${formatTimeUntil(nextMessage.scheduledAt)} 后送达` : `旅伴正在返程，约 ${formatTimeUntil(trip.returnAt)} 后回家`);
    }
    if (action === 'revoke-local-fortune') {
        const data = getForumData();
        if (!data.world.fortune) return;
        viewState.fortuneRevealChoice = '';
        viewState.fortuneAiMode = false;
        data.world.fortune = null;
        data.world.companion.luckyDirection = '';
        if (/幸运方向/.test(data.world.companion.message || '')) data.world.companion.message = '今天想按自己的心情挑一个方向。';
        setModuleDecision(data, 'fortune', 'local', '已手动撤销今日运势，未调用 API', { generated: false });
        await saveForumData(data, true);
        syncInjection();
        notify('success', '已撤销今日运势');
        return render({ preserveScroll: true });
    }
    if (action === 'draw-local-fortune') {
        const data = getForumData();
        const choice = target.dataset.choice || 'middle';
        viewState.fortuneAiMode = false;
        const fortune = createLocalFortune(new Date(), `${data.topic}|${getChatSnapshot().characterId || 'standalone'}`, choice);
        if (data.world.fortune?.date === fortune.date) return render();
        if (data.world.fortune) data.world.fortuneHistory ||= [], data.world.fortuneHistory.push(data.world.fortune);
        data.world.fortune = fortune;
        data.world.companion.luckyDirection = fortune.modifiers.luckyDirection;
        data.world.companion.message = `今天的幸运方向好像是${fortune.modifiers.luckyDirection}边。`;
        viewState.fortuneRevealChoice = choice;
        setModuleDecision(data, 'fortune', 'local', '已在本地翻开今日签，未调用 API', { generated: true });
        await saveForumData(data, true);
        syncInjection();
        notify('success', '今日签已在本地生成，没有调用 API');
        render();
        setTimeout(() => { viewState.fortuneRevealChoice = ''; }, 1400);
        return;
    }
    if (action === 'toggle-ai-fortune-mode') {
        if (!getSettings().modules.fortune.allowApiDraw) return notify('warning', '请先在运势模块设置中开启 AI 抽签');
        if (viewState.moduleBusy.has('fortune')) return;
        viewState.fortuneAiMode = !viewState.fortuneAiMode;
        viewState.fortuneRevealChoice = '';
        return render({ preserveScroll: true });
    }
    if (action === 'reset-companion-appearance') {
        viewState.companionAppearanceDraft = { bodyColor: '', accentColor: '', accessoryColor: '', accessory: 'none' };
        return render({ preserveScroll: true });
    }
    if (action === 'save-companion-appearance') {
        if (!viewState.companionAppearanceDraft) return notify('info', '当前形象已经保存');
        const data = getForumData();
        const draft = viewState.companionAppearanceDraft;
        data.world.companion.bodyColor = /^#[0-9a-f]{6}$/i.test(draft.bodyColor || '') ? draft.bodyColor : '';
        data.world.companion.accentColor = /^#[0-9a-f]{6}$/i.test(draft.accentColor || '') ? draft.accentColor : '';
        data.world.companion.accessoryColor = /^#[0-9a-f]{6}$/i.test(draft.accessoryColor || '') ? draft.accessoryColor : '';
        data.world.companion.accessory = COMPANION_ACCESSORIES.some(item => item.id === draft.accessory) ? draft.accessory : 'none';
        data.world.companion.updatedAt = Date.now();
        viewState.companionAppearanceDraft = null;
        await saveForumData(data, true);
        notify('success', `${data.world.companion.name}的新形象已经保存`);
        return render({ preserveScroll: true });
    }
    if (action === 'draw-api-fortune') {
        if (!getSettings().modules.fortune.allowApiDraw) return notify('warning', '请先在运势模块设置中开启 AI 抽签');
        if (!viewState.fortuneAiMode) return notify('info', '请先开启 AI 解签模式，再亲手选择一张牌');
        const choice = ['left', 'middle', 'right'].includes(target.dataset.choice) ? target.dataset.choice : 'middle';
        viewState.fortuneRevealChoice = choice;
        return void runWorldModuleGeneration('fortune', { forceApi: true, fortuneChoice: choice });
    }
    if (action === 'create-local-health') {
        const data = getForumData();
        const npcId = getRoot().querySelector('#tf-health-subject')?.value || '';
        const npc = data.npcs.find(item => item.id === npcId);
        const item = createLocalHealthEvent({ subject: npc?.name || getMyDisplayName(), subjectNpcId: npc?.id || '', seed: `${data.world.health.length}|${data.topic}` });
        data.world.health.push(item);
        addModuleNotification(data, 'health', `${item.subject}注意到：${item.name}`, { actorNpcId: npc?.id || '', actorName: item.subject, moduleId: 'health', itemId: item.id });
        await saveForumData(data, true);
        syncInjection();
        return render();
    }
    if (['health-observe', 'health-find-provider', 'health-consult', 'health-treat', 'health-resolve'].includes(action)) {
        const data = getForumData();
        const item = data.world.health.find(entry => entry.id === target.closest('[data-world-item-id]')?.dataset.worldItemId);
        if (!item) return;
        if (action === 'health-observe') { item.stage = 'noticed'; item.progress = Math.max(25, Number(item.progress || 0)); item.careNote = '先记下变化，看看休息后是否缓解。'; }
        if (action === 'health-find-provider') {
            const medicalPattern = /医生|医师|医者|牙医|大夫|郎中|治疗|治愈|医疗|healer|doctor|medic/i;
            const providerNpc = getRoleLibrary(data).find(npc => medicalPattern.test(`${npc.name} ${npc.bio} ${npc.signature} ${npc.bindingContent}`));
            const context = `${getChatSnapshot().characterPersona || ''} ${getChatSnapshot().worldInfo || ''}`;
            const fallback = /古代|江湖|王朝|修仙|仙侠/.test(context) ? '附近医馆的郎中' : /魔法|精灵|奇幻|神殿/.test(context) ? '社区登记的治疗师' : /星际|太空|赛博|未来/.test(context) ? '社区医疗机器人' : item.name.includes('智齿') ? '社区牙科诊所' : '社区门诊医生';
            item.provider = providerNpc?.name || fallback;
            item.providerNpcId = providerNpc?.id || '';
            item.stage = 'seeking';
            item.progress = 35;
        }
        if (action === 'health-consult') { item.stage = 'consulting'; item.progress = 50; item.careNote ||= '已经了解基本情况，准备给出处理建议。'; }
        if (action === 'health-treat') { item.stage = 'recovering'; item.status = 'recovering'; item.progress = 78; item.careNote ||= '按照适合当前世界的方式处理，并观察恢复。'; }
        if (action === 'health-resolve') { item.stage = 'resolved'; item.status = 'resolved'; item.progress = 100; item.careNote = '这次身体事件已经告一段落。'; }
        item.updatedAt = Date.now();
        addModuleNotification(data, 'health', `${item.subject} · ${item.name}：${item.stage === 'resolved' ? '已经恢复' : '进度有更新'}`, { actorNpcId: item.subjectNpcId, actorName: item.subject, moduleId: 'health', itemId: item.id });
        await saveForumData(data, true);
        syncInjection();
        return render({ preserveScroll: true });
    }
    if (action === 'open-module-context') {
        const moduleId = target.dataset.moduleId;
        if (moduleId === 'moderation') return setMeSection('moderation');
        if (getSettings().modules[moduleId]?.enabled) {
            getSettings().ui.activeTab = 'services';
            viewState.worldPage = moduleId;
            saveSettings();
            return render();
        }
    }
    if (action === 'me-section') {
        const navScrollLeft = Number(target.closest('.tf-me-nav')?.scrollLeft || viewState.settingsNavScrollLeft || 0);
        viewState.settingsNavScrollLeft = navScrollLeft;
        setMeSection(target.dataset.section);
        const restoreSettingsNav = () => {
            const nav = getRoot()?.querySelector('.tf-settings-page .tf-me-nav');
            if (nav) nav.scrollLeft = navScrollLeft;
        };
        queueMicrotask(() => {
            restoreSettingsNav();
            requestAnimationFrame(restoreSettingsNav);
        });
        return;
    }
    if (action === 'profile-tab') { viewState.profileTab = target.dataset.profileTab || 'posts'; return render(); }
    if (action === 'clear-settings-search') { viewState.settingsSearch = ''; return render({ preserveScroll: true }); }
    if (action === 'settings-search-result') { viewState.settingsSearch = ''; viewState.settingsHighlight = target.dataset.section || ''; globalThis.setTimeout(() => { viewState.settingsHighlight = ''; }, 1800); return setMeSection(target.dataset.section); }
    if (action === 'message-mode') { viewState.messageMode = ['notifications', 'tasks'].includes(target.dataset.mode) ? target.dataset.mode : 'dm'; if (viewState.messageMode === 'dm') viewState.mobileDmChat = false; return render(); }
    if (action === 'notification-filter') { viewState.notificationFilter = target.dataset.filter || 'all'; return render(); }
    if (action === 'mark-all-notifications') {
        for (const item of getForumData().notifications) item.read = true;
        await saveForumData(getForumData(), true);
        return render();
    }
    if (action === 'clear-generation-logs') {
        if (!window.confirm('确定清空运行后台中的生成记录和报错吗？帖子不会受到影响。')) return;
        const data = getForumData();
        data.generationLogs = [];
        data.lastGenerationTrace = '';
        data.lastGenerationAt = 0;
        await saveForumData(data, true);
        notify('success', '运行后台记录已清空');
        return render();
    }
    if (action === 'restore-all-builtin-prompts') {
        if (!window.confirm('确定把所有内置提示词恢复为默认内容吗？论坛设定不会受到影响。')) return;
        getSettings().builtinPrompts = { ...DEFAULT_BUILTIN_PROMPTS };
        saveSettings();
        syncInjection();
        return render();
    }
    if (action === 'restore-builtin-prompt') {
        const id = target.dataset.promptId;
        if (id && Object.prototype.hasOwnProperty.call(DEFAULT_BUILTIN_PROMPTS, id)) getSettings().builtinPrompts[id] = DEFAULT_BUILTIN_PROMPTS[id];
        saveSettings();
        syncInjection();
        return render();
    }
    if (action === 'module-tools') {
        viewState.openModuleToolsId = viewState.openModuleToolsId === target.dataset.moduleId ? '' : target.dataset.moduleId;
        return render({ preserveScroll: true });
    }
    if (action === 'export-module') {
        const moduleId = target.dataset.moduleId;
        const definition = getModuleDefinition(moduleId);
        const settings = getSettings();
        return downloadJson(`tavern-forum-${moduleId}-settings.json`, {
            format: 'tavern-forum-module-settings', version: 1, moduleId,
            settings: settings.modules[moduleId],
            builtinPrompt: settings.builtinPrompts[moduleId === 'tasks' ? 'task' : moduleId] || '',
            notificationEnabled: settings.notifications[{ tasks: 'tasks', travel: 'companion', health: 'health', moderation: 'moderation' }[moduleId] || 'system'],
        });
    }
    if (action === 'import-module') {
        viewState.pendingModuleImportId = target.dataset.moduleId || '';
        return getRoot().querySelector('#tf-import-module-file')?.click();
    }
    if (action === 'reset-module') {
        const moduleId = target.dataset.moduleId;
        const definition = getModuleDefinition(moduleId);
        if (!definition || !window.confirm(`只恢复“${definition.name}”的默认设置吗？现有内容不会删除。`)) return;
        getSettings().modules[moduleId] = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.modules[moduleId]));
        const promptId = moduleId === 'tasks' ? 'task' : moduleId;
        if (DEFAULT_BUILTIN_PROMPTS[promptId]) getSettings().builtinPrompts[promptId] = DEFAULT_BUILTIN_PROMPTS[promptId];
        saveSettings();
        syncInjection();
        notify('success', `已恢复“${definition.name}”的默认设置`);
        return render({ preserveScroll: true });
    }
    if (action === 'refresh-world-module') return void runWorldModuleGeneration(target.dataset.moduleId);
    if (action === 'verify-task-completion') return void runTaskVerification(target.closest('[data-world-item-id]')?.dataset.worldItemId);
    if (action === 'reopen-legacy-task') {
        const data = getForumData();
        const task = data.world.tasks.find(item => item.id === target.closest('[data-world-item-id]')?.dataset.worldItemId);
        if (!task || task.status !== 'completed' || task.verifiedAt) return;
        task.status = 'accepted';
        task.acceptedAt = Date.now();
        task.acceptedMessageIndex = getChatSnapshot().chat.length;
        task.verificationStatus = 'unverified';
        task.verificationReason = '旧版直接完成已撤销；需要在接受后的正文中取得证据。';
        task.updatedAt = Date.now();
        data.world.inventory = data.world.inventory.filter(item => item.source !== `任务奖励 · ${task.id}`);
        addTaskConversationUpdate(data, task, `旧版完成状态已撤销。“${task.title}”重新进入进行中；之后只会依据接受后的正文证据完成。`);
        await saveForumData(data, true);
        syncInjection();
        notify('success', '旧版完成已撤销，任务恢复为进行中');
        return render({ preserveScroll: true });
    }
    if (action === 'open-task-app') {
        getSettings().ui.activeTab = 'services';
        viewState.worldPage = 'tasks';
        saveSettings();
        return render();
    }
    if (action === 'open-task-messages') {
        const data = getForumData();
        const latest = [...data.world.tasks].reverse().find(item => ['offered', 'accepted'].includes(item.status)) || data.world.tasks.at(-1);
        const conversation = latest ? findTaskConversation(data, latest) || ensureTaskDelivery(data, latest, { notifyUser: false }) : null;
        getSettings().ui.activeTab = 'messages';
        viewState.messageMode = 'dm';
        viewState.selectedConversationId = conversation?.id || '';
        viewState.mobileDmChat = Boolean(conversation);
        saveSettings();
        if (conversation) await saveForumData(data, true);
        return render();
    }
    if (action === 'set-task-status') {
        const data = getForumData();
        const task = data.world.tasks.find(item => item.id === target.closest('[data-world-item-id]')?.dataset.worldItemId);
        if (task) {
            const next = target.dataset.status;
            if (next === 'completed') return notify('warning', '任务必须通过正文证据验收，不能直接标记完成');
            if (!['accepted', 'abandoned', 'failed'].includes(next)) return;
            task.status = next;
            task.updatedAt = Date.now();
            if (next === 'accepted') {
                task.acceptedAt = Date.now();
                task.acceptedMessageIndex = getChatSnapshot().chat.length;
                task.verificationStatus = 'unverified';
                task.verificationReason = '';
                addTaskConversationUpdate(data, task, `委托已确认。目标是“${task.objectiveTarget || task.title}”${Number(task.objectiveQuantity || 1) > 1 ? ` ×${Number(task.objectiveQuantity)}` : ''}；完成后请提交正文验收。你可以继续在这里询问任务细节。`);
            } else {
                addTaskConversationUpdate(data, task, next === 'failed' ? `“${task.title}”已记录为未完成。` : `你已经放弃“${task.title}”。`);
            }
            await saveForumData(data, true); syncInjection();
        }
        return render();
    }
    if (action === 'advance-trip-status') {
        const data = getForumData();
        const trip = data.world.trips.find(item => item.id === target.closest('[data-world-item-id]')?.dataset.worldItemId);
        const next = { planned: 'away', away: 'returned', returned: 'returned', cancelled: 'cancelled' };
        if (trip) {
            trip.status = next[trip.status] || 'away';
            trip.updatedAt = Date.now();
            if (trip.status === 'returned' && trip.souvenir && !trip.souvenirClaimedAt) {
                const companionName = data.world.companion.name || trip.traveler || '旅伴';
                const source = `${companionName}返程 · ${trip.id}`;
                if (!data.world.inventory.some(item => item.name === trip.souvenir && item.source === source)) data.world.inventory.push({ id: createId('item'), name: trip.souvenir, description: `${companionName}从${trip.destination}带回的小物件。`, quantity: 1, effect: '可收藏，也可在合适的情境中使用。', source, usable: true, consumed: false, createdAt: Date.now(), updatedAt: Date.now() });
                trip.souvenirClaimedAt = Date.now();
            }
            await saveForumData(data, true);
            syncInjection();
        }
        return render();
    }
    if (action === 'companion-return') {
        const result = await processCompanionJourneyClock({ forceReturn: true });
        if (!result?.returned) notify('info', '旅伴现在就在家里');
        return;
    }
    if (action === 'advance-health-status') {
        const data = getForumData();
        const item = data.world.health.find(entry => entry.id === target.closest('[data-world-item-id]')?.dataset.worldItemId);
        if (item) { item.status = item.status === 'active' ? 'recovering' : 'resolved'; item.updatedAt = Date.now(); addModuleNotification(data, 'health', `${item.subject}：${item.status === 'resolved' ? '状态已经恢复' : '正在恢复中'}`, { actorName: item.subject, moduleId: 'health', itemId: item.id }); await saveForumData(data, true); syncInjection(); }
        return render();
    }
    if (action === 'set-inventory-filter') {
        const filter = target.dataset.filter;
        if (!['all', 'companion', 'medical', 'story', 'archive'].includes(filter)) return;
        viewState.inventoryFilter = filter;
        viewState.selectedInventoryItemId = '';
        return render({ preserveScroll: true });
    }
    if (action === 'select-inventory-item') {
        viewState.selectedInventoryItemId = target.dataset.itemId || '';
        return render({ preserveScroll: true });
    }
    if (action === 'use-inventory-item') {
        const data = getForumData();
        const result = applyInventoryItemUse(data, target.closest('[data-world-item-id]')?.dataset.worldItemId, target.dataset.inventoryUse || 'auto');
        if (!result.applied) return notify('warning', result.reason);
        if (result.kind === 'medical') addModuleNotification(data, 'health', result.summary, { actorName: '健康与医疗', moduleId: 'health', itemId: result.targetId });
        if (result.kind === 'companion') {
            const conversation = ensureCompanionConversation(data);
            addConversationMessage(conversation, data.world.companion.message, { kind: 'companion' });
            addModuleNotification(data, 'companion', result.summary, { actorName: data.world.companion.name, moduleId: 'travel', conversationId: conversation.id });
        }
        await saveForumData(data, true);
        syncInjection();
        notify('success', result.summary);
        return render({ preserveScroll: true });
    }
    if (action === 'delete-world-item') {
        if (!window.confirm('确定删除这条模块记录吗？')) return;
        const kind = target.dataset.kind;
        const id = target.closest('[data-world-item-id]')?.dataset.worldItemId;
        if (['tasks', 'trips', 'inventory', 'health'].includes(kind)) getForumData().world[kind] = getForumData().world[kind].filter(item => item.id !== id);
        if (kind === 'inventory' && viewState.selectedInventoryItemId === id) viewState.selectedInventoryItemId = '';
        await saveForumData(getForumData(), true);
        syncInjection();
        return render();
    }
    if (action === 'open-notification') {
        const item = getForumData().notifications.find(entry => entry.id === target.dataset.notificationId);
        if (item) item.read = true;
        await saveForumData(getForumData(), true);
        if (item?.postId && findPost(item.postId)) {
            getSettings().ui.activeTab = 'home';
            viewState.selectedPostId = item.postId;
            viewState.publicNpcId = '';
            saveSettings();
            return render();
        }
        if (item?.conversationId) {
            viewState.selectedConversationId = item.conversationId;
            viewState.messageMode = 'dm';
            viewState.mobileDmChat = true;
            getSettings().ui.activeTab = 'messages';
            saveSettings();
            return render();
        }
        if (item?.moduleId && getSettings().modules[item.moduleId]?.enabled && item.moduleId !== 'moderation') {
            getSettings().ui.activeTab = 'services';
            viewState.worldPage = item.moduleId;
            saveSettings();
            return render();
        }
        if (item?.moduleId === 'moderation') return setMeSection('moderation');
        return render();
    }
    if (action === 'go-injection-settings') {
        viewState.pendingSettingsBlock = 'chat-injection';
        setMeSection('sources');
        return;
    }
    if (action === 'generate-posts') return void runGeneration();
    if (action === 'toggle-composer') { viewState.composerOpen = !viewState.composerOpen; return render(); }
    if (action === 'feed-mode') { viewState.feedMode = ['following', 'recommended', 'latest', 'hot'].includes(target.dataset.feed) ? target.dataset.feed : 'recommended'; return render(); }
    if (action === 'clear-topic') { viewState.selectedTopic = ''; return render(); }
    if (action === 'topic-search') {
        viewState.selectedTopic = target.dataset.topic || '';
        setActiveTab('home');
        return;
    }
    if (action === 'add-composer-poll') {
        const question = window.prompt('投票问题：', '你怎么看？')?.trim();
        if (!question) return;
        const options = window.prompt('投票选项（每行一个，至少两个）：', '赞成\n反对')?.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        if (!options || options.length < 2) return notify('warning', '投票至少需要两个选项');
        viewState.composerPoll = { question, options: options.slice(0, 10) };
        return render();
    }
    if (action === 'remove-composer-poll') { viewState.composerPoll = null; return render(); }
    if (action === 'publish-manual') {
        try {
            const data = getForumData();
            data.posts.push(createManualPost({ author: getRoot().querySelector('#tf-compose-author')?.value, handle: getRoot().querySelector('#tf-compose-handle')?.value, content: getRoot().querySelector('#tf-compose-content')?.value, tags: getRoot().querySelector('#tf-compose-tags')?.value.split(/[,，]/).map(value => value.trim()).filter(Boolean), poll: viewState.composerPoll }));
            await enforcePostRetention(data);
            await saveForumData(data, true);
            syncInjection();
            viewState.composerOpen = false;
            viewState.composerPoll = null;
            render();
        } catch (error) { notify('warning', error.message); }
        return;
    }

    if (action === 'open-char-dm') {
        const data = getForumData();
        const conversation = ensureCharacterConversation(data, getChatSnapshot());
        await saveForumData(data, true);
        viewState.selectedConversationId = conversation.id;
        viewState.mobileDmChat = true;
        return setActiveTab('messages');
    }
    if (action === 'open-my-profile') return setMeSection('overview');
    if (action === 'open-conversation') {
        viewState.selectedConversationId = target.dataset.conversationId;
        viewState.mobileDmChat = true;
        const conversation = getForumData().conversations.find(item => item.id === viewState.selectedConversationId);
        if (conversation) { conversation.unread = 0; void saveForumData(getForumData()); }
        return render();
    }
    if (action === 'back-dm-list') { viewState.mobileDmChat = false; return render(); }
    if (action === 'start-npc-dm') {
        const data = getForumData();
        const npc = data.npcs.find(item => item.id === target.dataset.npcId);
        if (!isRoleLibraryMember(npc)) return notify('warning', '请先生成该角色的人设，加入角色库后才能开启私信');
        if (!strangerDmAllowed(npc, { decide: true })) {
            await saveForumData(data, true);
            return notify('warning', `${npc.name} 暂时不接收陌生人的私信`);
        }
        const conversation = npc.systemRole ? ensureCharacterConversation(data, getChatSnapshot()) : ensureNpcConversation(data, npc);
        if (!conversation) return;
        await saveForumData(data, true);
        viewState.selectedConversationId = conversation.id;
        viewState.mobileDmChat = true;
        return setActiveTab('messages');
    }
    if (action === 'new-dm-npc') {
        const data = getForumData();
        const roles = getRoleLibrary(data).filter(npc => !npc.systemRole && !npc.blocked && strangerDmAllowed(npc));
        if (!roles.length) return notify('warning', '角色库中还没有可私信的角色');
        const menu = roles.map((npc, index) => `${index + 1}. ${npc.name} (@${npc.handle})`).join('\n');
        const value = window.prompt(`选择要私信的角色\n可填写序号、名称或账号：\n${menu}`)?.trim();
        if (!value) return;
        const key = value.replace(/^@/, '').toLocaleLowerCase();
        const npc = roles[Number(value) - 1] || roles.find(role => role.name.toLocaleLowerCase() === key || role.handle.toLocaleLowerCase() === key);
        if (!npc) return notify('warning', '没有找到这个角色');
        const conversation = ensureNpcConversation(data, npc);
        await saveForumData(data, true);
        viewState.selectedConversationId = conversation.id;
        viewState.mobileDmChat = true;
        return render();
    }
    if (action === 'new-role-dm') {
        if (!getSettings().social.roleDirectMessages) return notify('warning', '请先在“我 → 信息边界”开启角色之间私信');
        const data = getForumData();
        const roles = getRoleLibrary(data).filter(npc => !npc.blocked);
        if (roles.length < 2) return notify('warning', '至少需要两个未拉黑的角色');
        const menu = roles.map((npc, index) => `${index + 1}. ${npc.name} (@${npc.handle})`).join('\n');
        const pick = label => {
            const value = window.prompt(`${label}\n可填写序号、名称或账号：\n${menu}`)?.trim();
            const byNumber = roles[Number(value) - 1];
            const key = String(value || '').replace(/^@/, '').toLocaleLowerCase();
            return byNumber || roles.find(npc => npc.name.toLocaleLowerCase() === key || npc.handle.toLocaleLowerCase() === key);
        };
        const first = pick('选择角色 A');
        if (!first) return;
        const second = pick('选择角色 B');
        if (!second) return;
        if (first.id === second.id) return notify('warning', 'A 和 B 不能是同一个角色');
        const conversation = ensureRoleConversation(data, first, second);
        await saveForumData(data, true);
        viewState.selectedConversationId = conversation.id;
        viewState.messageMode = 'dm';
        viewState.mobileDmChat = true;
        return render();
    }
    if (action === 'send-dm') {
        event.preventDefault();
        const composer = target.closest('.tf-dm-composer');
        return void sendDirectMessage(target.dataset.conversationId, composer?.querySelector('#tf-dm-input')?.value);
    }
    if (action === 'generate-dm-reply') {
        event.preventDefault();
        return void runDirectMessageReply(target.dataset.conversationId);
    }
    if (action === 'generate-role-dm') {
        event.preventDefault();
        const composer = target.closest('.tf-role-dm-composer');
        return void runRoleDirectMessage(target.dataset.conversationId, composer?.querySelector('#tf-role-dm-speaker')?.value, composer?.querySelector('#tf-role-dm-direction')?.value);
    }

    if (action === 'open-npc') {
        const npcId = target.dataset.npcId;
        const npc = getForumData().npcs.find(item => item.id === npcId);
        if (!npc) return;
        viewState.publicNpcId = npcId;
        viewState.selectedPostId = '';
        getSettings().ui.activeTab = 'home';
        saveSettings();
        render();
        return;
    }
    if (action === 'edit-npc') {
        const npcId = target.dataset.npcId;
        const npc = getForumData().npcs.find(item => item.id === npcId);
        if (!isRoleLibraryMember(npc)) return notify('warning', '该角色尚未生成人设');
        viewState.selectedNpcId = npcId;
        viewState.publicNpcId = '';
        viewState.selectedPostId = '';
        setMeSection('npcs');
        if (!viewState.worldCatalog.length) void refreshWorldCatalog();
        return;
    }
    if (action === 'back-public-profile') { viewState.publicNpcId = ''; return render(); }
    if (action === 'back-post') { viewState.selectedPostId = ''; viewState.replyTarget = null; return render(); }
    if (action === 'back-npcs') { viewState.selectedNpcId = ''; return render(); }
    if (action === 'select-role-memory') { viewState.selectedMemoryNpcId = target.dataset.npcId || ''; return render(); }
    if (action === 'add-npc') {
        const name = window.prompt('角色显示名称：', '新角色')?.trim();
        if (!name) return;
        const handle = window.prompt('论坛账号：', `role${Math.floor(Math.random() * 9000 + 1000)}`)?.trim();
        const data = getForumData();
        const npc = createNpc({ name, handle });
        data.npcs.push(npc);
        await saveForumData(data, true);
        viewState.selectedNpcId = npc.id;
        return render();
    }
    if (action === 'generate-npc-profile') {
        const npc = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (!npc) return;
        const message = npc.profileGenerated
            ? `确定重新生成 ${npc.name} 的人设与主页吗？这会调用一次文本 API，并覆盖现有的自动生成字段。`
            : `是否生成 ${npc.name} 的人设与主页？只有确认后才会调用一次文本 API。`;
        if (!window.confirm(message)) return;
        return void runNpcProfileGeneration(npc.id);
    }
    if (action === 'delete-npc') {
        const selected = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (selected?.systemRole) return notify('warning', '当前 Char 的默认角色会自动保留');
        if (!window.confirm('确定删除这个角色配置和对应私信吗？帖子不会删除。')) return;
        const data = getForumData();
        const npcId = target.dataset.npcId;
        data.npcs = data.npcs.filter(npc => npc.id !== npcId);
        data.conversations = data.conversations.filter(item => !(item.type === 'npc' && item.targetId === npcId) && !(item.type === 'role_dm' && item.participantIds?.includes(npcId)));
        for (const fact of data.facts) fact.knownBy = (fact.knownBy || []).filter(id => id !== npcId);
        for (const post of data.posts) {
            if (post.npcId === npcId) { post.npcId = ''; post.isAi = false; }
            for (const comment of post.comments || []) if (comment.npcId === npcId) { comment.npcId = ''; comment.isAi = false; }
        }
        await saveForumData(data, true);
        syncInjection();
        viewState.selectedNpcId = '';
        return render();
    }
    if (action === 'add-avatar-url') {
        const name = getRoot().querySelector('#tf-avatar-name')?.value.trim();
        const url = getRoot().querySelector('#tf-avatar-url')?.value.trim();
        if (!name || !isSafeImageUrl(url)) return notify('warning', '请填写头像名称和有效的 http/https 图片直链');
        getSettings().avatarLibrary.push({ id: createId('avatar'), name, url, imageKey: '' });
        saveSettings();
        return render();
    }
    if (action === 'upload-avatar-library') return getRoot().querySelector('#tf-import-avatar-library-file')?.click();
    if (action === 'upload-profile-avatar') return getRoot().querySelector('#tf-import-profile-avatar-file')?.click();
    if (action === 'upload-profile-background') return getRoot().querySelector('#tf-import-profile-background-file')?.click();
    if (action === 'upload-brand-icon') return getRoot().querySelector('#tf-import-brand-icon-file')?.click();
    if (action === 'upload-forum-wallpaper') return getRoot().querySelector('#tf-import-forum-wallpaper-file')?.click();
    if (action === 'upload-view-wallpaper') {
        viewState.pendingViewWallpaperId = target.dataset.viewId || '';
        return getRoot().querySelector('#tf-import-view-wallpaper-file')?.click();
    }
    if (action === 'clear-view-wallpaper') {
        const theme = getSettings().appearance.viewThemes[target.dataset.viewId];
        if (!theme) return;
        await removeImageAsset(theme.wallpaperKey);
        theme.wallpaperUrl = '';
        theme.wallpaperKey = '';
        saveSettings();
        return render();
    }
    if (action === 'clear-brand-icon' || action === 'clear-forum-wallpaper') {
        const appearance = getSettings().appearance;
        const kind = action === 'clear-brand-icon' ? 'brandIcon' : 'wallpaper';
        await removeImageAsset(appearance[`${kind}Key`]);
        appearance[`${kind}Url`] = '';
        appearance[`${kind}Key`] = '';
        saveSettings();
        return render();
    }
    if (action === 'upload-floating-button-image') return getRoot().querySelector('#tf-import-floating-button-file')?.click();
    if (action === 'clear-floating-button-image') {
        const ui = getSettings().ui;
        await removeImageAsset(ui.floatingButtonImageKey);
        ui.floatingButtonImageUrl = '';
        ui.floatingButtonImageKey = '';
        saveSettings();
        updateLaunchers();
        return render();
    }
    if (action === 'reset-floating-button-position') {
        getSettings().ui.floatingButtonPosition = { x: null, y: null };
        saveSettings();
        updateLaunchers();
        return render();
    }
    if (action === 'upload-npc-avatar') {
        viewState.pendingNpcAvatarId = target.dataset.npcId || '';
        return getRoot().querySelector('#tf-import-npc-avatar-file')?.click();
    }
    if (action === 'upload-npc-background') {
        viewState.pendingNpcBackgroundId = target.dataset.npcId || '';
        return getRoot().querySelector('#tf-import-npc-background-file')?.click();
    }
    if (action === 'clear-profile-avatar' || action === 'clear-profile-background') {
        const profile = getSettings().profile;
        const kind = action.endsWith('background') ? 'background' : 'avatar';
        await removeImageAsset(profile[`${kind}Key`]);
        profile[`${kind}Url`] = '';
        profile[`${kind}Key`] = '';
        saveSettings();
        return render();
    }
    if (action === 'select-profile-default-avatar') {
        const profile = getSettings().profile;
        await removeImageAsset(profile.avatarKey);
        profile.avatarUrl = DEFAULT_AVATARS[Number(target.dataset.avatarIndex)]?.url || createDefaultAvatarDataUrl(profile.displayName || 'me');
        profile.avatarKey = '';
        saveSettings();
        return render();
    }
    if (action === 'select-npc-default-avatar' || action === 'clear-npc-avatar') {
        const npc = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (!npc) return;
        await removeImageAsset(npc.avatarKey);
        const index = action === 'select-npc-default-avatar' ? Number(target.dataset.avatarIndex) : null;
        updateNpcAvatar(npc, { url: Number.isInteger(index) ? DEFAULT_AVATARS[index]?.url : createDefaultAvatarDataUrl(`${npc.name}:${Date.now()}`) });
        await saveForumData(getForumData(), true);
        return render();
    }
    if (action === 'clear-npc-background') {
        const npc = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (!npc) return;
        await removeImageAsset(npc.backgroundKey);
        npc.backgroundUrl = '';
        npc.backgroundKey = '';
        await saveForumData(getForumData(), true);
        return render();
    }
    if (action === 'toggle-follow-role') {
        const npc = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (!npc) return;
        if (npc.blocked) return notify('warning', '请先取消拉黑再关注');
        npc.followedByUser = !npc.followedByUser;
        await saveForumData(getForumData(), true);
        return render();
    }
    if (action === 'toggle-role-muted' || action === 'toggle-role-blocked') {
        const npc = getForumData().npcs.find(item => item.id === target.dataset.npcId);
        if (!npc) return;
        const kind = action === 'toggle-role-muted' ? 'muted' : 'blocked';
        const next = !npc[kind];
        if (kind === 'blocked' && next && !window.confirm(`拉黑 ${npc.name} 后会隐藏其内容、通知并取消双方关注，且不能继续私信。确定吗？`)) return;
        await setRoleModeration(npc.id, kind, next);
        viewState.openPostMenuId = '';
        return render();
    }
    if (action === 'add-fact') {
        const content = getRoot().querySelector('#tf-new-fact')?.value.trim();
        if (!content) return notify('warning', '请先填写事实内容');
        const data = getForumData();
        data.facts.push(createFact({ content, visibility: getRoot().querySelector('#tf-new-fact-visibility')?.value }));
        await saveForumData(data, true);
        return render();
    }
    if (action === 'delete-fact') {
        const data = getForumData();
        data.facts = data.facts.filter(fact => fact.id !== target.dataset.factId);
        await saveForumData(data, true);
        return render();
    }
    if (action === 'delete-avatar-url') {
        const item = getSettings().avatarLibrary.find(entry => entry.id === target.dataset.avatarId);
        await removeImageAsset(item?.imageKey);
        getSettings().avatarLibrary = getSettings().avatarLibrary.filter(entry => entry.id !== target.dataset.avatarId);
        saveSettings();
        return render();
    }

    const postId = target.dataset.postId;
    const post = postId ? findPost(postId) : null;
    if (action === 'report-post' && post) {
        if (!getSettings().modules.moderation.enabled) return notify('warning', '社区治理模块当前未开启');
        const reason = window.prompt('举报原因：', '')?.trim();
        if (!reason) return;
        const data = getForumData();
        if (data.world.reports.some(report => report.postId === post.id && !report.commentId && ['pending', 'reviewing'].includes(report.status))) return notify('warning', '这篇帖子已经在等待处理');
        data.world.reports.push(createPostReport({ postId: post.id, reason, reporter: getMyDisplayName(), reporterHandle: getSettings().profile.handle }));
        viewState.openPostMenuId = '';
        await saveForumData(data, true);
        notify('success', '举报已提交');
        if (getSettings().moderation.systemAdminEnabled && getSettings().modules.moderation.automation === 'auto') void runWorldModuleGeneration('moderation', { reportId: data.world.reports[data.world.reports.length - 1].id });
        return render();
    }
    if (action === 'report-comment' && post) {
        if (!getSettings().modules.moderation.enabled) return notify('warning', '社区治理模块当前未开启');
        const comment = (post.comments || []).find(item => item.id === target.dataset.commentId);
        if (!comment || comment.moderation?.hidden) return notify('warning', '这条评论已经不可用');
        const reason = window.prompt('举报评论的原因：', '')?.trim();
        if (!reason) return;
        const data = getForumData();
        if (data.world.reports.some(report => report.postId === post.id && report.commentId === comment.id && ['pending', 'reviewing'].includes(report.status))) return notify('warning', '这条评论已经在等待处理');
        const report = createPostReport({ postId: post.id, commentId: comment.id, reason, reporter: getMyDisplayName(), reporterHandle: getSettings().profile.handle });
        data.world.reports.push(report);
        await saveForumData(data, true);
        notify('success', '评论举报已提交');
        if (getSettings().moderation.systemAdminEnabled && getSettings().modules.moderation.automation === 'auto') void runWorldModuleGeneration('moderation', { reportId: report.id });
        return render();
    }
    if (action === 'add-manual-moderator') {
        const name = window.prompt('管理员显示名称：', '新管理员')?.trim();
        if (!name) return;
        const handle = window.prompt('管理员论坛账号：', `moderator_${Math.floor(Math.random() * 9000 + 1000)}`)?.trim();
        if (!handle) return;
        const data = getForumData();
        const npc = createNpc({ name, handle, permissionRole: 'moderator' });
        npc.profileGenerated = true;
        npc.bio = '社区管理员';
        data.npcs.push(npc);
        await saveForumData(data, true);
        return render({ preserveScroll: true });
    }
    if (action === 'generate-moderator-profiles') {
        if (viewState.moduleBusy.has('moderator-profiles')) return;
        if (!hasActiveChat()) return notify('warning', '请先打开一个角色聊天');
        viewState.moduleBusy.add('moderator-profiles');
        render({ preserveScroll: true });
        try {
            const settings = getSettings();
            const request = buildModeratorProfilesRequest({ settings, sourceContext: await getGenerationSourceContext(), count: 2 });
            const result = await generateForumTextResult(getModuleApiConfig('moderation'), request, { captureTrace: true });
            const profiles = normalizeModeratorProfiles(result.text);
            if (!profiles.length) throw new Error('没有读取到管理员人设');
            const data = getForumData();
            const usedHandles = new Set(data.npcs.map(npc => String(npc.handle || '').toLocaleLowerCase()));
            for (const profile of profiles) {
                let handle = profile.handle;
                let suffix = 2;
                while (usedHandles.has(handle.toLocaleLowerCase())) handle = `${profile.handle}_${suffix++}`;
                usedHandles.add(handle.toLocaleLowerCase());
                const npc = createNpc({ name: profile.name, handle, persona: profile.persona, permissionRole: profile.permissionRole });
                npc.bio = profile.bio;
                npc.profileGenerated = true;
                data.npcs.push(npc);
            }
            await saveForumData(data, true);
            notify('success', `已生成 ${profiles.length} 位管理员；后续不会自动重复生成`);
        } catch (error) {
            notify('error', `管理员人设生成失败：${error.message}`);
        } finally {
            viewState.moduleBusy.delete('moderator-profiles');
            render({ preserveScroll: true });
        }
        return;
    }
    if (action === 'ai-review-report') {
        if (!getSettings().moderation.systemAdminEnabled) return notify('warning', '请先开启系统 AI 管理员');
        return void runWorldModuleGeneration('moderation', { reportId: target.closest('[data-report-id]')?.dataset.reportId });
    }
    if (action === 'dismiss-report' || action === 'manual-remove-report-post') {
        const data = getForumData();
        const report = data.world.reports.find(item => item.id === target.closest('[data-report-id]')?.dataset.reportId);
        const reportedPost = report && data.posts.find(item => item.id === report.postId);
        const reportedComment = report?.commentId ? reportedPost?.comments?.find(item => item.id === report.commentId) : null;
        if (!report) return;
        report.status = action === 'dismiss-report' ? 'dismissed' : 'actioned';
        report.action = action === 'dismiss-report' ? 'none' : 'hide';
        report.decision = action === 'dismiss-report' ? '用户手动驳回' : `用户手动隐藏${reportedComment ? '评论' : '帖子'}`;
        report.updatedAt = Date.now();
        if (reportedPost && action === 'manual-remove-report-post') {
            const reportedTarget = reportedComment || reportedPost;
            reportedTarget.moderation = { hidden: true, action: 'hide', reason: report.reason, warning: '', actorNpcId: '', updatedAt: Date.now() };
        }
        addModuleNotification(data, 'moderation', action === 'dismiss-report' ? '一条举报已被驳回' : `举报处理完成，相关${reportedComment ? '评论' : '帖子'}已隐藏`, { actorName: '社区管理', moduleId: 'moderation', itemId: report.id, postId: report.postId });
        await saveForumData(data, true);
        syncInjection();
        return render();
    }
    if (action === 'resolve-proposal') {
        const data = getForumData();
        const proposal = data.world.proposals.find(item => item.id === target.closest('[data-proposal-id]')?.dataset.proposalId);
        if (proposal) {
            const accepted = target.dataset.accepted === 'true';
            applyModerationProposal(data, getSettings(), proposal, accepted);
            addModuleNotification(data, 'moderation', accepted ? `已执行管理操作：${proposal.title}` : `已拒绝管理操作：${proposal.title}`, { actorName: '社区管理', moduleId: 'moderation', itemId: proposal.id });
        }
        await saveForumData(data, true);
        syncInjection();
        return render();
    }
    if (action === 'open-post' && post) { viewState.selectedPostId = postId; viewState.publicNpcId = ''; viewState.replyTarget = null; return render(); }
    if (action === 'toggle-post-menu' && post) { viewState.openPostMenuId = viewState.openPostMenuId === postId ? '' : postId; return render(); }
    if (action === 'like-post' && post) { post.likedByUser = !post.likedByUser; post.likes = Math.max(0, Number(post.likes || 0) + (post.likedByUser ? 1 : -1)); await saveForumData(getForumData()); return render(); }
    if (action === 'favorite-post' && post) { post.favorite = !post.favorite; viewState.openPostMenuId = ''; await saveForumData(getForumData(), true); return render(); }
    if (action === 'toggle-post-image-editor' && post) {
        viewState.openPostImageEditorId = viewState.openPostImageEditorId === post.id ? '' : post.id;
        return render();
    }
    if (action === 'save-post-image-prompt' && post) {
        const value = target.closest('.tf-post')?.querySelector('.tf-post-image-prompt-input')?.value?.trim() || '';
        if (!value) return notify('warning', '请先填写配图画面描述');
        post.imagePrompt = value;
        viewState.openPostImageEditorId = '';
        await saveForumData(getForumData(), true);
        if (hasUsableImageApi()) return void runImageGeneration(post.id);
        return render();
    }
    if (action === 'quote-post' && post) {
        const quote = window.prompt('写下引用内容；留空则直接转发：', '') ?? null;
        if (quote === null) return;
        const profile = getSettings().profile;
        const data = getForumData();
        data.posts.push(createManualPost({ author: getMyDisplayName(), handle: profile.handle || 'me', content: quote.trim() || `转发了 @${post.handle} 的帖子`, repostOf: post.id, quoteText: `${post.author}：${post.content}`, tags: post.tags || [] }));
        post.reposts = Number(post.reposts || 0) + 1;
        await saveForumData(data, true);
        return render();
    }
    if (action === 'vote-poll' && post?.poll) {
        const option = post.poll.options.find(item => item.id === target.dataset.optionId);
        if (!option || post.poll.closed) return;
        if (!post.poll.multiple) for (const item of post.poll.options) { if (item.votedByUser) { item.votedByUser = false; item.votes = Math.max(0, Number(item.votes || 0) - 1); } }
        option.votedByUser = !option.votedByUser;
        option.votes = Math.max(0, Number(option.votes || 0) + (option.votedByUser ? 1 : -1));
        await saveForumData(getForumData(), true);
        return render();
    }
    if (action === 'like-comment' && post) {
        const comment = post.comments.find(item => item.id === target.dataset.commentId);
        if (!comment) return;
        comment.likedByUser = !comment.likedByUser;
        comment.likes = Math.max(0, Number(comment.likes || 0) + (comment.likedByUser ? 1 : -1));
        await saveForumData(getForumData());
        return render();
    }
    if (action === 'toggle-comments' && post) { viewState.selectedPostId = postId; return render(); }
    if (action === 'start-reply' && post) { viewState.replyTarget = { postId, commentId: target.dataset.commentId || '', handle: target.dataset.replyHandle || post.handle }; viewState.selectedPostId = postId; return render(); }
    if (action === 'submit-reply' && post) {
        try {
            const card = target.closest('.tf-post');
            const reply = createManualComment({ author: card.querySelector('.tf-reply-author')?.value, handle: card.querySelector('.tf-reply-handle')?.value, content: card.querySelector('.tf-reply-content')?.value, imagePrompt: card.querySelector('.tf-reply-image-prompt')?.value, replyTo: viewState.replyTarget?.postId === postId ? viewState.replyTarget.handle : post.handle, parentId: viewState.replyTarget?.postId === postId ? viewState.replyTarget.commentId : '' });
            post.comments.push(reply);
            viewState.replyTarget = null;
            await saveForumData(getForumData(), true);
            syncInjection();
            return void runThreadContinuation(postId, reply);
        } catch (error) { notify('warning', error.message); return; }
    }
    if (action === 'toggle-post-injection' && post) { post.selectedForInjection = !post.selectedForInjection; viewState.openPostMenuId = ''; await saveForumData(getForumData()); syncInjection(); return render(); }
    if (action === 'generate-image' && post) return void runImageGeneration(postId);
    if (action === 'generate-comment-image' && post) return void runCommentImageGeneration(postId, target.dataset.commentId);
    if (action === 'generate-thread-replies' && post) return void runThreadContinuation(postId, null);
    if (action === 'delete-post' && post) {
        if (!window.confirm(post.favorite ? '这是收藏帖，仍要永久删除吗？' : '确定删除这篇帖子吗？')) return;
        const data = getForumData();
        data.posts = data.posts.filter(item => item.id !== postId);
        if (viewState.selectedPostId === postId) viewState.selectedPostId = '';
        viewState.openPostMenuId = '';
        await removePostImages([post]);
        await saveForumData(data, true);
        syncInjection();
        return render();
    }

    if (action === 'new-api-profile') {
        const name = window.prompt('新 API 配置名称：', '新的独立 API')?.trim();
        if (!name) return;
        createApiProfile(name, true);
        return render();
    }
    if (action === 'rename-api-profile') {
        const profile = getActiveApiProfile();
        const name = window.prompt('重命名 API 配置：', profile.name)?.trim();
        if (name && !renameApiProfile(profile.id, name)) notify('warning', '内置配置不能重命名');
        return render();
    }
    if (action === 'delete-api-profile') {
        const profile = getActiveApiProfile();
        if (!window.confirm(`确定删除“${profile.name}”吗？`)) return;
        try { deleteApiProfile(profile.id); } catch (error) { notify('warning', error.message); }
        return render();
    }
    if (action === 'fetch-api-models') {
        const kind = target.dataset.apiKind === 'image' ? 'image' : 'text';
        const profile = getActiveApiProfile();
        const key = `${profile.id}:${kind}`;
        if (viewState.apiModelBusy.has(key)) return;
        dismissApiModelKeyboard();
        viewState.apiModelBusy.add(key);
        render({ preserveScroll: true });
        try {
            const models = await fetchAvailableModels(getApiConfig(kind));
            viewState.apiModels.set(key, models);
            notify('success', `已读取 ${models.length} 个模型，仍可手动输入其他名称`);
        } catch (error) {
            notify('warning', error.message);
        } finally {
            viewState.apiModelBusy.delete(key);
            render({ preserveScroll: true });
            dismissApiModelKeyboard();
        }
        return;
    }
    if (action === 'refresh-world-info') return void refreshWorldCatalog(true);
    if (action === 'open-world-book') {
        const bookName = target.dataset.book || '';
        const book = viewState.worldCatalog.find(item => item.name === bookName);
        if (!book) return;
        getSettings().sources.worldInfoBooks[bookName] = true;
        book.enabled = true;
        saveSettings();
        return render();
    }
    if (action === 'select-world-book' || action === 'clear-world-book') {
        const book = viewState.worldCatalog.find(item => item.name === target.dataset.book);
        if (!book) return;
        for (const entry of book.entries) {
            entry.selected = action === 'select-world-book' ? !entry.disabledInSillyTavern : false;
            getSettings().sources.worldInfoEntries[entry.key] = entry.selected;
        }
        saveSettings();
        return render();
    }
    if (action === 'cleanup-now') {
        const data = getForumData();
        const removed = await enforcePostRetention(data, true);
        await saveForumData(data, true);
        syncInjection();
        notify('success', removed ? `已清理 ${removed} 篇旧帖` : '当前无需清理');
        return render();
    }
    if (action === 'toggle-prompt-editor') {
        const entryId = target.dataset.entryId;
        if (viewState.openPromptEntries.has(entryId)) viewState.openPromptEntries.delete(entryId);
        else viewState.openPromptEntries.add(entryId);
        return render({ preserveScroll: true });
    }
    if (action === 'move-read-order') {
        if (moveForumReadOrderByStep(target.dataset.readOrderId, target.dataset.direction)) return render({ preserveScroll: true });
        return;
    }
    if (action === 'add-prompt-entry') {
        const entryId = createId('prompt');
        const settings = getSettings();
        settings.promptEntries.push({ id: entryId, title: '新设定', enabled: true, constant: false, keywords: [], role: 'system', content: '' });
        const generationIndex = settings.sources.promptOrder.indexOf('builtin:generation');
        settings.sources.promptOrder.splice(generationIndex < 0 ? settings.sources.promptOrder.length : generationIndex, 0, `forum:${entryId}`);
        viewState.openPromptEntries.add(`inactive:${entryId}`);
        saveSettings();
        return render();
    }
    if (action === 'delete-prompt-entry') { if (window.confirm('确定删除这条论坛设定吗？')) { const settings = getSettings(); viewState.openPromptEntries.delete(target.dataset.entryId); viewState.openPromptEntries.delete(`inactive:${target.dataset.entryId}`); settings.promptEntries = settings.promptEntries.filter(entry => entry.id !== target.dataset.entryId); settings.sources.promptOrder = settings.sources.promptOrder.filter(id => id !== `forum:${target.dataset.entryId}`); saveSettings(); render(); } return; }
    if (action === 'export-prompts') {
        return downloadJson('tavern-forum-prompts.json', buildForumPromptPresetExport(getSettings()));
    }
    if (action === 'import-prompts') return getRoot().querySelector('#tf-import-prompts-file')?.click();
    if (action === 'export-forum') return downloadJson(`tavern-forum-${Date.now()}.json`, getForumData());
    if (action === 'import-forum') return getRoot().querySelector('#tf-import-forum-file')?.click();
    if (action === 'import-css') return getRoot().querySelector('#tf-import-css-file')?.click();
    if (action === 'clear-css') { getSettings().appearance.customCss = ''; getSettings().appearance.customCssCleared = true; saveSettings(); applyAppearance(); return render(); }
    if (action === 'load-builtin-css' || action === 'restore-standard-css') {
        const appearance = getSettings().appearance;
        const currentCss = getEffectiveCustomCss(appearance);
        if (currentCss.trim() && currentCss !== BUILTIN_CUSTOM_CSS_TEMPLATE && !window.confirm('恢复模板会替换当前自定义 CSS，确定继续吗？')) return;
        appearance.customCss = BUILTIN_CUSTOM_CSS_TEMPLATE;
        appearance.customCssCleared = false;
        saveSettings();
        applyAppearance();
        return render();
    }
    if (action === 'clear-data') { if (window.confirm('这会清空微坛设置和当前聊天数据，且无法撤销。确定继续吗？')) { await clearAllData(); notify('success', '微坛数据已清空'); render(); } }
}

let draggedReadOrderId = '';
let promptPointerDrag = null;

function clearPromptDragState(root = getRoot()) {
    root?.querySelectorAll('.tf-prompt-entry.is-dragging, .tf-prompt-entry.is-drop-before, .tf-prompt-entry.is-drop-after').forEach(entry => {
        entry.classList.remove('is-dragging', 'is-drop-before', 'is-drop-after');
        delete entry.dataset.dropPlacement;
    });
}

function handleRootDragStart(event) {
    const handle = event.target.closest('[data-read-order-drag-id]');
    if (!handle) return;
    draggedReadOrderId = handle.dataset.readOrderDragId || '';
    if (!draggedReadOrderId) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', draggedReadOrderId);
    handle.closest('.tf-prompt-entry')?.classList.add('is-dragging');
}

function handleRootDragOver(event) {
    if (!draggedReadOrderId) return;
    const entry = event.target.closest('.tf-prompt-entry[data-read-order-id]');
    if (!entry || entry.dataset.readOrderId === draggedReadOrderId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const placement = event.clientY >= entry.getBoundingClientRect().top + entry.getBoundingClientRect().height / 2 ? 'after' : 'before';
    clearPromptDragState();
    getRoot()?.querySelector(`.tf-prompt-entry[data-read-order-id="${CSS.escape(draggedReadOrderId)}"]`)?.classList.add('is-dragging');
    entry.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
    entry.dataset.dropPlacement = placement;
}

function handleRootDrop(event) {
    if (!draggedReadOrderId) return;
    const entry = event.target.closest('.tf-prompt-entry[data-read-order-id]');
    if (!entry || entry.dataset.readOrderId === draggedReadOrderId) return clearPromptDragState();
    event.preventDefault();
    const sourceId = draggedReadOrderId;
    const placement = entry.dataset.dropPlacement || 'before';
    draggedReadOrderId = '';
    clearPromptDragState();
    if (moveForumReadOrderItem(sourceId, entry.dataset.readOrderId, placement)) render({ preserveScroll: true });
}

function handleRootDragEnd() {
    draggedReadOrderId = '';
    clearPromptDragState();
}

function handleRootPointerDown(event) {
    const handle = event.target.closest('[data-read-order-drag-id]');
    if (!handle || (event.button !== 0 && event.pointerType !== 'touch')) return;
    promptPointerDrag = {
        id: handle.dataset.readOrderDragId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        handle,
    };
    try { handle.setPointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
}

function handleRootPointerMove(event) {
    if (!promptPointerDrag || promptPointerDrag.pointerId !== event.pointerId) return;
    if (!promptPointerDrag.moved && Math.hypot(event.clientX - promptPointerDrag.startX, event.clientY - promptPointerDrag.startY) < 7) return;
    promptPointerDrag.moved = true;
    event.preventDefault();
    const selector = '.tf-prompt-entry[data-read-order-id]';
    const entry = document.elementFromPoint(event.clientX, event.clientY)?.closest(selector);
    const entryId = entry?.dataset.readOrderId;
    if (!entry || entryId === promptPointerDrag.id) return;
    const box = entry.getBoundingClientRect();
    const placement = event.clientY >= box.top + box.height / 2 ? 'after' : 'before';
    clearPromptDragState();
    const sourceSelector = `.tf-prompt-entry[data-read-order-id="${CSS.escape(promptPointerDrag.id)}"]`;
    getRoot()?.querySelector(sourceSelector)?.classList.add('is-dragging');
    entry.classList.add(placement === 'after' ? 'is-drop-after' : 'is-drop-before');
    entry.dataset.dropPlacement = placement;
}

function handleRootPointerUp(event) {
    if (!promptPointerDrag || promptPointerDrag.pointerId !== event.pointerId) return;
    const drag = promptPointerDrag;
    promptPointerDrag = null;
    try { drag.handle.releasePointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
    const selector = '.tf-prompt-entry[data-read-order-id]';
    const entry = document.elementFromPoint(event.clientX, event.clientY)?.closest(selector);
    const entryId = entry?.dataset.readOrderId;
    const placement = entry?.dataset.dropPlacement || 'before';
    clearPromptDragState();
    const moved = moveForumReadOrderItem(drag.id, entryId, placement);
    if (drag.moved && entry && entryId !== drag.id && moved) {
        render({ preserveScroll: true });
    }
}

function handleRootInput(event) {
    const target = event.target;
    if (target.matches('.tf-search-input')) {
        if (getSettings().ui.activeTab === 'settings') {
            viewState.settingsSearch = target.value;
            const cursor = target.selectionStart;
            render({ preserveScroll: true });
            queueMicrotask(() => { const input = getRoot()?.querySelector('.tf-search-input'); input?.focus(); if (input && Number.isFinite(cursor)) input.setSelectionRange(cursor, cursor); });
        } else {
            viewState.searchQuery = target.value;
            applySearchFilter();
        }
        return;
    }
    if (target.dataset.companionAppearanceField) {
        const companion = getForumData().world.companion;
        const field = target.dataset.companionAppearanceField;
        if (!['bodyColor', 'accentColor', 'accessoryColor', 'accessory'].includes(field)) return;
        const draft = viewState.companionAppearanceDraft || {
            bodyColor: companion.bodyColor || '',
            accentColor: companion.accentColor || '',
            accessoryColor: companion.accessoryColor || '',
            accessory: companion.accessory || 'none',
        };
        draft[field] = target.value;
        viewState.companionAppearanceDraft = draft;
        if (field === 'accessory') return render({ preserveScroll: true });
        const speciesId = getCompanionSpecies(companion.species)?.id || 'mystery';
        getRoot()?.querySelectorAll(`.tf-pixel-pet.is-kind-${speciesId}`).forEach(sprite => {
            if (field === 'bodyColor') sprite.style.setProperty('--pet-body-user', draft.bodyColor);
            if (field === 'accentColor') sprite.style.setProperty('--pet-accent-user', draft.accentColor);
            if (field === 'accessoryColor') sprite.style.setProperty('--pet-accessory-user', draft.accessoryColor);
        });
        const panel = target.closest('.tf-pet-appearance-controls');
        panel?.classList.remove('is-saved');
        panel?.classList.add('is-dirty');
        panel?.querySelector('.tf-pet-appearance-state')?.replaceChildren('正在预览，尚未保存');
        const saveButton = panel?.querySelector('[data-action="save-companion-appearance"]');
        if (saveButton) saveButton.disabled = false;
        return;
    }
    if (target.dataset.secret) { setSessionApiKey(target.dataset.secret, target.value); return; }
    if (target.dataset.apiBodyExclusion) {
        const profile = getActiveApiProfile();
        const excluded = new Set(profile.text.excludedBodyParameters || []);
        if (target.checked) excluded.add(target.dataset.apiBodyExclusion);
        else excluded.delete(target.dataset.apiBodyExclusion);
        profile.text.excludedBodyParameters = [...excluded];
        saveSettings();
        return render({ preserveScroll: true });
    }
    if (target.dataset.profileField) {
        getSettings().profile[target.dataset.profileField] = target.value;
        saveSettings();
        return;
    }
    if (target.dataset.builtinPrompt) {
        getSettings().builtinPrompts[target.dataset.builtinPrompt] = target.value;
        saveSettings();
        if (['mainChatInjection', 'roleInjection'].includes(target.dataset.builtinPrompt)) syncInjection();
        return;
    }
    if (target.dataset.moderationRules !== undefined) {
        getSettings().moderation.communityRules = target.value;
        saveSettings();
        return;
    }
    if (target.dataset.permissionField) {
        const level = getSettings().moderation.permissionLevels.find(item => item.id === target.closest('[data-permission-id]')?.dataset.permissionId);
        if (level) level[target.dataset.permissionField] = target.dataset.permissionField === 'level' ? Number(target.value) : target.value;
        saveSettings();
        return;
    }
    if (target.dataset.viewThemeField) {
        const theme = getSettings().appearance.viewThemes[target.closest('[data-view-theme-id]')?.dataset.viewThemeId];
        if (!theme) return;
        theme[target.dataset.viewThemeField] = target.value;
        if (target.dataset.viewThemeField === 'wallpaperUrl') theme.wallpaperKey = '';
        saveSettings();
        applyAppearance();
        return;
    }
    if (target.dataset.appearance) {
        const field = target.dataset.appearance;
        getSettings().appearance[field] = target.value;
        if (field === 'customCss') getSettings().appearance.customCssCleared = false;
        saveSettings();
        applyAppearance();
        if (field === 'forumName') getRoot().querySelectorAll('.tf-brand-name').forEach(element => { element.textContent = target.value || '微坛'; });
        if (target.type === 'color') target.parentElement?.querySelector('code')?.replaceChildren(target.value);
        return;
    }
    if (target.dataset.appearanceNumber) {
        const field = target.dataset.appearanceNumber;
        const value = Number(target.value);
        const opacityField = field === 'postOpacity' || field === 'commentOpacity' || field === 'cardOpacity';
        getSettings().appearance[field] = opacityField
            ? Math.min(1, Math.max(0.2, value))
            : Math.min(40, Math.max(0, value));
        const output = target.parentElement?.querySelector('output');
        if (output) output.textContent = opacityField ? `${Math.round(value * 100)}%` : `${Math.round(value)}px`;
        saveSettings();
        applyAppearance();
        return;
    }
    if (target.dataset.npcField) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (!npc) return;
        npc[target.dataset.npcField] = target.value;
        if (target.dataset.npcField === 'persona' && target.value.trim()) npc.profileGenerated = true;
        npc.updatedAt = Date.now();
        void saveForumData(getForumData());
        if (target.dataset.npcField === 'persona') syncInjection();
        return;
    }
    if (target.dataset.npcMemoryField || target.dataset.npcMemoryArray) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (!npc) return;
        if (target.dataset.npcMemoryArray) npc.memory[target.dataset.npcMemoryArray] = target.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
        else if (target.dataset.npcMemoryField === 'relationshipScore') npc.memory.relationshipScore = Math.min(100, Math.max(-100, Number(target.value || 0)));
        else npc.memory[target.dataset.npcMemoryField] = target.value;
        npc.updatedAt = Date.now();
        void saveForumData(getForumData());
        return;
    }
    if (target.dataset.factContent !== undefined) {
        const fact = getForumData().facts.find(item => item.id === target.closest('[data-fact-id]')?.dataset.factId);
        if (fact) { fact.content = target.value; fact.updatedAt = Date.now(); void saveForumData(getForumData()); }
        return;
    }
    const entryElement = target.closest('[data-entry-id]');
    if (entryElement && target.dataset.entryField) {
        const entry = getSettings().promptEntries.find(item => item.id === entryElement.dataset.entryId);
        if (!entry) return;
        const field = target.dataset.entryField;
        if (field === 'keywords') entry.keywords = target.value.split(/[,，\n]/).map(value => value.trim()).filter(Boolean);
        else if (field === 'order') entry.order = Number(target.value || 0);
        else entry[field] = target.value;
        saveSettings();
    }
}

function handleRootChange(event) {
    const target = event.target;
    if (target.dataset.companionAppearanceField) {
        handleRootInput(event);
        return;
    }
    if (target.dataset.permissionCapability && target.type === 'checkbox') {
        const level = getSettings().moderation.permissionLevels.find(item => item.id === target.closest('[data-permission-id]')?.dataset.permissionId);
        if (level) level[target.dataset.permissionCapability] = target.checked;
        saveSettings();
        return;
    }
    if (target.dataset.entryField) {
        handleRootInput(event);
        return;
    }
    if (target.dataset.action?.startsWith('toggle-') && target.type === 'checkbox') {
        if (target.dataset.action === 'toggle-world-module' || target.dataset.action === 'toggle-module-linked' || target.dataset.action === 'toggle-module-injection') {
            const module = getSettings().modules[target.dataset.moduleId];
            if (!module) return;
            const field = target.dataset.action === 'toggle-world-module' ? 'enabled' : target.dataset.action === 'toggle-module-linked' ? 'joinGeneration' : 'injectIntoChat';
            if (field === 'injectIntoChat' && target.dataset.moduleId === 'forum') getSettings().injection.enabled = target.checked;
            else module[field] = target.checked;
            saveSettings();
            syncInjection();
            return render({ preserveScroll: true });
        }
        if (target.dataset.action === 'toggle-view-theme-inherit') {
            const theme = getSettings().appearance.viewThemes[target.dataset.viewId];
            if (theme) theme.inherit = target.checked;
            saveSettings();
            return render({ preserveScroll: true });
        }
        if (target.dataset.permissionCapability) {
            const level = getSettings().moderation.permissionLevels.find(item => item.id === target.closest('[data-permission-id]')?.dataset.permissionId);
            if (level) level[target.dataset.permissionCapability] = target.checked;
            saveSettings();
            return;
        }
        if (target.dataset.action === 'toggle-world-book') {
            const bookName = target.dataset.book || '';
            if (!bookName) return;
            getSettings().sources.worldInfoBooks[bookName] = target.checked;
            const book = viewState.worldCatalog.find(item => item.name === bookName);
            if (book) book.enabled = target.checked;
            saveSettings();
            return render({ preserveScroll: true });
        }
        if (target.dataset.action === 'toggle-prompt-entry' || target.dataset.action === 'toggle-prompt-constant') {
            const entry = getSettings().promptEntries.find(item => item.id === target.closest('[data-entry-id]')?.dataset.entryId);
            if (entry) entry[target.dataset.action === 'toggle-prompt-entry' ? 'enabled' : 'constant'] = target.checked;
            saveSettings();
            return render({ preserveScroll: true });
        }
        if (target.dataset.action === 'toggle-npc-injection') {
            const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
            if (npc) { npc.inject = target.checked; void saveForumData(getForumData()); syncInjection(); }
            return render({ preserveScroll: true });
        }
        if (target.dataset.action === 'toggle-role-follows-user') {
            const data = getForumData();
            const npc = data.npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
            if (npc) {
                const wasMutual = npc.followsUser && npc.followedByUser;
                npc.followsUser = target.checked;
                const type = npc.followsUser && npc.followedByUser ? 'mutual' : 'follow';
                const preferences = getSettings().notifications;
                if (npc.followsUser && !wasMutual && preferences[type]) data.notifications.unshift(createNotification({ type, actorNpcId: npc.id, actorName: npc.name, content: type === 'mutual' ? `${npc.name} 与你互相关注了` : `${npc.name} 关注了你` }));
                void saveForumData(data, true);
            }
            return render({ preserveScroll: true });
        }
        if (target.dataset.action === 'toggle-role-muted' || target.dataset.action === 'toggle-role-blocked') {
            const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
            if (!npc) return;
            const kind = target.dataset.action === 'toggle-role-muted' ? 'muted' : 'blocked';
            void setRoleModeration(npc.id, kind, target.checked).then(() => render({ preserveScroll: true }));
            return;
        }
        if (target.dataset.action === 'toggle-fact-publishable') {
            const fact = getForumData().facts.find(item => item.id === target.closest('[data-fact-id]')?.dataset.factId);
            if (fact) { fact.publishable = target.checked; fact.updatedAt = Date.now(); void saveForumData(getForumData(), true); }
            return render({ preserveScroll: true });
        }
        return handleSwitchAction(target.dataset.action, target.checked);
    }
    if (target.dataset.moduleField) {
        const module = getSettings().modules[target.closest('[data-module-id]')?.dataset.moduleId];
        if (!module) return;
        const numeric = ['probability', 'cooldownMinutes', 'travelMinMinutes', 'travelMaxMinutes', 'travelMessageMinMinutes', 'travelMessageMaxMinutes'].includes(target.dataset.moduleField);
        module[target.dataset.moduleField] = numeric ? Number(target.value) : target.value;
        if (target.dataset.moduleField === 'generationMode') module.joinGeneration = target.value === 'linked';
        saveSettings();
        return render({ preserveScroll: true });
    }
    if (target.dataset.companionAutoAccessory !== undefined) {
        const companion = getForumData().world.companion;
        companion.autoAccessory = target.checked;
        companion.updatedAt = Date.now();
        void saveForumData(getForumData(), true);
        return render({ preserveScroll: true });
    }
    if (target.dataset.companionEnvironment) {
        const companion = getForumData().world.companion;
        const field = target.dataset.companionEnvironment;
        const allowed = field === 'weather'
            ? ['auto', 'sunny', 'cloudy', 'rain', 'wind', 'snow']
            : field === 'timeOfDay' ? ['auto', 'dawn', 'day', 'dusk', 'night']
                : field === 'habitat' ? COMPANION_HABITATS.map(item => item.id) : [];
        if (!allowed.includes(target.value)) return;
        companion[field] = target.value;
        if (field === 'habitat') {
            const habitat = COMPANION_HABITATS.find(item => item.id === target.value);
            companion.lastAction = 'hide';
            companion.message = `${companion.name}在${habitat?.name || '新小窝'}里四处看了看，挑中了最喜欢的位置。`;
            companion.mood = '好奇';
        } else {
            const [reaction, mood] = getCompanionWeatherReaction(getForumData());
            companion.lastAction = 'weather';
            companion.message = reaction;
            companion.mood = mood;
        }
        companion.updatedAt = Date.now();
        void saveForumData(getForumData(), true);
        return render({ preserveScroll: true });
    }
    if (target.dataset.companionField) {
        const companion = getForumData().world.companion;
        const field = target.dataset.companionField;
        const value = target.value.trim();
        if (field === 'avatarUrl' && value && !isSafeImageUrl(value)) return notify('warning', '请填写有效的 http/https 图片直链');
        companion[field] = value;
        companion.updatedAt = Date.now();
        void saveForumData(getForumData(), true);
        syncInjection();
        return render({ preserveScroll: true });
    }
    if (target.dataset.orchestrationField) {
        getSettings().orchestration[target.dataset.orchestrationField] = target.value;
        saveSettings();
        return;
    }
    if (target.dataset.action === 'select-api-profile') { setActiveApiProfile(target.value); return render(); }
    if (target.dataset.apiModelChoice) {
        const kind = target.dataset.apiModelChoice === 'image' ? 'image' : 'text';
        if (!target.value) return;
        updateApiConfig(kind, 'model', target.value);
        dismissApiModelKeyboard();
        return render({ preserveScroll: true });
    }
    if (target.dataset.apiSetting) {
        const [kind, field] = target.dataset.apiSetting.split('.');
        const current = getApiConfig(kind)[field];
        updateApiConfig(kind, field, typeof current === 'number' ? Number(target.value) : target.value);
        return;
    }
    if (target.dataset.npcAvatar !== undefined) {
        const data = getForumData();
        const npc = data.npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        const item = getSettings().avatarLibrary.find(entry => entry.id === target.value);
        if (npc && item) { updateNpcAvatar(npc, { url: item.url, imageKey: item.imageKey, avatarId: item.id }); void saveForumData(data); render(); }
        return;
    }
    if (target.dataset.npcAvatarUrl !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        const url = target.value.trim();
        if (url && !isSafeImageUrl(url)) return notify('warning', '请填写有效的 http/https 图片直链');
        if (npc) { void removeImageAsset(npc.avatarKey); updateNpcAvatar(npc, { url }); void saveForumData(getForumData(), true); render(); }
        return;
    }
    if (target.dataset.npcBackgroundUrl !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        const url = target.value.trim();
        if (url && !isSafeImageUrl(url)) return notify('warning', '请填写有效的 http/https 图片直链');
        if (npc) {
            void removeImageAsset(npc.backgroundKey);
            npc.backgroundUrl = url;
            npc.backgroundKey = '';
            npc.updatedAt = Date.now();
            void saveForumData(getForumData(), true);
            render();
        }
        return;
    }
    if (target.dataset.npcBindingType !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (npc) { applyNpcBinding(npc, target.value); void saveForumData(getForumData(), true); render(); }
        return;
    }
    if (target.dataset.npcBindingTarget !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (npc) { applyNpcBinding(npc, npc.bindingType, target.value); void saveForumData(getForumData(), true); render(); }
        return;
    }
    if (target.dataset.npcSocialState !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (npc) {
            const state = ['normal', 'friendly', 'quarrel', 'blocked'].includes(target.value) ? target.value : 'normal';
            void (async () => {
                if (state === 'blocked') await setRoleModeration(npc.id, 'blocked', true);
                else {
                    if (npc.blocked) await setRoleModeration(npc.id, 'blocked', false);
                    npc.socialState = state;
                    await saveForumData(getForumData(), true);
                }
                render();
            })();
        }
        return;
    }
    if (target.dataset.npcPermissionRole !== undefined) {
        const npc = getForumData().npcs.find(item => item.id === target.closest('[data-npc-id]')?.dataset.npcId);
        if (npc) { npc.permissionRole = target.value; npc.updatedAt = Date.now(); void saveForumData(getForumData(), true); render({ preserveScroll: true }); }
        return;
    }
    if (target.dataset.userPermissionRole !== undefined) {
        getSettings().profile.permissionRole = target.value;
        saveSettings();
        return render({ preserveScroll: true });
    }
    if (target.dataset.profileImageUrl) {
        const kind = target.dataset.profileImageUrl;
        const url = target.value.trim();
        if (url && !isSafeImageUrl(url)) return notify('warning', '请填写有效的 http/https 图片直链');
        const profile = getSettings().profile;
        void removeImageAsset(profile[`${kind}Key`]);
        profile[`${kind}Url`] = url;
        profile[`${kind}Key`] = '';
        saveSettings(); render();
        return;
    }
    if (target.dataset.appearanceImageUrl) {
        const kind = target.dataset.appearanceImageUrl;
        const url = target.value.trim();
        if (url && !isSafeImageUrl(url)) return notify('warning', '请填写有效的 http/https 图片直链');
        const appearance = getSettings().appearance;
        void removeImageAsset(appearance[`${kind}Key`]);
        appearance[`${kind}Url`] = url;
        appearance[`${kind}Key`] = '';
        saveSettings();
        render();
        return;
    }
    if (target.dataset.floatingButtonImageUrl !== undefined) {
        const url = target.value.trim();
        if (url && !isSafeImageUrl(url)) return notify('warning', '请填写有效的 http/https 图片直链');
        const ui = getSettings().ui;
        void removeImageAsset(ui.floatingButtonImageKey);
        ui.floatingButtonImageUrl = url;
        ui.floatingButtonImageKey = '';
        saveSettings();
        updateLaunchers();
        render();
        return;
    }
    if (target.dataset.worldEntry) {
        getSettings().sources.worldInfoEntries[target.dataset.worldEntry] = target.checked;
        for (const book of viewState.worldCatalog) {
            const entry = book.entries.find(item => item.key === target.dataset.worldEntry);
            if (entry) entry.selected = target.checked;
        }
        saveSettings();
        return render({ preserveScroll: true });
    }
    if (target.dataset.presetEntry) { getSettings().sources.presetEntries[target.dataset.presetEntry] = target.checked; saveSettings(); return render({ preserveScroll: true }); }
    if (target.dataset.factVisibility !== undefined) {
        const fact = getForumData().facts.find(item => item.id === target.closest('[data-fact-id]')?.dataset.factId);
        if (fact) { fact.visibility = target.value; fact.updatedAt = Date.now(); void saveForumData(getForumData(), true); render(); }
        return;
    }
    if (target.dataset.factKnownRole !== undefined) {
        const fact = getForumData().facts.find(item => item.id === target.dataset.factKnownRole);
        if (fact) {
            const ids = new Set(fact.knownBy || []);
            target.checked ? ids.add(target.dataset.roleId) : ids.delete(target.dataset.roleId);
            fact.knownBy = [...ids];
            fact.updatedAt = Date.now();
            void saveForumData(getForumData(), true);
        }
        return;
    }
    if (target.dataset.worldBoundary !== undefined) {
        const key = target.dataset.worldBoundary;
        const current = getSettings().informationBoundary.worldInfoEntries[key] || { visibility: 'public', knownBy: [] };
        getSettings().informationBoundary.worldInfoEntries[key] = { ...current, visibility: target.value };
        saveSettings();
        return;
    }
    if (target.dataset.worldBoundaryRoles !== undefined) {
        const key = target.dataset.worldBoundaryRoles;
        const data = getForumData();
        const handles = target.value.split(/[,，]/).map(value => value.trim().replace(/^@/, '').toLocaleLowerCase()).filter(Boolean);
        const knownBy = handles.map(handle => data.npcs.find(npc => npc.handle.toLocaleLowerCase() === handle || npc.name.toLocaleLowerCase() === handle)?.id).filter(Boolean);
        const current = getSettings().informationBoundary.worldInfoEntries[key] || { visibility: 'restricted', knownBy: [] };
        getSettings().informationBoundary.worldInfoEntries[key] = { ...current, knownBy: [...new Set(knownBy)] };
        saveSettings();
        render();
        return;
    }
    if (target.dataset.setting) {
        const current = getSettingByPath(target.dataset.setting);
        setSettingByPath(target.dataset.setting, typeof current === 'number' ? Number(target.value) : target.value);
        if (target.dataset.setting === 'ui.worldHomeLayout') return render({ preserveScroll: true });
        return;
    }
    if (target.id === 'tf-import-css-file') {
        void readFile(target).then(text => { if (text === null) return; getSettings().appearance.customCss = text; getSettings().appearance.customCssCleared = false; saveSettings(); applyAppearance(); render(); notify('success', 'CSS 美化已导入'); }).catch(error => notify('error', `CSS 导入失败：${error.message}`));
    }
    if (target.id === 'tf-import-module-file') {
        void readFile(target).then(text => {
            if (text === null) return;
            const payload = JSON.parse(text);
            const moduleId = viewState.pendingModuleImportId;
            if (payload?.format !== 'tavern-forum-module-settings' || payload.moduleId !== moduleId || !payload.settings || typeof payload.settings !== 'object') throw new Error('这不是当前模块的设置文件');
            const definition = getModuleDefinition(moduleId);
            const summary = `模块：${definition?.name || moduleId}\n生成方式：${payload.settings.generationMode || '未填写'}\n正文读取：${payload.settings.injectIntoChat ? '开启' : '关闭'}\n触发概率：${Number(payload.settings.probability ?? 0)}%`;
            if (!window.confirm(`即将导入以下设置（不会导入 API 密钥或模块内容）：\n\n${summary}\n\n继续吗？`)) return;
            const defaults = DEFAULT_SETTINGS.modules[moduleId];
            const allowed = Object.keys(defaults);
            const imported = Object.fromEntries(allowed.filter(key => Object.prototype.hasOwnProperty.call(payload.settings, key)).map(key => [key, payload.settings[key]]));
            getSettings().modules[moduleId] = { ...JSON.parse(JSON.stringify(defaults)), ...imported };
            const promptId = moduleId === 'tasks' ? 'task' : moduleId;
            if (typeof payload.builtinPrompt === 'string' && promptId in DEFAULT_BUILTIN_PROMPTS) getSettings().builtinPrompts[promptId] = payload.builtinPrompt;
            const notificationKey = { tasks: 'tasks', travel: 'companion', health: 'health', moderation: 'moderation' }[moduleId] || 'system';
            if (typeof payload.notificationEnabled === 'boolean') getSettings().notifications[notificationKey] = payload.notificationEnabled;
            viewState.pendingModuleImportId = '';
            saveSettings();
            syncInjection();
            render();
            notify('success', `已导入“${definition?.name || moduleId}”设置`);
        }).catch(error => notify('error', `模块设置导入失败：${error.message}`));
        return;
    }
    if (['tf-import-profile-avatar-file', 'tf-import-profile-background-file', 'tf-import-avatar-library-file', 'tf-import-npc-avatar-file', 'tf-import-npc-background-file', 'tf-import-floating-button-file', 'tf-import-brand-icon-file', 'tf-import-forum-wallpaper-file', 'tf-import-view-wallpaper-file'].includes(target.id)) {
        void (async () => {
            const asset = await readImageAsset(target, target.id.replace('tf-import-', '').replace('-file', ''));
            if (!asset) return;
            if (target.id === 'tf-import-floating-button-file') {
                const ui = getSettings().ui;
                await removeImageAsset(ui.floatingButtonImageKey);
                ui.floatingButtonImageUrl = asset.url;
                ui.floatingButtonImageKey = asset.imageKey;
                saveSettings();
                updateLaunchers();
            } else if (target.id === 'tf-import-brand-icon-file' || target.id === 'tf-import-forum-wallpaper-file') {
                const kind = target.id === 'tf-import-brand-icon-file' ? 'brandIcon' : 'wallpaper';
                const appearance = getSettings().appearance;
                await removeImageAsset(appearance[`${kind}Key`]);
                appearance[`${kind}Url`] = asset.url;
                appearance[`${kind}Key`] = asset.imageKey;
                saveSettings();
            } else if (target.id === 'tf-import-view-wallpaper-file') {
                const theme = getSettings().appearance.viewThemes[viewState.pendingViewWallpaperId];
                if (theme) {
                    await removeImageAsset(theme.wallpaperKey);
                    theme.wallpaperUrl = asset.url;
                    theme.wallpaperKey = asset.imageKey;
                    theme.inherit = false;
                    saveSettings();
                }
                viewState.pendingViewWallpaperId = '';
            } else if (target.id === 'tf-import-profile-avatar-file' || target.id === 'tf-import-profile-background-file') {
                const kind = target.id.includes('background') ? 'background' : 'avatar';
                const profile = getSettings().profile;
                await removeImageAsset(profile[`${kind}Key`]);
                profile[`${kind}Url`] = asset.url;
                profile[`${kind}Key`] = asset.imageKey;
                saveSettings();
            } else if (target.id === 'tf-import-avatar-library-file') {
                const name = getRoot().querySelector('#tf-avatar-name')?.value.trim() || asset.name.replace(/\.[^.]+$/, '');
                getSettings().avatarLibrary.push({ id: createId('avatar'), name, url: asset.url, imageKey: asset.imageKey });
                saveSettings();
            } else if (target.id === 'tf-import-npc-avatar-file') {
                const npc = getForumData().npcs.find(item => item.id === viewState.pendingNpcAvatarId);
                if (npc) {
                    await removeImageAsset(npc.avatarKey);
                    updateNpcAvatar(npc, asset);
                    await saveForumData(getForumData(), true);
                }
                viewState.pendingNpcAvatarId = '';
            } else {
                const npc = getForumData().npcs.find(item => item.id === viewState.pendingNpcBackgroundId);
                if (npc) {
                    await removeImageAsset(npc.backgroundKey);
                    npc.backgroundUrl = asset.url;
                    npc.backgroundKey = asset.imageKey;
                    npc.updatedAt = Date.now();
                    await saveForumData(getForumData(), true);
                }
                viewState.pendingNpcBackgroundId = '';
            }
            render();
        })().catch(error => notify('error', `图片导入失败：${error.message}`));
        return;
    }
    if (target.id === 'tf-import-prompts-file') {
        void readFile(target).then(text => {
            if (text === null) return;
            const payload = JSON.parse(text);
            const entries = Array.isArray(payload) ? payload : payload?.promptEntries;
            if (!Array.isArray(entries)) throw new Error('文件中没有 promptEntries');
            const settings = getSettings();
            const importedIdMap = new Map();
            const importedEntries = entries.filter(entry => typeof entry?.content === 'string').map(entry => {
                const id = createId('prompt');
                importedIdMap.set(`forum:${String(entry.id || '')}`, `forum:${id}`);
                return { id, title: String(entry.title || '导入设定'), enabled: entry.enabled !== false, constant: Boolean(entry.constant), keywords: Array.isArray(entry.keywords) ? entry.keywords.map(String) : [], role: ['system', 'user', 'assistant'].includes(entry.role) ? entry.role : 'system', content: entry.content };
            });
            const exportedOrder = Array.isArray(payload?.promptOrder) ? payload.promptOrder.map(String) : [];
            const importedIds = exportedOrder.map(id => importedIdMap.get(id)).filter(Boolean);
            for (const entry of importedEntries) if (!importedIds.includes(`forum:${entry.id}`)) importedIds.push(`forum:${entry.id}`);
            settings.promptEntries.push(...importedEntries);
            const generationIndex = settings.sources.promptOrder.indexOf('builtin:generation');
            settings.sources.promptOrder.splice(generationIndex < 0 ? settings.sources.promptOrder.length : generationIndex, 0, ...importedIds);
            saveSettings(); render();
        }).catch(error => notify('error', `导入失败：${error.message}`));
    }
    if (target.id === 'tf-import-forum-file') {
        void readFile(target).then(async text => {
            if (text === null) return;
            const payload = JSON.parse(text);
            if (!Array.isArray(payload?.posts)) throw new Error('文件中没有 posts');
            const data = { ...payload, version: 10, updatedAt: Date.now() };
            linkNpcAuthors(data);
            await enforcePostRetention(data);
            await saveForumData(data, true);
            syncInjection(); render();
        }).catch(error => notify('error', `导入失败：${error.message}`));
    }
}

function clampFloatingButtonPosition(fab, x, y) {
    const rect = fab.getBoundingClientRect();
    const margin = 8;
    const viewport = window.visualViewport;
    const left = Number(viewport?.offsetLeft || 0);
    const top = Number(viewport?.offsetTop || 0);
    const width = Number(viewport?.width || window.innerWidth);
    const height = Number(viewport?.height || window.innerHeight);
    return {
        x: Math.min(Math.max(left + margin, Number(x) || left + margin), Math.max(left + margin, left + width - rect.width - margin)),
        y: Math.min(Math.max(top + margin, Number(y) || top + margin), Math.max(top + margin, top + height - rect.height - margin)),
    };
}

function applyFloatingButtonPosition(fab, position) {
    const hasPosition = Number.isFinite(Number(position?.x)) && Number.isFinite(Number(position?.y));
    if (!hasPosition || position?.x === null || position?.y === null) {
        fab.style.removeProperty('left');
        fab.style.removeProperty('top');
        fab.style.removeProperty('right');
        fab.style.removeProperty('bottom');
        return;
    }
    const next = clampFloatingButtonPosition(fab, position.x, position.y);
    fab.style.left = `${next.x}px`;
    fab.style.top = `${next.y}px`;
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
}

function installFloatingButtonDrag(fab) {
    let drag = null;
    fab.addEventListener('pointerdown', event => {
        if (event.button !== 0 && event.pointerType !== 'touch') return;
        const rect = fab.getBoundingClientRect();
        drag = { pointerId: event.pointerId, pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top, moved: false };
        try { fab.setPointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
    });
    fab.addEventListener('pointermove', event => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.moved && Math.hypot(dx, dy) < (drag.pointerType === 'touch' ? 12 : 5)) return;
        drag.moved = true;
        fab.classList.add('is-dragging');
        const next = clampFloatingButtonPosition(fab, drag.left + dx, drag.top + dy);
        fab.style.left = `${next.x}px`;
        fab.style.top = `${next.y}px`;
        fab.style.right = 'auto';
        fab.style.bottom = 'auto';
        event.preventDefault();
    });
    const finish = (event, cancelled = false) => {
        if (!drag || drag.pointerId !== event.pointerId) return;
        const touchTap = !cancelled && !drag.moved && drag.pointerType === 'touch';
        if (drag.moved) {
            const rect = fab.getBoundingClientRect();
            getSettings().ui.floatingButtonPosition = { x: Math.round(rect.left), y: Math.round(rect.top) };
            saveSettings();
            fab.dataset.ignoreClickUntil = String(Date.now() + 350);
        }
        fab.classList.remove('is-dragging');
        try { fab.releasePointerCapture(event.pointerId); } catch { /* pointer capture is optional */ }
        drag = null;
        if (touchTap) {
            fab.dataset.ignoreClickUntil = String(Date.now() + 650);
            openForum('home');
        }
    };
    fab.addEventListener('pointerup', finish);
    fab.addEventListener('pointercancel', event => finish(event, true));
}

function updateLaunchers() {
    const settings = getSettings();
    const fab = document.getElementById(FAB_ID);
    if (fab) {
        fab.toggleAttribute('hidden', !settings.ui.floatingButton);
        const customImage = renderStoredImage({ url: settings.ui.floatingButtonImageUrl, imageKey: settings.ui.floatingButtonImageKey, alt: '打开论坛', className: 'tf-floating-button-image' });
        const content = fab.querySelector('span');
        if (content) content.innerHTML = customImage || icon('message');
        applyFloatingButtonPosition(fab, settings.ui.floatingButtonPosition);
    }
    const dot = document.querySelector(`#${MENU_ID} .tf-menu-dot`);
    if (dot) dot.classList.toggle('is-on', settings.injection.enabled);
    const fabDot = fab?.querySelector('i');
    if (fabDot) fabDot.classList.toggle('is-on', settings.injection.enabled);
}

function handleMenuLauncherActivation(event) {
    const source = event.target instanceof Element ? event.target : null;
    if (!source?.closest(`#${MENU_ID}`)) return;
    if (event.type === 'pointerup' && event.pointerType === 'mouse') return;
    const now = Date.now();
    if (now - lastMenuLauncherActivation < 500) return;
    lastMenuLauncherActivation = now;
    openForum('home');
}

function installMenuLauncherCapture() {
    if (launcherCaptureInstalled) return;
    launcherCaptureInstalled = true;
    document.addEventListener('click', handleMenuLauncherActivation, true);
    document.addEventListener('pointerup', handleMenuLauncherActivation, true);
    document.addEventListener('touchend', handleMenuLauncherActivation, { capture: true, passive: true });
}

function installLaunchers() {
    if (!floatingViewportListenerInstalled && window.visualViewport) {
        floatingViewportListenerInstalled = true;
        window.visualViewport.addEventListener('resize', updateLaunchers, { passive: true });
        window.visualViewport.addEventListener('scroll', updateLaunchers, { passive: true });
    }
    if (!document.getElementById(MENU_ID)) {
        const menu = document.getElementById('extensionsMenu');
        if (menu) {
            const item = document.createElement('div');
            item.id = MENU_ID;
            item.className = 'list-group-item flex-container flexGap5 interactable tavern-forum-launcher';
            item.tabIndex = 0;
            item.setAttribute('role', 'listitem');
            item.innerHTML = `${icon('message')}<span>打开微坛</span><i class="tf-menu-dot"></i>`;
            const container = document.createElement('div');
            container.className = 'extension_container tavern-forum-menu-container';
            container.append(item);
            menu.append(container);
        }
    }
    if (!document.getElementById(FAB_ID)) {
        const fab = document.createElement('button');
        fab.id = FAB_ID;
        fab.type = 'button';
        fab.title = '打开微坛';
        fab.innerHTML = `<span>${icon('message')}</span><i></i>`;
        fab.addEventListener('error', hideBrokenStoredImage, true);
        installFloatingButtonDrag(fab);
        fab.addEventListener('click', event => {
            if (Number(fab.dataset.ignoreClickUntil || 0) > Date.now()) {
                event.preventDefault();
                return;
            }
            openForum('home');
        });
        document.body.append(fab);
    }
    if (!document.getElementById(SETTINGS_BLOCK_ID)) {
        const panel = document.getElementById('extensions_settings2');
        if (panel) {
            const block = document.createElement('div');
            block.id = SETTINGS_BLOCK_ID;
            block.className = 'extension_container';
            block.innerHTML = '<div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>微坛 · 故事社交</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content"><p>故事世界动态、私信与角色社交。</p><button type="button" class="menu_button">打开微坛</button></div></div>';
            block.querySelector('button').addEventListener('click', () => openForum('me'));
            panel.append(block);
        }
    }
    updateLaunchers();
}

function openForum(tab = '') {
    try {
        if (tab) {
            const settings = getSettings();
            settings.ui.activeTab = ['home', 'services', 'messages', 'me', 'settings'].includes(tab) ? tab : 'home';
            if (settings.ui.activeTab === 'me') settings.ui.meSection = 'overview';
        }
        viewState.open = true;
        render();
    } catch (error) {
        viewState.open = false;
        console.error('[微坛] 打开界面失败', error);
        globalThis.toastr?.error?.(`微坛打开失败：${error?.message || error}`);
    }
}

function closeForum() {
    viewState.open = false;
    render();
}

function bindSillyTavernEvents() {
    const context = globalThis.SillyTavern.getContext();
    const refresh = () => { syncInjection(); if (viewState.open) render(); };
    const cancelAutoRefresh = () => {
        if (viewState.autoRefreshTimer) window.clearTimeout(viewState.autoRefreshTimer);
        viewState.autoRefreshTimer = 0;
    };
    if (context.eventTypes?.CHAT_CHANGED) context.eventSource.on(context.eventTypes.CHAT_CHANGED, () => { cancelAutoRefresh(); viewState.selectedNpcId = ''; viewState.publicNpcId = ''; viewState.selectedPostId = ''; viewState.selectedConversationId = ''; viewState.replyTarget = null; viewState.expandedComments.clear(); refresh(); });
    if (context.eventTypes?.MESSAGE_RECEIVED) context.eventSource.on(context.eventTypes.MESSAGE_RECEIVED, (_messageId, type) => {
        if (type === 'first_message' || !getSettings().generation.autoRefreshOnMessage || !getSettings().modules.forum.enabled || !hasActiveChat()) return;
        cancelAutoRefresh();
        const scheduledChatId = getChatSnapshot().chatId;
        viewState.autoRefreshTimer = window.setTimeout(() => {
            viewState.autoRefreshTimer = 0;
            if (!getSettings().generation.autoRefreshOnMessage || getChatSnapshot().chatId !== scheduledChatId || viewState.busy) return;
            void runGeneration({ automatic: true });
        }, 900);
    });
    if (context.eventTypes?.MESSAGE_EDITED) context.eventSource.on(context.eventTypes.MESSAGE_EDITED, refresh);
    if (context.eventTypes?.MESSAGE_DELETED) context.eventSource.on(context.eventTypes.MESSAGE_DELETED, refresh);
    if (context.eventTypes?.WORLDINFO_UPDATED) context.eventSource.on(context.eventTypes.WORLDINFO_UPDATED, () => { viewState.worldCatalog = []; });
}

export async function initializeForumUi() {
    if (viewState.initialized) return;
    let root = getRoot();
    if (!root) {
        root = document.createElement('div');
        root.id = ROOT_ID;
        root.hidden = true;
        root.addEventListener('click', event => void handleRootClick(event));
        root.addEventListener('input', handleRootInput);
        root.addEventListener('change', handleRootChange);
        root.addEventListener('dragstart', handleRootDragStart);
        root.addEventListener('dragover', handleRootDragOver);
        root.addEventListener('drop', handleRootDrop);
        root.addEventListener('dragend', handleRootDragEnd);
        root.addEventListener('pointerdown', handleRootPointerDown);
        root.addEventListener('pointermove', handleRootPointerMove);
        root.addEventListener('pointerup', handleRootPointerUp);
        root.addEventListener('pointercancel', handleRootPointerUp);
        root.addEventListener('error', hideBrokenStoredImage, true);
        root.addEventListener('submit', event => event.preventDefault());
        document.body.append(root);
    }
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && viewState.open) closeForum(); });
    window.addEventListener('resize', updateLaunchers);
    installMenuLauncherCapture();
    installLaunchers();
    bindSillyTavernEvents();
    const data = getForumData();
    const beforeTaskMessages = data.conversations.reduce((sum, conversation) => sum + conversation.messages.filter(message => message.taskId).length, 0);
    for (const task of data.world.tasks) ensureTaskDelivery(data, task, { notifyUser: false });
    const afterTaskMessages = data.conversations.reduce((sum, conversation) => sum + conversation.messages.filter(message => message.taskId).length, 0);
    if (afterTaskMessages !== beforeTaskMessages) await saveForumData(data, true);
    startCompanionJourneyClock();
    viewState.initialized = true;
    render();
}

export function refreshForumUi() {
    if (viewState.initialized) render();
}
