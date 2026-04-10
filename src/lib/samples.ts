export const createDeepNestedSample = (_lang: string): string => {
  let value = "depth-limit demo";
  for (let i = 10000; i >= 1; i--) {
    value = `=bold<L${i}: ${value}>=`;
  }
  return value;
};

export const createLargeSample = (): string => {
  const fragments = [
    "这是一段普通文本。",
    "=bold<加粗文字>=",
    "=italic<斜体文字>=",
    "=link<https://example.com | 链接>=",
    "=ruby<漢字 | かんじ>=",
    "中间穿插一些 =bold<重要>= 的内容和 =italic<强调>= 的文字。",
    "=warn<提示 | info | v1>*\n这是一个块级警告，里面可以有 =bold<加粗>= 和 =link<https://example.com | 链接>=。\n*",
    '=code<js | example>%\nconst x = Math.random();\nconsole.log(x);\n%',
    "然后再来一些 =ruby<東京 | とうきょう>= 和 =ruby<大阪 | おおさか>=。",
    "=bold<嵌套 =italic<斜体>= 结束>=",
  ];
  const lines: string[] = [];
  for (let i = 0; i < 200; i++) {
    lines.push(`段落 ${i + 1}：${fragments[i % fragments.length]}`);
    if (i % 5 === 4) lines.push("");
  }
  return lines.join("\n");
};

export const randomSnippets: readonly string[] = [
  "=bold<随机加粗>=",
  "=italic<随机斜体>=",
  "=link<https://example.com | 随机链接>=",
  "=ruby<漢字 | かんじ>=",
  "随机纯文本片段",
  "=warn<随机提示 | tag>=",
  "=bold<=italic<加粗斜体>==>=",
];
