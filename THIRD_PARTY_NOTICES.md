# Third-party notices

ssr-gui packages the following runtime components:

- [sunniesnow-record](https://github.com/sunniesnow/sunniesnow-record), AGPL-3.0-or-later. Its source and license are included in `recorder/`.
- [Sunniesnow](https://github.com/sunniesnow/sunniesnow), AGPL-3.0-or-later. Its runtime source is included in `recorder/game/`.
- [FFmpeg](https://ffmpeg.org/), distributed through `ffmpeg-static` under GPL-3.0-or-later. Run `ffmpeg -L` from the packaged runtime for its complete license text and configuration.
- [Node.js](https://nodejs.org/), distributed under the Node.js license together with its bundled third-party components. Its complete license is included in `licenses/Node.js-LICENSE.txt`.
- [NW.js](https://nwjs.io/), distributed under the MIT license together with Chromium and Node.js components. Its license is included in `licenses/NW.js-LICENSE.txt`.
- [Lucide](https://lucide.dev/), ISC license. Selected icons are included in the application interface.

Archives whose names end in `-fonts` additionally package the exact fonts used by Sunniesnow:

- [Noto Sans Math](https://github.com/notofonts/math), SIL Open Font License 1.1.
- [Noto Sans CJK TC](https://github.com/notofonts/noto-cjk), SIL Open Font License 1.1.
- [HanWang ShinSu](https://github.com/kaio/wangfonts), GPL-2.0-or-later.
- [Yuji Boku](https://github.com/Kinutafontfactory/Yuji), SIL Open Font License 1.1.
- [LXGW WenKai](https://github.com/lxgw/LxgwWenKai), SIL Open Font License 1.1.

Their complete license texts are included in `licenses/fonts/`. `recorder/game/fonts/SOURCES.json` records each bundled file's source repository and SHA-256 digest. The standard archives do not contain these font files and retain Sunniesnow's normal on-demand font loading behavior.

JavaScript packages inside `node_modules/` retain their respective licenses. Their package metadata and license files are distributed unchanged with the desktop package.
