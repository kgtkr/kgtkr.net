---
title: sqldefをマイグレーションコード生成ツールとして使う
date: "2022-02-10T15:08:29.936Z"
update: "2022-02-10T15:08:29.936Z"
tags: ["sql"]
name: sqldef-for-generate-migration
lang: ja
otherLangs: []
---

## はじめに
sqldefという目標とするスキーマを書くと, DBに接続して現在のスキーマと比較し, DBのスキーマが現在のスキーマに一致するように `CREATE TABLE` や `ALTER TABLE` などを実行してくれるGo製のcliツールがあります. 詳細は[GitHub](https://github.com/k0kubun/sqldef)や[作者のブログ](https://k0kubun.hatenablog.com/entry/2018/08/25/114455)を見てください.

これを使うことでスキーマファイルを1つリポジトリに置いておけばいいので, マイグレーションコードを手書きした時の, DBのスキーマの全体像が分かりにくいという問題が解決します. しかし個人的にはマイグレーションコードはリポジトリにコミットして, それを実行したいです. そこで今回はsqldefをマイグレーションコード生成ツールとして使ってみます.

簡単にいうとprisma.jsのmigrate機能のような使い方です([ドキュメント](https://www.prisma.io/docs/concepts/components/prisma-migrate)). prisma.jsは独自のDSLでDBのスキーマを定義し, それをDBのスキーマと比較し, マイグレーションコードを生成してくれます. しかし, 独自DSLを使う必要があり, ライブラリ依存です. 今回の方法は, 一般的なSQLを使うことができ, 言語/ライブラリ関係なく使えます.

## コード生成ツールとして使うsqldef
sqldefは `-f` オプションを2個指定することができ, こうすると1個目は目標とするスキーマファイル, 2個目は現在のスキーマファイルとなり, 現在のスキーマを目標スキーマにするためのSQLを標準出力に出力してくれます. 今回はPostgresを使うので `psqldef` コマンドを使っていますが, 必要に応じて `mysqldef` コマンドなどを使ってください.

```sh
$ cat a.sql
CREATE TABLE "user" (
  "id" VARCHAR(32) PRIMARY KEY,
  "password" VARCHAR(256) NOT NULL
);

$ cat b.sql
CREATE TABLE "user" (
  "id" VARCHAR(32) PRIMARY KEY,
  "icon" VARCHAR(256),
  "password" VARCHAR(256) NOT NULL
);

$ psqldef -f a.sql -f b.sql
-- dry run --
ALTER TABLE "public"."user" ADD COLUMN "icon" varchar(256);
```

これを使えばマイグレーションコードを生成することができます. upだけでなくdownも欲しい場合は `-f` オプションの順番を逆にすればよいです.

## マイグレーションコードを生成するシェルスクリプト
Rustのsqlxというライブラリを対象にしたマイグレーションコードを生成するシェルスクリプトです. sqlxはマイグレーションコードを `migrations/yyyymmddHHMMSS_name.{up, down}.sql` /  というファイル名で配置します. 少し修正すれば他のライブラリでも使えるはずです. スキーマは `./schema.sql` に配置することを想定しています.

```sh
# 環境変数
# name: マイグレーション名. コマンドライン引数などで受け取るとよい
# DATABASE_*: DBの接続情報.

now=`date -u "+%Y%m%d%H%M%S"`
current_schema=`mktemp`

sqlx migrate run
PGSSLMODE=disable PGPASSWORD=$DATABASE_PASSWORD psqldef -U $DATABASE_USER -h $DATABASE_HOST -p $DATABASE_PORT --export $DATABASE_NAME > $current_schema
psqldef -f $current_schema -f ./schema.sql | grep -v _sqlx_migrations | tail -n +2 > migrations/${now}_${name}.up.sql
psqldef -f ./schema.sql -f $current_schema | sed '/_sqlx_migrations/,/);/d' | tail -n +2 > migrations/${now}_${name}.down.sql
rm $current_schema
sqlx migrate run
```

まず念の為に現在作成されているマイグレーションを実行し (`sqlx migrate run`), 現在のスキーマをダンプ, 現在のスキーマ→新しいスキーマにするコードをupファイルとして, 新しいスキーマ→現在のスキーマにするコードをdownファイルとして保存します. そして最後に新しく作ったマイグレーションを実行するためにもう一度 `sqlx migrate run` しています.

`grep` / `sed` で結果を加工しているのはsqlxがどこまでマイグレーションコードを実行したかを記録するために作る `_sqlx_migrations` というテーブルを無視するためです. upファイルの作成時は `_sqlx_migrations` テーブルを削除するコードが, downファイルの作成時は `_sqlx_migrations` テーブルを作成するコードが生成されるので, このコードを消しています. `tail` は `-- dry run --` という出力を無視するために使っています.

## 実際に使ってみる
さっきのシェルスクリプトを `add-migration.sh` という名前で保存して実際に使ってみます.

```sh
$ cat schema.sql
CREATE TABLE "user" (
  "id" VARCHAR(32) PRIMARY KEY,
  "password" VARCHAR(256) NOT NULL
);

$ ./add-migration.sh init
Applied 20220210150134/migrate init (10.9742ms)

$ cat ./migrations/20220210150134_init.up.sql 
CREATE TABLE "user" (
  "id" VARCHAR(32) PRIMARY KEY,
  "password" VARCHAR(256) NOT NULL
);

$ cat ./migrations/20220210150134_init.down.sql 
DROP TABLE "public"."user";

# edit schema.sql

$ cat schema.sql
CREATE TABLE "user" (
  "id" VARCHAR(32) PRIMARY KEY,
  "icon" VARCHAR(256),
  "password" VARCHAR(256) NOT NULL
);

$ ./add-migration.sh add-icon                  
Applied 20220210150345/migrate add-icon (11.379ms)

$ cat ./migrations/20220210150345_add-icon.up.sql 
ALTER TABLE "public"."user" ADD COLUMN "icon" varchar(256);

$ cat ./migrations/20220210150345_add-icon.down.sql
ALTER TABLE "public"."user" DROP COLUMN "icon";
```

上手くいっていますね.
