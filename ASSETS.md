# 随项目提供的素材

公开包只包含当前网页所需素材，不包含原作者上传的个人照片。

| 文件 | 用途 |
| --- | --- |
| `public/carousel-panels.png` | 木马顶棚装饰花纹 |
| `public/carousel-column.png` | 中柱花纹 |
| `public/carousel-base.png` | 底座花纹 |
| `public/carousel-lamp-title-clean.png` | 丝带标题 |
| `public/favicon.svg` | 网站图标 |
| `public/fonts/*.woff2` | LXGW WenKai Lite 字体子集，许可见同目录 OFL.txt |

木马几何、相框和挂饰由 Three.js 代码创建。原型的房间模型、背景图、示例照片和本地制作脚本未包含在本包中。

## HEIC 解码依赖

使用未修改的 [heic-to](https://github.com/hoppergee/heic-to)（准确版本见 package-lock.json），包含 libheif 解码器，遵循其 LGPL-3.0 许可，副本见 `licenses/heic-to-LGPL-3.0.txt`。该第三方库不受项目的禁止商用条款限制；允许依其许可修改、替换和为调试其修改而进行逆向工程。可从上游仓库获取相应源码及构建说明，在本项目中替换依赖后重新构建。
