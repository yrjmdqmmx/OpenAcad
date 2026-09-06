# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cpu4.spec.ts >> 常规示例样式更新响应时间
- Location: ../../../../../../private/var/folders/j9/mr21v8tx3nqf_yd0sfxvvrk80000gn/T/openacad-profile-p6yldcnr/cpu4.spec.ts:27:5

# Error details

```
Error: bar 第 1 次测量失败

expect(received).toBeUndefined()

Received: "未在 5 秒内观察到输入、SVG 标题更新及后续绘制帧"
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - link "OpenAcad 开放学术" [ref=e4] [cursor=pointer]:
      - /url: "#catalog"
    - navigation [ref=e5]:
      - link "模板库" [ref=e6] [cursor=pointer]:
        - /url: "#catalog"
      - link "本机项目" [ref=e7] [cursor=pointer]:
        - /url: "#projects"
      - link "帮助中心" [ref=e8] [cursor=pointer]:
        - /url: "#help"
      - link "方法与版本" [ref=e9] [cursor=pointer]:
        - /url: "#methods"
    - button "打开项目" [ref=e10] [cursor=pointer]
  - generic [ref=e14]:
    - generic [ref=e15]:
      - button "返回模板库" [ref=e16] [cursor=pointer]
      - textbox "项目名称" [ref=e19]: 柱状图 · 模拟数据
      - generic [ref=e20]:
        - button "撤销" [ref=e21] [cursor=pointer]
        - button "重做" [disabled] [ref=e26]
      - generic [ref=e31]:
        - button "保存项目" [ref=e32] [cursor=pointer]
        - button "导出图片" [ref=e38] [cursor=pointer]
    - generic [ref=e43]:
      - complementary [ref=e44]:
        - generic [ref=e45]:
          - button "数据" [ref=e46] [cursor=pointer]
          - button "分析" [ref=e47] [cursor=pointer]
          - button "图层" [ref=e48] [cursor=pointer]
        - generic [ref=e50]:
          - heading "数据来源" [level=3] [ref=e51]
          - button "上传文件" [ref=e52] [cursor=pointer]
          - button "粘贴数据" [ref=e56] [cursor=pointer]
          - paragraph [ref=e62]: CSV、TSV、XLS、XLSX；每个文件最多 10 MB
          - separator [ref=e63]
          - generic [ref=e64]:
            - heading "数据表 （4 行 × 2 列）" [level=3] [ref=e65]:
              - text: 数据表
              - generic [ref=e66]: （4 行 × 2 列）
            - button "展开数据表" [ref=e67] [cursor=pointer]
          - generic [ref=e74]:
            - text: 数据角色
            - combobox "数据角色" [ref=e75]:
              - option "示例数据" [selected]
          - table [ref=e77]:
            - rowgroup [ref=e78]:
              - row [ref=e79]:
                - columnheader "#" [ref=e80]
                - columnheader [ref=e81]:
                  - textbox "第 1 列名称" [ref=e82]: 类别
                - columnheader [ref=e83]:
                  - textbox "第 2 列名称" [ref=e84]: 数值
            - rowgroup [ref=e85]:
              - row [ref=e86]:
                - rowheader "2" [ref=e87]
                - cell [ref=e88]:
                  - textbox "示例数据第 2 行第 1 列" [ref=e89]: 对照
                - cell [ref=e90]:
                  - textbox "示例数据第 2 行第 2 列" [ref=e91]: "24"
              - row [ref=e92]:
                - rowheader "3" [ref=e93]
                - cell [ref=e94]:
                  - textbox "示例数据第 3 行第 1 列" [ref=e95]: 处理甲
                - cell [ref=e96]:
                  - textbox "示例数据第 3 行第 2 列" [ref=e97]: "39"
              - row [ref=e98]:
                - rowheader "4" [ref=e99]
                - cell [ref=e100]:
                  - textbox "示例数据第 4 行第 1 列" [ref=e101]: 处理乙
                - cell [ref=e102]:
                  - textbox "示例数据第 4 行第 2 列" [ref=e103]: "31"
              - row [ref=e104]:
                - rowheader "5" [ref=e105]
                - cell [ref=e106]:
                  - textbox "示例数据第 5 行第 1 列" [ref=e107]: 处理丙
                - cell [ref=e108]:
                  - textbox "示例数据第 5 行第 2 列" [ref=e109]: "48"
          - generic [ref=e110]:
            - button "行" [ref=e111] [cursor=pointer]
            - button "列" [ref=e113] [cursor=pointer]
            - button "新增表" [ref=e115] [cursor=pointer]
            - button "删除当前数据表" [ref=e116] [cursor=pointer]: 表
          - group [ref=e120]:
            - generic "映射已有列到模板字段" [ref=e121] [cursor=pointer]
            - option "保留现有字段" [selected]
            - option "类别"
            - option "数值"
            - option "保留现有字段" [selected]
            - option "类别"
            - option "数值"
          - paragraph [ref=e122]: 在表格中直接编辑，图表随有效数据更新。空白不会自动填补。
          - group [ref=e123]:
            - generic "数据格式与字段说明" [ref=e124] [cursor=pointer]
          - generic [ref=e125]:
            - button "重新载入示例" [ref=e126] [cursor=pointer]
            - button "试用另一组数据" [ref=e127] [cursor=pointer]
            - button "下载示例数据" [ref=e128] [cursor=pointer]
      - separator "调整数据面板宽度" [ref=e132]
      - main [ref=e133]:
        - generic [ref=e134]:
          - link "图表帮助" [ref=e135] [cursor=pointer]:
            - /url: "#help/bar"
          - generic [ref=e139]:
            - button "缩小" [ref=e140] [cursor=pointer]
            - button "100%" [ref=e144] [cursor=pointer]
            - button "放大" [ref=e145] [cursor=pointer]
        - img "样式响应检验-bar-1" [ref=e151]:
          - img "样式响应检验-bar-1" [ref=e152]:
            - generic [ref=e155]: 模拟数据 · 用于演示
            - generic [ref=e156]:
              - generic [ref=e157]: 对照
              - generic [ref=e160]: 处理甲
              - generic [ref=e163]: 处理乙
              - generic [ref=e166]: 处理丙
              - generic [ref=e169]: "0"
              - generic [ref=e172]: "10"
              - generic [ref=e175]: "20"
              - generic [ref=e178]: "30"
              - generic [ref=e181]: "40"
              - generic [ref=e184]: "50"
              - generic [ref=e187]: 数值
            - generic [ref=e188]:
              - generic "对照 数据：24" [ref=e189]
              - generic "处理甲 数据：39" [ref=e191]
              - generic "处理乙 数据：31" [ref=e193]
              - generic "处理丙 数据：48" [ref=e195]
      - separator "调整属性面板宽度" [ref=e197]
      - complementary [ref=e198]:
        - generic [ref=e199]:
          - generic [ref=e200]:
            - generic [ref=e201]: 画布尺寸单位
            - combobox "画布尺寸单位" [ref=e202]:
              - option "像素" [selected]
              - option "毫米"
          - group [ref=e203]:
            - generic "画布" [ref=e204] [cursor=pointer]
            - generic [ref=e205]:
              - generic [ref=e206]: 宽度（像素）
              - spinbutton "宽度（像素）" [ref=e207]: "960"
            - generic [ref=e208]:
              - generic [ref=e209]: 高度（像素）
              - spinbutton "高度（像素）" [ref=e210]: "640"
            - generic [ref=e211]:
              - generic [ref=e212]: 背景颜色
              - textbox "背景颜色" [ref=e213] [cursor=pointer]: "#ffffff"
            - generic [ref=e214]:
              - generic [ref=e215]: 透明背景
              - switch "透明背景" [ref=e216] [cursor=pointer]
            - generic [ref=e217]:
              - generic [ref=e218]: 上边距
              - spinbutton "上边距" [ref=e219]: "82"
            - generic [ref=e220]:
              - generic [ref=e221]: 右边距
              - spinbutton "右边距" [ref=e222]: "48"
            - generic [ref=e223]:
              - generic [ref=e224]: 下边距
              - spinbutton "下边距" [ref=e225]: "105"
            - generic [ref=e226]:
              - generic [ref=e227]: 左边距
              - spinbutton "左边距" [ref=e228]: "95"
          - group [ref=e229]:
            - generic "标题与文字" [ref=e230] [cursor=pointer]
            - generic [ref=e231]:
              - text: 标题
              - textbox "标题" [active] [ref=e232]: 样式响应检验-bar-1
            - generic [ref=e233]:
              - text: 副标题
              - textbox "副标题" [ref=e234]: 模拟数据 · 用于演示
            - generic [ref=e235]:
              - generic [ref=e236]: 字体
              - combobox "字体" [ref=e237]:
                - option "思源黑体" [selected]
                - option "思源宋体"
            - generic [ref=e238]:
              - generic [ref=e239]: 正文字号
              - spinbutton "正文字号" [ref=e240]: "14"
            - generic [ref=e241]:
              - generic [ref=e242]: 标题字号
              - spinbutton "标题字号" [ref=e243]: "24"
            - generic [ref=e244]:
              - generic [ref=e245]: 文字颜色
              - textbox "文字颜色" [ref=e246] [cursor=pointer]: "#263445"
            - generic [ref=e247]:
              - generic [ref=e248]: 标题底色
              - textbox "标题底色" [ref=e249] [cursor=pointer]: "#000000"
            - generic [ref=e250]:
              - generic [ref=e251]: 标题颜色
              - textbox "标题颜色" [ref=e252] [cursor=pointer]: "#000000"
            - generic [ref=e253]:
              - generic [ref=e254]: 标题粗体
              - switch "标题粗体" [checked] [ref=e255] [cursor=pointer]
            - generic [ref=e256]:
              - generic [ref=e257]: 标题斜体
              - switch "标题斜体" [ref=e258] [cursor=pointer]
          - group [ref=e259]:
            - generic "配色与图形" [ref=e260] [cursor=pointer]
            - generic [ref=e261]:
              - generic [ref=e262]: 显示图例
              - switch "显示图例" [ref=e263] [cursor=pointer]
            - generic [ref=e264]:
              - generic [ref=e265]: 显示数值
              - switch "显示数值" [ref=e266] [cursor=pointer]
            - generic [ref=e267]:
              - generic [ref=e268]: 透明度
              - spinbutton "透明度" [ref=e269]: "0.9"
            - generic [ref=e270]:
              - generic [ref=e271]: 填充纹理
              - combobox "填充纹理" [ref=e272]:
                - option "纯色" [selected]
                - option "斜线"
                - option "横线"
                - option "圆点"
                - option "网格"
            - generic [ref=e273]:
              - generic [ref=e274]: 配色方案
              - combobox "配色方案" [ref=e275]:
                - option "选择配色" [disabled] [selected]
                - option "青绿与珊瑚"
                - option "色觉友好"
                - option "冷暖连续"
                - option "灰阶"
            - generic [ref=e276]:
              - textbox "系列 1 颜色" [ref=e277] [cursor=pointer]: "#087f8c"
              - textbox "系列 2 颜色" [ref=e278] [cursor=pointer]: "#eb8972"
              - textbox "系列 3 颜色" [ref=e279] [cursor=pointer]: "#587ab8"
              - textbox "系列 4 颜色" [ref=e280] [cursor=pointer]: "#b78bc1"
              - textbox "系列 5 颜色" [ref=e281] [cursor=pointer]: "#b9ac62"
              - textbox "系列 6 颜色" [ref=e282] [cursor=pointer]: "#76b7bc"
          - group [ref=e283]:
            - generic "图形细节" [ref=e284] [cursor=pointer]
            - generic [ref=e285]:
              - generic [ref=e286]: 绘图方向
              - combobox "绘图方向" [ref=e287]:
                - option "纵向" [selected]
                - option "横向"
            - generic [ref=e288]:
              - generic [ref=e289]: 柱间距比例
              - spinbutton "柱间距比例" [ref=e290]: "0.25"
            - generic [ref=e291]:
              - generic [ref=e292]: 柱角半径
              - spinbutton "柱角半径" [ref=e293]
            - generic [ref=e294]:
              - generic [ref=e295]: 图形描边宽度
              - spinbutton "图形描边宽度" [ref=e296]
            - generic [ref=e297]:
              - generic [ref=e298]: 图形描边颜色
              - textbox "图形描边颜色" [ref=e299] [cursor=pointer]: "#000000"
            - generic [ref=e300]:
              - generic [ref=e301]: 类别排序
              - combobox "类别排序" [ref=e302]:
                - option "数据顺序" [selected]
                - option "数值升序"
                - option "数值降序"
          - group [ref=e303]:
            - generic "刻度与网格" [ref=e304] [cursor=pointer]
            - generic [ref=e305]:
              - generic [ref=e306]: 横轴刻度旋转
              - spinbutton "横轴刻度旋转" [ref=e307]: "0"
            - generic [ref=e308]:
              - generic [ref=e309]:
                - text: 横轴自定义刻度
                - generic [ref=e310]: 英文逗号分隔；数值轴填写数字，类别轴填写现有类别。
              - textbox "横轴自定义刻度" [ref=e311]
            - generic [ref=e312]:
              - generic [ref=e313]: 横轴刻度字号
              - spinbutton "横轴刻度字号" [ref=e314]: "14"
            - generic [ref=e315]:
              - generic [ref=e316]: 横轴刻度颜色
              - textbox "横轴刻度颜色" [ref=e317] [cursor=pointer]: "#000000"
            - generic [ref=e318]:
              - generic [ref=e319]: 横轴刻度粗体
              - switch "横轴刻度粗体" [ref=e320] [cursor=pointer]
            - generic [ref=e321]:
              - generic [ref=e322]: 横轴刻度斜体
              - switch "横轴刻度斜体" [ref=e323] [cursor=pointer]
            - generic [ref=e324]:
              - generic [ref=e325]:
                - text: 纵轴自定义刻度
                - generic [ref=e326]: 英文逗号分隔；数值轴填写数字，类别轴填写现有类别。
              - textbox "纵轴自定义刻度" [ref=e327]
            - generic [ref=e328]:
              - generic [ref=e329]:
                - text: 纵轴数值格式
                - generic [ref=e330]: 例如 .2f（两位小数）、.2e（科学计数）、.0%（百分比）；留空自动。
              - textbox "纵轴数值格式" [ref=e331]
            - generic [ref=e332]:
              - generic [ref=e333]: 纵轴刻度字号
              - spinbutton "纵轴刻度字号" [ref=e334]: "14"
            - generic [ref=e335]:
              - generic [ref=e336]: 纵轴刻度颜色
              - textbox "纵轴刻度颜色" [ref=e337] [cursor=pointer]: "#000000"
            - generic [ref=e338]:
              - generic [ref=e339]: 纵轴刻度粗体
              - switch "纵轴刻度粗体" [ref=e340] [cursor=pointer]
            - generic [ref=e341]:
              - generic [ref=e342]: 纵轴刻度斜体
              - switch "纵轴刻度斜体" [ref=e343] [cursor=pointer]
            - generic [ref=e344]:
              - generic [ref=e345]: 纵轴刻度旋转
              - spinbutton "纵轴刻度旋转" [ref=e346]
            - generic [ref=e347]:
              - generic [ref=e348]: 自动数值刻度数量
              - spinbutton "自动数值刻度数量" [ref=e349]: "6"
            - generic [ref=e350]:
              - generic [ref=e351]: 刻度线长度
              - spinbutton "刻度线长度" [ref=e352]: "5"
            - generic [ref=e353]:
              - generic [ref=e354]: 网格透明度
              - spinbutton "网格透明度" [ref=e355]: "0.1"
            - generic [ref=e356]:
              - generic [ref=e357]: 网格颜色
              - textbox "网格颜色" [ref=e358] [cursor=pointer]: "#000000"
          - group [ref=e359]:
            - generic "坐标与文字" [ref=e360] [cursor=pointer]
            - generic [ref=e361]:
              - text: 横轴标题（支持 <sup> 上标与 <sub> 下标）
              - textbox "横轴标题（支持 <sup> 上标与 <sub> 下标）" [ref=e362]
            - generic [ref=e363]:
              - text: 纵轴标题
              - textbox "纵轴标题" [ref=e364]: 数值
            - generic [ref=e365]:
              - generic [ref=e366]: 显示数值轴网格
              - switch "显示数值轴网格" [checked] [ref=e367] [cursor=pointer]
            - generic [ref=e368]:
              - generic [ref=e369]: 横轴位置
              - combobox "横轴位置" [ref=e370]:
                - option "底部" [selected]
                - option "顶部"
            - generic [ref=e371]:
              - generic [ref=e372]: 纵轴位置
              - combobox "纵轴位置" [ref=e373]:
                - option "左侧" [selected]
                - option "右侧"
            - generic [ref=e374]:
              - generic [ref=e375]: 坐标线宽
              - spinbutton "坐标线宽" [ref=e376]: "1"
            - generic [ref=e377]:
              - generic [ref=e378]: 坐标线颜色
              - textbox "坐标线颜色" [ref=e379] [cursor=pointer]: "#000000"
            - generic [ref=e380]:
              - generic [ref=e381]: 显示横轴
              - switch "显示横轴" [checked] [ref=e382] [cursor=pointer]
            - generic [ref=e383]:
              - generic [ref=e384]: 显示纵轴
              - switch "显示纵轴" [checked] [ref=e385] [cursor=pointer]
            - generic [ref=e386]:
              - generic [ref=e387]: 横轴整体偏移
              - spinbutton "横轴整体偏移" [ref=e388]
            - generic [ref=e389]:
              - generic [ref=e390]: 纵轴整体偏移
              - spinbutton "纵轴整体偏移" [ref=e391]
            - generic [ref=e392]:
              - generic [ref=e393]: 纵轴标题距离
              - spinbutton "纵轴标题距离" [ref=e394]
            - generic [ref=e395]:
              - generic [ref=e396]: 坐标标题字号
              - spinbutton "坐标标题字号" [ref=e397]: "14"
            - generic [ref=e398]:
              - generic [ref=e399]: 坐标标题粗体
              - switch "坐标标题粗体" [ref=e400] [cursor=pointer]
            - generic [ref=e401]:
              - generic [ref=e402]: 坐标标题斜体
              - switch "坐标标题斜体" [ref=e403] [cursor=pointer]
            - generic [ref=e404]:
              - generic [ref=e405]: 横轴端点箭头
              - switch "横轴端点箭头" [ref=e406] [cursor=pointer]
            - generic [ref=e407]:
              - generic [ref=e408]: 纵轴端点箭头
              - switch "纵轴端点箭头" [ref=e409] [cursor=pointer]
          - group [ref=e410]:
            - generic "坐标范围" [ref=e411] [cursor=pointer]
            - generic [ref=e412]:
              - generic [ref=e413]:
                - text: 纵轴最小值（仅数值轴）
                - generic [ref=e414]: 留空则根据数据自动计算；类别轴不使用数值范围。
              - spinbutton "纵轴最小值（仅数值轴）" [ref=e415]
            - generic [ref=e416]:
              - generic [ref=e417]: 纵轴最大值（仅数值轴）
              - spinbutton "纵轴最大值（仅数值轴）" [ref=e418]
            - generic [ref=e419]:
              - generic [ref=e420]: 纵轴尺度
              - combobox "纵轴尺度" [ref=e421]:
                - option "线性" [selected]
                - option "log2 对数"
                - option "log10 对数"
          - group [ref=e422]:
            - generic "侧边标题" [ref=e423] [cursor=pointer]
            - generic [ref=e424]:
              - generic [ref=e425]: 显示右侧标题条
              - switch "显示右侧标题条" [ref=e426] [cursor=pointer]
          - group [ref=e427]:
            - generic "坐标断轴" [ref=e428] [cursor=pointer]
            - generic [ref=e429]:
              - generic [ref=e430]: 纵轴省略区间
              - switch "纵轴省略区间" [ref=e431] [cursor=pointer]
          - button "恢复模板默认样式" [ref=e432] [cursor=pointer]
          - paragraph [ref=e433]: 恢复样式会保留当前数据，可用撤销恢复。
        - generic [ref=e434]:
          - group [ref=e435]:
            - generic "逐系列样式" [ref=e436] [cursor=pointer]
            - option "对照" [selected]
            - option "处理甲"
            - option "处理乙"
            - option "处理丙"
            - option "纯色" [selected]
            - option "斜线"
            - option "横线"
            - option "圆点"
            - option "网格"
          - group [ref=e437]:
            - generic "分类色带图层" [ref=e438] [cursor=pointer]
    - contentinfo [ref=e439]:
      - generic [ref=e441]: 4 行数据
      - generic [ref=e442]: 本机草稿已保存
      - generic [ref=e443]: 960 × 640 px · 柱状图
```

# Test source

```ts
  80  |           let timer = 0;
  81  |           const hasUpdatedSvgTitle = () => {
  82  |             const svg = document.querySelector(".figure-paper svg[data-chart]");
  83  |             // Require actual SVG text, not merely accessible <title> metadata.
  84  |             return Boolean(
  85  |               svg &&
  86  |                 Array.from(svg.querySelectorAll("text")).some(
  87  |                   (text) => text.textContent === expected,
  88  |                 ),
  89  |             );
  90  |           };
  91  |           const cleanup = () => {
  92  |             observer.disconnect();
  93  |             element.removeEventListener("input", input, true);
  94  |             cancelAnimationFrame(firstFrame);
  95  |             cancelAnimationFrame(secondFrame);
  96  |             clearTimeout(timer);
  97  |           };
  98  |           const complete = (error?: string) => {
  99  |             if (completed) return;
  100 |             completed = true;
  101 |             cleanup();
  102 |             finish({ ...times, ...(error ? { error } : {}) });
  103 |           };
  104 |           const inspect = () => {
  105 |             if (
  106 |               times.inputAt === undefined ||
  107 |               times.mutationAt !== undefined ||
  108 |               !hasUpdatedSvgTitle()
  109 |             )
  110 |               return;
  111 |             times.mutationAt = performance.now();
  112 |             observer.disconnect();
  113 |             // A single rAF is before paint. The second rAF crosses a complete
  114 |             // rendering opportunity after the updated SVG was observed.
  115 |             firstFrame = requestAnimationFrame(() => {
  116 |               times.firstFrameAt = performance.now();
  117 |               secondFrame = requestAnimationFrame(() => {
  118 |                 times.paintedFrameAt = performance.now();
  119 |                 complete(
  120 |                   hasUpdatedSvgTitle()
  121 |                     ? undefined
  122 |                     : "绘制帧时 SVG 标题已不匹配",
  123 |                 );
  124 |               });
  125 |             });
  126 |           };
  127 |           const input = (event: Event) => {
  128 |             if (event.target !== element || times.inputAt !== undefined) return;
  129 |             times.inputAt = performance.now();
  130 |             inspect();
  131 |           };
  132 |           const observer = new MutationObserver(inspect);
  133 |           observer.observe(document.querySelector(".figure-paper")!, {
  134 |             subtree: true,
  135 |             childList: true,
  136 |             characterData: true,
  137 |           });
  138 |           element.addEventListener("input", input, true);
  139 |           timer = window.setTimeout(
  140 |             () => complete("未在 5 秒内观察到输入、SVG 标题更新及后续绘制帧"),
  141 |             5000,
  142 |           );
  143 |           host.__openacadStyleMeasurement = { result, cleanup };
  144 |         }, expectedTitle);
  145 |         const automationStart = performance.now();
  146 |         await title.fill(expectedTitle);
  147 |         await expect(page.locator(".figure-paper")).toContainText(
  148 |           expectedTitle,
  149 |         );
  150 |         const automationUntilTitleMilliseconds =
  151 |           performance.now() - automationStart;
  152 |         const browser = await page.evaluate(async () => {
  153 |           const host = window as Window & {
  154 |             __openacadStyleMeasurement?: {
  155 |               result: Promise<BrowserSample>;
  156 |               cleanup: () => void;
  157 |             };
  158 |           };
  159 |           const measurement = host.__openacadStyleMeasurement;
  160 |           if (!measurement) throw new Error("浏览器性能测量未初始化");
  161 |           const result = await measurement.result;
  162 |           delete host.__openacadStyleMeasurement;
  163 |           return result;
  164 |         });
  165 |         const delta = (end?: number, start?: number) =>
  166 |           end !== undefined && start !== undefined ? end - start : null;
  167 |         rows.push({
  168 |           template: id,
  169 |           sample,
  170 |           ...browser,
  171 |           milliseconds: delta(browser.paintedFrameAt, browser.inputAt),
  172 |           svgMutationMilliseconds: delta(browser.mutationAt, browser.inputAt),
  173 |           frameWaitMilliseconds: delta(
  174 |             browser.paintedFrameAt,
  175 |             browser.mutationAt,
  176 |           ),
  177 |           automationUntilTitleMilliseconds,
  178 |           automationTotalMilliseconds: performance.now() - automationStart,
  179 |         });
> 180 |         expect(browser.error, `${id} 第 ${sample} 次测量失败`).toBeUndefined();
      |                                                          ^ Error: bar 第 1 次测量失败
  181 |       }
  182 |     }
  183 |   } catch (error) {
  184 |     failure = error;
  185 |   }
  186 |   const valid = rows.filter(
  187 |     (row): row is Sample & { milliseconds: number } =>
  188 |       !row.error && row.milliseconds !== null,
  189 |   );
  190 |   const byTemplate = templates.map((template) => {
  191 |     const samples = valid.filter((row) => row.template === template);
  192 |     const values = samples.map((row) => row.milliseconds);
  193 |     return {
  194 |       template,
  195 |       samples: values.length,
  196 |       p95: percentile95(values),
  197 |       max: values.length ? Math.max(...values) : null,
  198 |     };
  199 |   });
  200 |   const result = {
  201 |     schemaVersion: 2,
  202 |     measurement: "browser-input-to-svg-two-animation-frames-v1",
  203 |     note: "常规模拟数据，仅测标题编辑路径，不能外推其他样式或数据重布局；浏览器捕获真实 input 事件起，用 MutationObserver 确认可见 SVG 标题更新，再等待连续两次 requestAnimationFrame 跨过一次渲染机会。全部主计时使用同一页面 performance.now()；不包含 Playwright 定位、滚动和往返。双帧是浏览器渲染机会估计，不等同屏幕光学或合成器完成时间，不代表大数据或统计计算延迟。",
  204 |     automationNote:
  205 |       "automationUntilTitleMilliseconds 保留旧口径（Node 端填入到断言标题文本出现），automationTotalMilliseconds 另包含读取跨帧结果；两者均含自动化开销，不作为 300ms 产品目标判断。",
  206 |     generatedAt: new Date().toISOString(),
  207 |     project: info.project.name,
  208 |     url: page.url(),
  209 |     browserVersion: page.context().browser()?.version(),
  210 |     rows,
  211 |     byTemplate,
  212 |     p95: percentile95(valid.map((row) => row.milliseconds)),
  213 |     automationP95: percentile95(
  214 |       rows.map((row) => row.automationUntilTitleMilliseconds),
  215 |     ),
  216 |     target: 300,
  217 |     expectedSamples: 30,
  218 |     measuredSamples: valid.length,
  219 |     overTarget: valid
  220 |       .filter((row) => row.milliseconds > 300)
  221 |       .map(({ template, sample, milliseconds }) => ({
  222 |         template,
  223 |         sample,
  224 |         milliseconds,
  225 |       })),
  226 |     ...(failure ? { error: String(failure) } : {}),
  227 |   };
  228 |   const report =
  229 |     process.env.OPENACAD_PERFORMANCE_REPORT ||
  230 |     "../tests/artifacts/style-performance.json";
  231 |   await mkdir(dirname(report), { recursive: true });
  232 |   await writeFile(report, JSON.stringify(result, null, 2));
  233 |   await info.attach("样式响应时间独立测量", {
  234 |     body: JSON.stringify(result, null, 2),
  235 |     contentType: "application/json",
  236 |   });
  237 |   if (failure) throw failure;
  238 |   expect(valid).toHaveLength(30);
  239 |   expect(result.p95).toBeLessThanOrEqual(300);
  240 |   // Three observations per template: nearest-rank p95 is the maximum. This
  241 |   // prevents one slow template from disappearing inside the pooled percentile.
  242 |   for (const row of byTemplate)
  243 |     expect(
  244 |       row.p95,
  245 |       `${row.template} 的真实浏览器跨帧预览延迟`,
  246 |     ).toBeLessThanOrEqual(300);
  247 | });
  248 | 
```