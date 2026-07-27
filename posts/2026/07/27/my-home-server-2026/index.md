---
title: 自宅Kubernetesクラスタの紹介
date: "2026-07-27T12:49:54.130Z"
update: "2026-07-27T12:49:54.130Z"
tags: ["kubernetes"]
name: my-home-server-2026
lang: ja
otherLangs: []
---

## はじめに
5年ほど前から自宅サーバーにKubernetesを導入し、Mastodon、Discord Bot、このブログ、自作Webサービスや各種アプリケーションをKubernetes上で動かしています。
1ヶ月ほど前に、マニフェストリポジトリをほぼ全て公開リポジトリに移行したため、内容を備忘録としてまとめました。

## ハードウェア構成
ハードウェアはVPS 1台と、自宅内の3台の物理マシンの計4ノードで構成されています。

* ConoHa VPS 2GBプラン: control plane
* N100 ミニPC 2台: worker
* Raspberry Pi 4: worker

学割が使えなくなる3月にMac Miniの最小構成を買ったので追加する予定なのですが、めんどくさくて放置しています。また、CPUが極端に弱いノードがあると他も不安定になる(特に後述するLonghorn)ので、ラズパイノードはそろそろ消したいですね。

### VPSの役割
自宅回線の契約プランがv4 over IPv6なため、固定のIPv4アドレスを使えません。このため、外部公開用としてVPSをノードに追加しています。

ただ、これのためだけにVPSを使うのはリソースがもったいないので、コントロールプレーンとしても働いてもらっています。一方で、VPSをコントロールプレーンにすると、値上げされた時の移行が面倒なので、そこはデメリットです。

## as Code

### Ansibleによるサーバー管理
ホストマシンのOS初期設定、ネットワーク(Netplan)、ファイアウォール(UFW)、WireGuard、およびK3sのインストールは、Ansibleで管理しています(まだ公開リポジトリにできていない)。

本当はNixOSでやりたいのですが、昔Longhorn周りでハマってAnsibleに移行してから戻れていません。

やっていることは以下あたりです。

- Longhornを動かすのに必要な `open-iscsi`といったホストにインストールが必要なパッケージの管理
- NetplanやUFWを用いたIPアドレスの固定や、FW設定
- WireGuardの設定: ノード内で動的にWireGuardの秘密鍵・公開鍵を生成し、設定ファイル `wg0.conf` を構築
- K3sの設定: 鍵の生成・交換やWireGuardのIPの設定

`inventory.yml` にホスト名・WAN/LAN IP・Wireguard IP・設定したいNodeのlabelやtaintsなどを追加するだけでこれらの設定が自動的に行えるようになっています。

gitにpushしたら勝手に反映されるArgoCDより変更が面倒だし遅いので、ArgoCDで管理できない最小限のことだけ設定すると良いです。

### ArgoCD
クラスタ内のアプリケーション管理には、ArgoCDを使っています。
マニフェストリポジトリは [kgtkr/public-cd](https://github.com/kgtkr/public-cd) で公開しています。

`syncPolicy.automated.xxx` の設定には気を付けましょう。
例えばargocdやlonghornを誤って削除してしまうと非常に面倒です。それらが入っている `Namespace` もです。消えると面倒な `Application` には `finalizers: []` を設定したり、PVCには `argocd.argoproj.io/sync-options: Prune=false` を設定して何重にも保険をかけておいたほうがいいです。個人クラスタならkubectl使い放題なので、ミスってgitにpushしただけでデータ消えるみたいなのはなるべく事前に防ぎましょう。やらかして復元にN時間取られるみたいなことを過去に何度もやりました。


## 永続ボリューム周り
PVには、分散ブロックストレージであるLonghornを使っています。

### MinIO へのバックアップ
Longhornではバックアップ先としてS3やNFSを設定できます。
ここでは、外部のパブリッククラウドストレージを直接指定するのではなく、同じ Kubernetes クラスタ内にデプロイした S3 互換ストレージであるMinIOをバックアップの宛先として指定しています。S3を指定するとAPIコール数が多すぎて破産します。

なお、MinIO本体のストレージには `local-path` を使用しています。

### rclone による Google Drive への同期
クラスタ内の MinIO にバックアップをとるだけでは、すべてのノードのディスクが同時に故障した際にデータが飛ぶので外部へのバックアップは必須です。
そのため、毎日rcloneを用いたバックアップ処理を CronJob で実行し、MinIO 上のバックアップデータを Google Driveに上げています。

この同期処理では以下のようなことを行っています。

- 全削除事故の防止: 同期元のMinIOが空になっていた場合にGoogle Drive側のデータが同期によって全消去されるのを防ぐため、同期前にバックアップファイル(`volume.cfg`)が一定数以上存在するかを[チェック](https://github.com/kgtkr/public-cd/blob/c2d9078f8b82b2b02109ee2058bad6f754e1367e/kgtkr/longhorn-minio/rclone.yaml#L41-L45)し、足りない場合は異常終了させています。これは `local-path` をボリュームとして使っているため、デプロイノードの変更時の事故防止です。
- OAuthトークンの自動更新: Google DriveのAPIトークン失効を防ぐため、rclone実行によってリフレッシュされたトークン情報を、Job内から `kubectl` で Kubernetes Secret に[書き戻す処理](https://github.com/kgtkr/public-cd/blob/c2d9078f8b82b2b02109ee2058bad6f754e1367e/kgtkr/longhorn-minio/rclone.yaml#L49-L58)を自動で行っています。

### Longhornの注意点
かなりのCPUとネットワーク帯域を使うため、ラズパイは使わず、同じ物理LANで繋がっている2台のミニPCのみで運用しています。昔はラズパイでも有効化していたのですが、あまりに不安定だったのでやめました。

あとこれはLonghorn関係ないですが、デイリーバックアップを1ヶ月分残すみたいなのはやめましょう。夏休みにかなり時間をかけて遊んでいたマイクラサーバーを3ヶ月くらい放置していたらデータが消えて、消えたデータでバックアップも上書きされていて詰みました。[こんな感じ](https://github.com/kgtkr/public-cd/blob/c2d9078f8b82b2b02109ee2058bad6f754e1367e/kgtkr/longhorn/templates/recurring-job.yaml) で設定しておくと、例えば `backup-daily` を指定するだけで、yearly / monthly / weekly / dailyバックアップをそれぞれ適当な数保持してくれるので便利です。

## ネットワーク周り
### Wireguard
これだけは Kubernetes ではなくAnsibleで管理していますが、全てのサーバーや、クライアントPC、スマホを同一のネットワークにするためにWireguardを使っています。
これにより、自宅のネットワークの固定IPや使えるポートについて気にしなくてよくなり、かなり管理が楽になります。
また、ArgoCDやLonghornの管理画面にパスワード設定ミスなどがあっても、VPN外からのアクセスを弾くことで保険にもなります。

### MetalLB
MetalLBを用いて、アドレスプールを以下のように定義しています。
- `default`: 自宅LANのIP(`192.168.11.10 - 30`)
- `public-ips`: VPSのパブリックIP(`163.44.96.193/32`)
- `local-ips`: VPNのIP(`192.168.190.xxx/32`)

各 Ingress Nginx の定義で `metallb.universe.tf/address-pool` を使い分けることで、バインド先を動的に切り替えています。
ちなみにここらへんの設定はよくわかっていません。完全に雰囲気です。ネットワーク難しいよ～。

### Ingress Nginx
Ingress Nginx コントローラーは、意図しないアクセスを防ぐためにパブリック用とプライベート用で2つに分離して運用しています。

* `ingress-nginx` (外部公開用):
   - コントローラーの Pod を `nodeSelector` によって VPSのノードに固定しています。
   - MetalLB を介して VPS の持つパブリックIPアドレス(`163.44.96.193`)を割り当ててバインドしています。これにより、インターネット経由のトラフィックを VPS 上で直接受け取ることができます。
* `ingress-nginx-private`:
   - ArgoCD の管理画面、Kubernetes Dashboard、各種ツールのダッシュボードなど、外部に露出させたくない管理用サービスのために使用します。URL例: `https://argocd.k3s.kgtkr.net:8443/`
   - 割り当てるIPアドレスとして、WireGuard ネットワーク上のプライベートIPプールを指定しています。これにより、VPNに接続している端末からしかアクセスできなくなります。
   - `80` / `443` ポートを使うと動いたり動かなかったり、再起動すると壊れたり直ったりして不安定だったので(普通にネットワーク周りの知識不足)、 `8080` / `8443` を使っています。

## DNSやSSL証明書の自動管理
### cert-manager
SSL/TLS 証明書の自動発行には cert-manager を使用しています。
`ingress-nginx-private` には外部からアクセスできないのでチャレンジには HTTP-01 ではなく DNS-01を使用しています。

### external-dns
external-dnsによってIngressの変更時に自動でDNSレコードを修正しています。
cert-managerもだが、まあよくある設定です。Cloudflare DNSいつもありがとう。

### ddclient
自宅のグローバルIPはddclientを用いてDNSレコードを更新することでいつでも取れるようにしています。クラスタ管理に限らずRemote Desktopなどでも使えて便利です。

## 監視系
監視のためにdatadogや、argocd-notificationsを動かしていますが、あまり見ていない。まあ最悪落ちていてもあまり迷惑かからないものばかりなので…。datadogはかなりCPU食う(ラズパイみたいな雑魚CPUだと割合的にかなり)のでなんとかしたくはあります。


## Sealed Secrets
GitOpsしたいなら機密情報の管理が問題になりますが、これはSealed Secretsを使っています。

Sealed Secretsの注意点として、クラスタが飛ぶとデータの復元が不可能になる可能性があるため、各種tokenのように再発行できないもの(例: `ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY`)はパスワードマネージャなどにも保存しておきましょう。

コントロールプレーンのバックアップや冗長化まで考えるとやっていけないので「全てのノードのデータが飛んでもansibleのapplyとArgoCDのデプロイと少しの作業だけで復元可能か」を考えて運用するべきだと考えています。

## 継続的デプロイ
HelmチャートやイメージのアップデートはRenovateに任せるとスマホからでもPRをマージするだけで更新できるので便利です。

バージョンタグを切るのが嫌いなので、自作のアプリケーションは masterにプッシュされると [kgtkr/docker-tags-gen-action](https://github.com/kgtkr/docker-tags-gen-action) を使って `20260707061339182-24a45e3` のようなタイムスタンプ付きタグで `ghcr.io` にプッシュしています。renovateの設定で `"versioning": "regex:^(?<minor>\\d{17})-[0-9a-f]{7}(-(?<compatibility>.*))?$"` しておけば自動更新に対応できるので雑運用にはおすすめです。

## 終わりに
ずっとやらなきゃと思っていたマニフェストリポジトリのpublic化、AIの助けもあり数年越しにできたので次はansibleリポジトリとdotfiles (nix home manager + nix darwin)の設定のpublic化目指します。