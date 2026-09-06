# WebKit 裁片定位原型

该本机原型检查固定1.0.2字体的标题坐标：记录 getBoundingClientRect、getBBox、getScreenCTM 与映射后的裁片，并保存常规→斜体→常规三态PNG和整页截图。实际墨迹改变且恢复后SHA相同，见 report.json。

它用于解释此前裁到空白的问题，不计入独立产品测试总数。完整三浏览器复验见[最终专项](../font-webkit-crop-after/README.md)，正式域名证据见[生产字体清单](../production-browser-1.0.2-artifacts/typography/manifest.json)。
