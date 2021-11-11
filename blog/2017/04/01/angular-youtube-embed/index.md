---
title: AngularでYouTube埋め込みをしようとしたらハマった
date: "2017-04-01T03:08:56.000Z"
update: "2017-04-01T03:08:56.000Z"
tags: ["angular"]
name: angular-youtube-embed
lang: ja
---
# 解決法
`innerHTML`に設定するHTMLはデフォルトでサニタイズされるようになっており、iframeタグが自動的に除去されるのが原因でした。
サニタイズされるのはjavascriptだけだと思っていましたが、iframeも駄目みたいです。

```ts
import { DomSanitizer } from '@angular/platform-browser';
constructor(private sanitizer: DomSanitizer) {}

let innerHTML = this.sanitizer.bypassSecurityTrustHtml(html);
```

# 注意
サニタイズすると、iframeだけではなくjavascriptも埋め込み可能になるのでXSSには注意して下さい。

# 参考
* [Security - GUIDE](https://angular.io/docs/ts/latest/guide/security.html)
* [DomSanitizer - API](https://angular.io/docs/ts/latest/api/platform-browser/index/DomSanitizer-class.html)
