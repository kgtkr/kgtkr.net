---
title: Kubernetes上のMinioでPresigned URLを使う
date: "2025-02-14T17:05:30.724Z"
update: "2025-02-14T17:05:30.724Z"
tags: ["k8s", "aws", "minio", "server", "nix"]
name: k8s-minio-presigned-url
lang: ja
otherLangs: []
---

## MinioとPresigned URL
AWSのS3にはPresigned URLという署名付きURLを発行し、一時的なアクセス権を付与する仕組みがあります。これを使うと、例えばAPIサーバーが特定の画像へのアクセス権を発行し、クライアントはプロキシを経由せずに直接S3から画像を取得するといったことができます。
しかし、この機能をKubernetesでホストしているMinio(S3互換のオブジェクトストレージ)で使おうとすると問題が起きます。AWS SDKは `AWS_ENDPOINTS` で指定されたURLをベースに署名付きURLを発行します。そのため、 `AWS_ENDPOINTS=http://minio.foo.svc.cluster.local:9000` と指定されていると署名付きURLはこのURLをベースに発行されるのでクライアントからアクセスできません。署名付きは特定のオブジェクトへのパスだけでなくプロトコルやホスト名も含めて行われるため、プロトコルを `https` に書き換えたり、ホスト名を `minio.example.com` に書き換えると署名の検証に失敗します。`AWS_ENDPOINTS=https://minio.example.com` と指定すると一応動きますが、APIサーバーからminioへのアクセスもインターネット経由になってしまうためあまり効率的ではありません。

また、アプリケーションコードを変更して `AWS_ENDPOINTS_FOR_PRESIGNED` のような環境変数を追加することで対応することもできますが、配布されているDockerイメージを変更するのはメンテナンスがめんどくさいので避けたいです。そこで今回はk8sのCoreDNSにレコードを追加しつつ、minioをhttpsで動かすことで対応します。

## AWS_ENDPOINTSなどの修正
まずアプリケーションの `AWS_ENDPOINTS=http://minio.foo.svc.cluster.local:9000` を `AWS_ENDPOINTS=https://minio.example.com` に修正し、とりあえず動くようにします。
また、minioのsvcのportを443に設定しておきましょう。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: minio
spec:
  ports:
    - port: 443
      name: s3
      targetPort: 9000
```

## CoreDNSにレコードを追加
`kube-system` の `coredns` cmに以下の設定を追加することでクラスタ内から `minio.example.com` にアクセスしたときはクラスタのネットワーク経由で、クラスタ外から `minio.example.com` にアクセスしたときはインターネット経由でMinioにアクセスすることができます。

```
.:53 {
  rewrite name minio.example.com minio.foo.svc.cluster.local
}
```

k3sであれば元々あるcmを修正しなくても以下のリソースを作成すれば対応できます。

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: coredns-custom
  namespace: kube-system
data:
  minio.override: |
    rewrite name minio.example.com minio.foo.svc.cluster.local
```

## Minioをhttpsで動かす
minioは秘密鍵を設定することでhttpsで動かすことができます。cert-manager+ingressを使っているなら、既にingressで使っている証明書があるはずなので、それをminioのPodに設定します。今回はcert-managerで発行した証明書の名前を `minio-ingress-cert` としたときの設定です。

```yaml
# ...
volumeMounts:
- name: minio-ingress-cert
  mountPath: "/etc/minio/certs"
  readOnly: true
- name: ca-dir
  mountPath: "/etc/minio/certs/CAs"
  readOnly: true
# ...
volumes:
- name: minio-ingress-cert
  secret:
    secretName: minio-ingress-cert
    defaultMode: 420
    items:
    - key: tls.crt
      path: public.crt
    - key: tls.key
      path: private.key
- name: ca-dir
  emptyDir: {}
# ...
minio server \
  # ...
  --certs-dir=/etc/minio/certs # 追加
```

`/etc/minio/certs/CAs` ディレクトリが存在しないとMinioがディレクトリを作ろうとするがreadonly filesystemなため作れずエラーで起動しません。そのためemptyDirを適当に作ってあげています。

また、ingressのアノテーションに `nginx.ingress.kubernetes.io/backend-protocol: "HTTPS"` も追加しておきます。

## おわり
この設定をすることで同じエンドポイントを使いつつクラスタの内外で別のルーティングを行うことで効率的にアクセスすることができるようになりました。Minioに限らず使える方法だと思います。

## 余談: 自己証明書を使う方法
実はこの記事を書き始めた時点ではcert-managerで自己証明書を発行してアプリケーションPodの `initContainers` で `SSL_CERT_FILE` に設定してあるファイルと自己証明書の `ca.crt` をマージして…という方法を取っておりもう少し長い記事になる予定でした。しかし記事を書いている途中で「これ自己証明書を使わなくても正規の証明書既にあるじゃん」と気づいてしまい、修正したら頑張って書いたマニフェストの大半が消え、なんか記事も短くなってしまいました。
