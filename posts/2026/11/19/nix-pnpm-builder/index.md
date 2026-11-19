---
title: "pnpm の依存関係を Nix で効率的にキャッシュしたい"
date: "2026-11-19T08:17:29.160Z"
update: "2026-11-19T08:17:29.160Z"
tags: ["herp", "nix", "javascript"]
name: nix-pnpm-builder
lang: ja
otherLangs: []
disableBreaks: true
---

## はじめに

[HERP](https://herp.co.jp/) では社内の標準言語・ランタイムとして TypeScript + Node.js を、パッケージマネージャとして pnpm を採用している。また、アプリケーションのビルドやコンテナイメージの生成には Nix を使っている。
しかし、Node.js + pnpm のアプリケーションを Nix で素直にビルドすると巨大な `node_modules` を含む store path ができてしまい、キャッシュ効率が非常に悪い。
例えば、1 つの依存関係を更新しただけで、数百 MB の store path を再生成してしまうため、キャッシュが全く効かないし、CI も時間がかかってしまう。

社内の標準開発環境がこの状態なのは非常に問題なので改善に取り組み、ビルダーライブラリ **nix-pnpm-builder** として公開した。
- [herp-inc/nix-pnpm-builder](https://github.com/herp-inc/nix-pnpm-builder)

その結果、社内の主要コンポーネントに依存を 1 つ追加した時のビルドにおいて以下の改善が見られた。

* **新たにビルドされる store path のサイズ:** 1695 MiB -> 240 MiB
  * `node_modules` とアプリケーションコード全ての合計サイズから、追加されたライブラリとアプリケーションコードのサイズのみになった
* **ビルド時間:** 304 秒 -> 71 秒

この記事では、以下の内容について解説する。

1. nixpkgs 標準の方法で pnpm パッケージを Nix でビルドする方法
2. 「良い開発体験で」ビルドする方法
3. 効率よくビルドする方法

## nixpkgs 標準の方法で pnpm パッケージを Nix でビルドする
Nix ではビルドの純粋性を保つために、原則ビルド時にネットワークアクセスはできず、この原則を破る場合はビルド結果のハッシュ値を指定する必要がある (FOD・Fixed-Output Derivation)。
この仕組みを使って、依存全体 (≒ `node_modules` 全体) のハッシュ値を指定することで pnpm パッケージをビルドするのが nixpkgs にある `fetchPnpmDeps` / `pnpmConfigHook` である。

```nix
stdenv.mkDerivation {
  # ...

  pnpmDeps = fetchPnpmDeps {
    # ...
    hash = "sha256-xxxx";
  };

  nativeBuildInputs = [
    # ...
    pnpmConfigHook
  ];

  buildPhase = ''
    runHook preBuild
    # node_modules にアクセスできる
    runHook postBuild
  '';
}
```

これによって、とりあえずビルドできるが以下の 2 つの課題がある。

まず、ハッシュ値の更新がめんどくさい。
`fetchPnpmDeps` に指定する `hash` 引数は依存全体のハッシュ値であるため pnpm のロックファイルが変わる度に更新する必要がある。
これ自体は簡単なシェルスクリプトを実行するだけでできるが、普段の開発で Nix を意識しなければならないのは開発体験が悪い。
エンジニア全員が Nix に詳しいわけではない。

次に、プライベートレジストリ対応に `--impure` オプションが必要である。
プライベートレジストリは `.npmrc` に `//foo_registry:_authToken=${FOO_TOKEN}` と書くことで使うことができるが、Nix のビルド環境では環境変数にもアクセスできない。
この制限を回避するには、ビルド時に `--impure` オプションをつけた上で、`fetchPnpmDeps` の引数に `FOO_TOKEN = builtins.getEnv "FOO_TOKEN"` を追加することが必要である。
しかしこれは、ビルドの純粋性という Nix の大きなメリットを潰すことになり、なおかつセキュリティ的にも良くないため避けたい。

## Nix で pnpm パッケージを「良い開発体験で」ビルドする
`fetchPnpmDeps` を使った方法の 2 つの課題は、pnpm に各パッケージのフェッチを任せていたため発生していた。
この課題は、tgz のフェッチまでは Nix で行い、pnpm をオフラインモードで使うことで解決する。
ポイントは以下である。

1. 依存全体のハッシュ値を指定する必要がある大きな FOD ではなく、各依存の tgz ごとにハッシュ値を指定する小さな FOD に分割する
2. ハッシュ値は pnpm のロックファイルにある sha512 を使う
3. tgz のフェッチには `nix.conf` の `netrc-file` 情報を参照してくれる `nix/fetchurl.nix` を使う

2 によって pnpm が自動生成するロックファイルのハッシュ値を使うようになるので、普段の開発において Nix を意識する必要がなくなる。
また、3 によって認証も Nix の仕組みを使うことになるので、`--impure` を使って環境変数でトークンを渡す必要もなくなる。

具体的な処理は以下のようになっている。

まず、`pnpm-lock.yaml` にパッチを当てることで pnpm がネットワークアクセスをしないようにする[^patchlock]。

`pnpm-lock.yaml` を以下のように書き換える。

```diff:yaml
packages:
  commander@14.0.3:
    resolution:
      integrity: sha512-H+y0Jo/T1RZ9qPP4Eh1pkcQcLRglraJaSLoyOtHxu6AapkjWVCy2Sit1QQ4x3Dng8qDlSsZEet7g5Pq06MvTgw==
+     tarball: 'file:///nix/store/z6r821dqpfivvj4mmqyapnyzfhm6lkl9-commander-14.0.3.tgz'
    engines: {node: '>=20'}
```

この後 `PNPM_CONFIG_TRUST_LOCKFILE=true pnpm install --frozen-lockfile --offline` するとサンドボックス内で `node_modules` を生成できる。

tgz のパスは以下の Nix 式で得ることができる。

```nix
import <nix/fetchurl.nix> {
  url = "https://registry.npmjs.org/commander/-/commander-14.0.3.tgz";
  hash = "sha512-H+y0Jo/T1RZ9qPP4Eh1pkcQcLRglraJaSLoyOtHxu6AapkjWVCy2Sit1QQ4x3Dng8qDlSsZEet7g5Pq06MvTgw==";
}
```

tgz の URL については npm と違いロックファイルに存在しないため、独自で `.npmrc` などを解析した上で組み立てる必要がある[^tarballurl]。

また、パッチ後の `pnpm-lock.yaml` を store path に残すと、全ての `tgz` ファイルに実行時依存があると Nix が判断してしまうため、`installPhase` でパッチ前のものに戻す必要がある。

この方法だとキャッシュ効率は悪いが、`node_modules` の構築をほとんど pnpm に任せることができる。
またバンドラーを使っているアプリケーションであればキャッシュ効率は問題にならない。1 つの drv 内で `node_modules` の構築 → バンドラーコマンドの実行 → `node_modules` の削除までやってしまうことで、最終的な store path に巨大な `node_modules` が残らないためである。

## 効率よくビルドする
キャッシュ効率が悪いのは、1 つの store path に巨大な `node_modules` が含まれているからである。
そのため各 tgz を別々の store path に展開したいが、Node.js が求める形式の `node_modules` をシンボリックリンクによって構築するのは難しい。

### node_modules のシンボリックリンクの仕様と課題

例えば `app -> a -> b` と依存している状況を考える。
Node.js はシンボリックリンクを実体のパスに解決してから、そこを起点に `node_modules` を探すため、以下のような構造にする必要がある。

```
/app/
├── main.js
└── node_modules/
    └── a -> /nix/store/xxx-a

/nix/store/xxx-a/
├── node_modules/
│   └── b -> /nix/store/yyy-b
├── package.json
└── index.js

/nix/store/yyy-b/
├── package.json
└── index.js
```

しかし、この配置では `a` のバージョンは変えずに `b` のバージョンだけを更新した場合も、`a` の再ビルドが必要になるため非効率である。
また、Node.js ではパッケージが循環参照することがあるが、Nix では循環参照を認めていないため対応できない。

これらの問題は Node.js の実行時に `--preserve-symlinks` オプションをつけることで、`node_modules` を以下のような構造にできるため、解決する。

```
/app/
├── main.js
└── node_modules/
    ├── a -> /nix/store/xxx-a
    └── b -> /nix/store/yyy-b
```

しかし、こうすると同一パッケージの複数バージョンの共存が不可能になってしまう。

### package map の活用
そこで使えるのが Node.js の実験的機能 package map (`--experimental-package-map`) である。
この機能を使うと、`node_modules` を辿る代わりに、各パッケージの場所とそこから見える依存が書かれた以下のような JSON を元に依存を解決する。

```json
{
  "packages": {
    ".": {
      "url": "..",
      "dependencies": {
        "commander": "commander@14.0.3",
        "example": "."
      }
    },
    "commander@14.0.3": {
      "url": "./.pnpm/commander@14.0.3/node_modules/commander",
      "dependencies": {
        "commander": "commander@14.0.3"
      }
    }
  }
}
```

これは、ルートプロジェクトから `commander` を import すると `./.pnpm/commander@14.0.3/node_modules/commander` に実体がある `commander@14.0.3` を import するということを表している。
非常に単純な JSON であるため機械的に書き換えやすく、同一パッケージの複数バージョンの共存にも対応している。
また、パッケージ同士の依存関係をシンボリックリンクで表す必要がないため、効率的にキャッシュでき、Nix の循環依存の問題も発生しない。

pnpm もこの機能に対応しており、`PNPM_CONFIG_NODE_EXPERIMENTAL_PACKAGE_MAP=true` を設定することで package map を `node_modules/.package-map.json` に書き出してくれる。

この `url` を各依存の tgz を展開した store path に書き換える。
`<store path>/` に展開しても動くが、ライブラリのパスを見てライブラリ名を検出しているライブラリ (例: Datadog の APM ライブラリである `dd-trace`) がライブラリ名を検出できなくなるため、`<store path>/node_modules/<package name>/` に展開している。
書き換えの例は以下である。

```diff:json
{
  "packages": {
    ".": {
-     "url": "..",
+     "url": "file:///nix/store/…-example",
      "dependencies": {
        "commander": "commander@14.0.3",
        "example": "."
      }
    },
    "commander@14.0.3": {
-     "url": "./.pnpm/commander@14.0.3/node_modules/commander",
+     "url": "file:///nix/store/c7nqpjx1wmywq7fz1ix1vdn2nx07f3vr-pnpm-pm-commander14.0.3/node_modules/commander",
      "dependencies": {
        "commander": "commander@14.0.3"
      }
    }
  }
}
```

### 高速に package map を生成する
package map は構造上ロックファイルから純粋な計算によって生成可能であるが、pnpm は `node_modules` を書き出さずに package map のみを生成するコマンドを提供していない。
そのため、`PNPM_CONFIG_NODE_EXPERIMENTAL_PACKAGE_MAP=true pnpm install` で package map を生成する必要があるが、このコマンドは全パッケージの tgz 展開処理が走るため時間がかかってしまう。

pnpm の内部ライブラリである `@pnpm/lockfile.to-pnp` の `lockfileToPackageMap` を使うことで、全ての tgz を展開することなく高速に生成できる。
しかし、使っている pnpm とバージョンを合わせるのが手間であり、なおかつ pnpm 12 から Rust 製になったことで npm で公開されている内部ライブラリも更新されなくなってしまった。

そこで、公開コマンドを使った以下のもっと簡単な方法を採用した[^genpm]。

1. `package.json` (中身は `{}`) のみを含むほぼ空の tgz を 1 つ用意する。このファイルの sha512 を計算する
2. ロックファイルの `tarball` と `integrity` を作成した tgz のパスと sha512 で置き換える
3. `PNPM_CONFIG_TRUST_LOCKFILE=true PNPM_CONFIG_NODE_EXPERIMENTAL_PACKAGE_MAP=true pnpm install --ignore-scripts` する

### ネイティブ依存に対応する
この方法では `pnpm install` を使わずに tgz を自前で展開しているため、install script の実行にも対応する必要がある[^native]。

1. package map を生成するときに `pnpm-workspace.yaml` の `allowBuilds` を読んでビルドが必要なパッケージを列挙する
2. これらのパッケージは、tgz を展開するだけでなく、展開した後に script を走らせる
3. script は npm の慣習どおり `preinstall`、`install`、`postinstall` の順に走らせる。全て存在せず `binding.gyp` がある場合は `node-gyp rebuild` を実行する

script の中でも依存を解決できるように、対象パッケージの依存の閉包だけを載せたビルド用の package map を作る。循環依存を避けるため、依存には script を走らせる前の展開物を使う。

`node-gyp` のよくある書き方 (`binding.gyp` の `<!(node -e "require('nan')")`) に対応するために、script を走らせている間だけ、ビルドするパッケージの直接依存を `<store path>/node_modules/<package name>` に symlink している。

ただし、全てのパッケージに対応できているわけではない。例えばビルドは sandbox の中なので、install 時にネットワークからバイナリをダウンロードするパッケージは動かない。

また、展開するだけのパッケージは入力が tgz だけなので他の依存が変わっても作り直されないが、script を走らせるパッケージはビルド用の package map に依存の閉包が入るので、閉包のどれかが変わると作り直しになるというデメリットもある。

### experimental なフラグを使わずに package map を使う
Node.js に package map を使った依存解決をさせるには実験的機能の有効化が必要だが、さすがにプロダクション環境で実験的機能は使いたくない。例えば Node.js のバージョンアップで突然動作が変わったりすると、脆弱性対応のための緊急アップデートに支障が出てしまうかもしれない。
そこで、現在の package map の解決の仕組みをエミュレーションするローダーを独自で実装し、`--require` オプションに渡すことで対応した。package map の解決の仕組みはそこまで複雑ではないため (`node_modules` を探索するデフォルトのローダーより静的に決まる部分が多く単純である) `registerHooks` を使ってかなり短い行数で実装できる[^loader]。

また `registerHooks` のフックは `import` や `require()` を使った解決にしか効かない。
`dd-trace` は `Module._resolveLookupPaths` を直接呼んでパッケージを判定しているため、そのままでは動かない。
そこで、このカスタムローダーでは `Module._resolveLookupPaths` も package map の仕組みに合わせてモンキーパッチしている。

## ベンチマーク
冒頭で紹介したベンチマークの詳細について記す。

### 計測環境
* M4 MacBook Air
* RAM 24GB

### ビルドするアプリケーション
社内の主要なバックエンドコンポーネント
* **直接依存:** 182
* **ロックファイルにあるパッケージ数**: 1905
* **実行時依存**: 680

### 比較対象
* nixpkgs にある `fetchPnpmDeps` / `pnpmConfigHook` を使ったビルド（『nixpkgs 標準の方法で pnpm パッケージを Nix でビルドする方法』で紹介した方法）
* nix-pnpm-builder の `buildPnpmPackage` を使ったビルド（『Nix で pnpm パッケージを「良い開発体験で」ビルドする』で紹介した方法）
* nix-pnpm-builder の `buildPnpmGranularPackage` を使ったビルド（『効率よくビルドする』で紹介した方法）

### 計測方法
次の 3 つの操作について計測した。

* **フルビルド:** このプロジェクトのビルドで作られた store path を消した状態からビルドする
* **依存の追加:** ビルド済みの状態から、依存を 1 つ (`left-pad@1.3.0`) 追加してビルドする
* **ソースコードの変更:** ビルド済みの状態から、ソースコードを 1 行変更してビルドする

計測したのは次の 3 つである。

* **ビルド時間:** `nix build` の実行時間。評価と IFD の時間も含む
* **新たに作られた store path の合計サイズ:** ビルドの前後で増えた store path の NAR サイズの合計。ビルド時のみに使う依存も含む
* **実行時の closure サイズ:** 出力の runtime closure のサイズ

### 結果
#### フルビルド
| 方式 | ビルド時間 | 新たに作られた store path |
| --- | --- | --- |
| `fetchPnpmDeps` / `pnpmConfigHook` | 305 秒 | 1597 MiB (4 個) |
| `buildPnpmPackage` | 432 秒 | 1559 MiB (989 個) |
| `buildPnpmGranularPackage` | 667 秒 | 1552 MiB (1674 個) |

#### 依存の追加
| 方式 | ビルド時間 | 新たに作られた store path |
| --- | --- | --- |
| `fetchPnpmDeps` / `pnpmConfigHook` | 304 秒 | 1695 MiB |
| `buildPnpmPackage` | 154 秒 | 641 MiB |
| `buildPnpmGranularPackage` | 71 秒 | 240 MiB |

#### ソースコードの 1 行変更
| 方式 | ビルド時間 | 新たに作られた store path |
| --- | --- | --- |
| `fetchPnpmDeps` / `pnpmConfigHook` | 131 秒 | 595 MiB |
| `buildPnpmPackage` | 121 秒 | 595 MiB |
| `buildPnpmGranularPackage` | 20 秒 | 195 MiB |

#### 実行時の closure サイズ
| 方式 | closure サイズ |
| --- | --- |
| `fetchPnpmDeps` / `pnpmConfigHook` | 697 MiB |
| `buildPnpmPackage` | 697 MiB |
| `buildPnpmGranularPackage` | 690 MiB |

### 考察
フルビルドに関しては `buildPnpmGranularPackage` が最も遅い。
これは、`fetchPnpmDeps` は Nix に依存せずに依存の取得から `node_modules` の書き出しまでを行うため、大量の store path を作る必要がなく、オーバーヘッドが小さいからであると考えられる。

一方、依存の追加とソースコードの変更時のパフォーマンスは `buildPnpmGranularPackage` が大きく上回る。
普段の開発においてフルビルドを行うことは滅多にないため、手元でのビルド時間や CI 時間の短縮のためには、こちらの方が重要である。

実行時の closure サイズについては、いずれも本番用の依存だけを残すため、どの方式もほぼ同じである。


## 広告
このブログは業務時間内に書かれました。

HERP ではエンジニアを募集しています。興味がある方は以下の求人をぜひ見てみてください。
* [AA20_オープンポジション_Development](https://herp.careers/v1/herpinc/lZm5yTH2bvfy?utm_source=self&utm_medium=article&utm_content=d42vy6ri39)

[^native]: [package-map/default.nix#L231-L296](https://github.com/herp-inc/nix-pnpm-builder/blob/c30bf2914718f2b8ffaa3c27ceaa4efcb27a3837/package-map/default.nix#L231-L296)
[^genpm]: [package-map/default.nix#L85-L128](https://github.com/herp-inc/nix-pnpm-builder/blob/c30bf2914718f2b8ffaa3c27ceaa4efcb27a3837/package-map/default.nix#L85-L128)
[^loader]: [package-map/loader.cjs](https://github.com/herp-inc/nix-pnpm-builder/blob/c30bf2914718f2b8ffaa3c27ceaa4efcb27a3837/package-map/loader.cjs)
[^patchlock]: [config-hook.nix#L29-L46](https://github.com/herp-inc/nix-pnpm-builder/blob/c30bf2914718f2b8ffaa3c27ceaa4efcb27a3837/config-hook.nix#L29-L46)
[^tarballurl]: [lib.nix](https://github.com/herp-inc/nix-pnpm-builder/blob/c30bf2914718f2b8ffaa3c27ceaa4efcb27a3837/lib.nix)
