---
title: Twitter の Android 向け PWA ラッパーアプリを作った
date: "2026-11-01T03:14:28.000Z"
update: "2026-11-01T03:14:28.000Z"
tags: ["android", "ai slop application", "rust"]
name: polytwi
lang: ja
otherLangs: []
---

## はじめに
Twitter の公式アプリはおすすめやトレンドなどのノイズが多くあまり使いたくありませんが、サードパーティークライアントは大昔に締め出されてしまいました。
[Control Panel for Twitter](https://github.com/insin/control-panel-for-twitter) という拡張機能を入れれば PC ブラウザではかなり快適に使えるのですが…。

そのため、PWA 版をよく使っているのですが、以下のような問題があります。

* アカウント切り替えが重い
* Push 通知が上手く届かない
  * おそらく複数アカウントログイン時に、現在アクティブな1アカウントにしか通知が届いていない
* 拡張機能を利用できる Android ブラウザが限られている
  * Android 版 Firefox なんか重い

今回はこれらの問題を解決するために作った (作ったは嘘で、AI に作ってもらった) Android 用 Twitter PWA ラッパーアプリ [polytwi](https://github.com/kgtkr/polytwi) と、Web Push 通知を FCM に中継するサーバー [autopush-fcm-bridge](https://github.com/kgtkr/autopush-fcm-bridge) について紹介します。

インストールは以下の F-Droid Repo からできます。
- https://kgtkr.github.io/polytwi/fdroid/repo/

## 作ったもの
- マルチプロファイルによる複数アカウント対応: `androidx.webkit` のマルチプロファイル機能を使い、アカウントごとに独立した `WebView` プロファイルを保持しています。すべてのアカウントが独立したセッションであるため、PWA の複数アカウント利用時の通知問題の影響を受けずに、全アカウントで通知を受け取ることができます。
- Control Panel for Twitter の組み込み: Control Panel for Twitter を UserScript として組み込んでいます。GitHub Release からの自動更新と、複数プロファイル間での設定同期に対応しています。
- Web Push ポリフィル + FCM によるプッシュ通知: `WebView` に存在しない `PushManager` / `Notification` API をポリフィルし、Mozilla Autopush と自前ブリッジサーバー経由で通知を受信できます。
- QR コードを使って別端末へのセッションをコピー: 移行先端末で生成した公開鍵を QR コードで読み取り、全アカウントのセッション (Cookie)・WebPush 秘密鍵・CPFT 設定を暗号化して Quick Share などで移行できます (移行というか同時運用可能)。


## Android WebView で Web Push 通知を動かす

Android の `WebView` には Service Worker 自体は存在するものの、`ServiceWorkerRegistration.prototype.pushManager` が実装されていません。
そのため、普通に `WebView` で Twitter を開くだけでは設定画面でプッシュ通知を有効化することができません (プッシュ通知の設定画面がでてこない)。
そこで、`WebViewCompat.addDocumentStartJavaScript` を使ってポリフィルしています。

Twitter の設定画面で「プッシュ通知」をオンにすると、Twitter のフロントエンドは VAPID 公開鍵 (`applicationServerKey`) を渡して `pushManager.subscribe()` を呼び出します。
ポリフィルはこの呼び出しを `@JavascriptInterface` のブリッジ経由でネイティブ側に渡し、ネイティブ側で Web Push 用の P-256 鍵ペア (`p256dh` 公開鍵と秘密鍵) および 16 バイトの `auth` シークレットを生成して、Push サーバーの `endpoint` URL とともに Twitter の JS に返します。
すると Twitter のフロントエンドがそのまま Twitter のサーバーに `{ endpoint, keys: { p256dh, auth } }` を登録してくれます。

Web Push のペイロード暗号化は、購読時にクライアントが生成した公開鍵 `p256dh` と `auth` シークレットを使って送信者 (Twitter サーバー) と受信者 (Android 端末) の間でE2E暗号化されます。
そのため途中にある中継サーバーも通知の中身を読むことはできません。

## Web Push 通知の受信アーキテクチャの比較

`PushManager` をポリフィルするにあたって重要なのが、Web Push の `endpoint` をどこにするかです。

Mozilla Autopush を使うと誰でも Firefox などで使われている `endpoint` を発行してもらうことができます。
そのため Twitter 目線で、普通の Firefox から通知登録しているのと一切見分けがつかないという大きなメリットがあります。
一方、直接これを使おうとすると常時バックグラウンドで WebSocket コネクションを貼り続けなければならず、バッテリー消費の問題があります。
Firefox for Android の公式アプリは Autopush から FCM 経由で通知を受け取っていますが、アプリ署名の問題でサードパーティーアプリでこの仕組みを使うことはできません。

これを踏まえて、通知の実装手段としては主に以下の 4 つのアプローチが考えられます。

| 方式 | バッテリー消費 | BAN耐性 | サーバー運用コスト | 特徴・課題 |
| :--- | :---: | :---: | :---: | :---: |
| **1 端末から Autopush に直接 WS 接続** | × 大<br>(常駐サービス必須) | ◯ 安全<br>(Firefox と同一) | ◎ 不要 | サーバー不要だが、端末で常時 WebSocket を維持するためバッテリー消費が激しい |
| **2 ntfy.sh などを使う** | ◯ 小 <br>(FCM 受信) | × 危険<br>(ドメインでバレる) | ◯ 不要 | Twitter 側がドメイン制限していたら使えず、怪しい非公式クライアントだと検知されるリスクがある |
| **3 ステートレスなブリッジサーバーを立てる** | ◯ 小<br>(FCM 受信) | ◯ 安全<br>(Firefox と同一) | ◯ 軽量<br>(DB 不要) | チャネルごとにブリッジサーバー〜Autopush 間の WS コネクションを貼る必要がある |
| **4 ステートフルなブリッジサーバーを立てる**<br>(`autopush-fcm-bridge`) | ◯ 小<br>(FCM 受信) | ◯ 安全<br>(Firefox と同一) | △ 大<br>(DB が必要) | WS コネクションをプールできる。また副次的にセッションコピーに対応可能 |

### 各方式のメリット・デメリット

1. **端末から Autopush に直接 WebSocket 接続する (初期実装)**
   Android の Foreground Service を常駐させて `wss://push.services.mozilla.com/` に直接 WebSocket を張る方式です。サーバー不要なため、初期段階ではこの方式を採用していました。
   しかし、常時 WebSocket コネクションを維持し続けるためバッテリー消費が大きいです。
2. **ntfy.sh などの外部サービスを `endpoint` にする**
   `ntfy.sh` を `endpoint` として登録する方式です。
   これは実装は簡単ですが、通常ブラウザの Web Push エンドポイントは Google・Mozilla・Appleなどが使われています。
   そこに `ntfy.sh` の URL を登録すると、Twitter 側がドメインのホワイトリスト制限を入れていたら弾かれますし、そうでなくても「怪しいクライアントを使っている」と思われるリスクがあるためやめました。
3. **ステートレスなブリッジサーバーを立てる**
   Twitter には Autopush の `endpoint` を渡して、Autopush との WebSocket 接続をサーバー側に逃がして FCM で受け取る構成です。
   もしサーバーを DB なしのステートレスにしようとすると、チャネルごとに 1 本ずつ Autopush への WebSocket を張る必要があり、アカウント数や端末数が増えるとサーバーと Autopush 間の WebSocket コネクション数が増えてしまいます。
4. **ステートフルなブリッジサーバーを立てる (採用した方式)**
   最終的に採用したのが、ステートフルなブリッジサーバー方式です。
   - Autopush の 1 つの WebSocket セッション (`uaid`) を最大 50 チャネルで共有します。これによってコネクション数を抑えることができます。
   - また副次的なメリットとして、「別端末へセッションを丸ごとコピーしても通知が壊れない仕組み」を作ることができます。
   - ステートフルであるため、アンインストール済みクライアントが残り続けないようにするといった掃除機能は必要です。

## セッションコピー機能

複数アカウントを登録している環境で機種変更やサブ端末への環境複製を行うとき、すべてのアカウントで ID・パスワード・2FA を再入力して再ログインするのは面倒です。

そこで、端末間でセッションや設定を丸ごとコピーする機能をつけました。

1. **移行先端末:** 鍵ペアを生成し、公開鍵 (`polytwi://transfer?pk=...`) を QR コードとして画面に表示する
2. **移行元端末:** カメラで QR コードを読み取り、全アカウント情報・各 WebView プロファイルの Cookie (`auth_token`, `ct0`, `twid` など)・WebPush 秘密鍵・CPFT 設定をまとめた JSON を GZIP 圧縮し、一時鍵との ECDH + HKDF-SHA256 + AES-256-GCM で暗号化した `.ptbackup` ファイルを生成して Quick Share などで送信する
3. **移行先端末:** 受け取ったファイルを読み込んで復号し、各 WebView プロファイルの `CookieManager` やアカウント情報を復元する

### セッションコピー時の通知問題
ここで問題になるのが、またまた通知周りです。
Twitter の Web 版では、1 つのログインセッションに対して 1 つの Web Push endpoint しか設定できません。

アプリから直接 Autopush に WebSocket 接続していた時代 (方式1) は、この制約のせいでセッション移行機能を入れるのを一度断念していました。
- セッション情報と一緒に Autopush の `uaid` まで別端末にコピーしてしまうと、2台の端末が同じ `uaid` で同時に WebSocket 接続しようとして競合・切断し合う
- かといって移行先端末で新しく通知をオンにすると、Twitter サーバー側の `endpoint` が新しい端末のものに上書きされ、移行元端末に通知が届かなくなる

### ステートフルな `autopush-fcm-bridge` による解決
しかし、自前のステートフルな `autopush-fcm-bridge` (方式4) を用意したことで、この問題を解決できるようになりました。

Twitter から見れば通知の送信先はあくまで `autopush-fcm-bridge` が管理する 1 つの Autopush `pushEndpoint` であり、さらに Web Push の復号鍵 (`privateKey`, `p256dh`, `auth`) は移行元から移行先へそのままコピーされています。
つまり、ブリッジサーバーの DB で 1つの `channel_id` に対して複数の `fcm_token` を紐付けられるようにすれば、同じセッションのまま両方の端末で同時に通知を受け取って復号することができます。

```dot
digraph MultiDevice {
  graph [rankdir=LR, fontname="sans-serif", bgcolor="transparent"];
  node [shape=box, style="rounded", fontname="sans-serif", margin="0.2,0.1"];
  edge [fontname="sans-serif", fontsize=11];

  Twitter [label="Twitter Server\n(1 Session = 1 Endpoint)"];
  AP [label="Mozilla Autopush"];
  Bridge [label="autopush-fcm-bridge\n(1 channel_id -> N fcm_tokens)"];
  DevA [label="Device A"];
  DevB [label="Device B"];

  Twitter -> AP [label="Encrypted Push"];
  AP -> Bridge [label="WebSocket"];
  Bridge -> DevA [label="FCM (Token A)"];
  Bridge -> DevB [label="FCM (Token B)"];
}
```

具体的には以下のように実装しています。

- ブリッジサーバーの DB スキーマを `channels` と `channel_fcm_tokens (channel_id, fcm_token)` の 1対多構成にし、移行先端末がインポート直後に `POST /v1/channels/sync` を呼ぶだけで、既存の `channel_id` に移行先端末の `fcm_token` が追加登録されるようにした
- 片方の端末でアカウントを削除したときは `DELETE /v1/channels/:channel_id?fcm_token=...` でその端末のトークン紐付けだけを解除し、紐づく端末が 0 台になったときだけ Autopush 側のチャネルを `unregister` するようにした

### どちらかの端末で通知オフ→再度オンにしても壊れないようにする
単純な実装だと片方の端末で通知をオフ → オンにしてしまったときに、新しい `channel_id` と `endpoint` が発行されてもう片方の端末に届かなくなります。
そこで、以下の対策をいれています。

1. アプリ間で共有する論理的な `channel_id` と、Autopush との通信に使う物理的な `autopush_channel_id` をブリッジサーバー側で分離する
2. アプリ側で `unsubscribe` が呼ばれても論理 `channel_id` と WebPush 鍵ペアは破棄せず保持しておき、再度 `subscribe` された際には同じ論理 `channel_id` を指定して `POST /v1/channels` を呼ぶ
3. ブリッジサーバー側では既存の論理 `channel_id` が生きていれば以前とまったく同じ `pushEndpoint` をそのまま返す。`autopush_channel_id` の再作成が必要になった場合は同じ論理 `channel_id` にぶら下がる全端末の `fcm_token` 紐付けを維持する

これにより、どちらかの端末で通知設定を触ってしまっても、もう片方の端末の設定が壊れることなく両端末に通知が届き続けます。

## Control Panel for Twitter の組み込みと単体アップデート
Control Panel for Twitter の組み込みについても少し工夫しています。

- **設定画面の動作:** Control Panel for Twitter の設定画面は本来ブラウザ拡張機能の `chrome.storage.local` や `chrome.i18n` を使っていますが、`https://cpft-options.local/options.html` という仮想オリジンへのリクエストを `shouldInterceptRequest` でインターセプトし、`SharedPreferences` と連携するポリフィルを注入することでアプリ内のダイアログからそのまま全設定を変更できるようにしています。また、設定を変更すると全プロファイルの `WebView` に即座に反映されます。
- **アプリ本体の再ビルドなしでのアップデート:** Twitter 側の DOM 変更に追従できるよう、起動時に GitHub API で `insin/control-panel-for-twitter` の最新リリースをチェックし、新しいバージョンがあれば確認ダイアログを出してスクリプトと設定画面アセット一式をダウンロード・更新できるようにしています。
