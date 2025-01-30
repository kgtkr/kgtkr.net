---
title: WSLでgpgをパスフレーズの入力なしで使う
date: "2025-01-30T10:11:18.903Z"
update: "2025-01-30T10:11:18.903Z"
tags: ["wsl", "gpg", "ssh"]
name: wsl-gpg-without-passphrase
lang: ja
otherLangs: []
---

## 注意
私はセキュリティに詳しいわけではないので、この記事で紹介する内容はあまり安全ではない方法かもしれません。そういうのがあれば教えて頂けると助かります。

## はじめに
WSLを使っていてsudo / ssh / gpgなどを使うときにパスフレーズをいちいち入力するのはめんどくさいです。しかしパスワードなしでsudoを使えるようにしたり、ssh/gpgキーにパスフレーズを設定しないのはさすがに抵抗があります。

sudoは [WSL Hello sudo](https://github.com/nullpo-head/WSL-Hello-sudo) というsudoを使うときにパスワードを要求するのではなくWindows Helloの認証を要求してくるようになる便利なツールがあるので使っています。

sshは1Passwordユーザーであればかなり昔からssh-agent機能がついており、[1Passwordのssh-agent機能をWSL2でも利用する
](https://qiita.com/mfunaki/items/db6e1ffcf1e6f1eff252)のような方法でWSLから使うことができます。しかしBitwardenには最近までこの機能がなく困っていたのですが、最近実装され1Passwordと同じ方法でWSLから使うことができるようになりました。

問題はgpgです。1PasswordもBitwardenもgpg-agent機能はついていません。そのためパスフレーズはパスワードマネージャに保存し、毎回手動でpinentry-qtに入力していました。


## pinentryについて
pinentryはgpg-agentのパスフレーズ入力を受け付けるプログラムで、標準入出力を使ってやり取りをしているので最小限の物であればシェルスクリプトで簡単に実装できます。例えば毎回固定値`"abc"`をパスフレーズとしてgpg-agentに返すpinentryは以下のようになります。

```sh
echo "OK"
while IFS= read -r cmd; do
    case "$cmd" in
        "GETPIN")
            echo "D abc"
            echo "OK"
            ;;
        "BYE")
            echo "OK"
            exit 0
            ;;
        *)
            echo "OK"
            ;;
    esac
done
```

この仕組みを使って、 [1Password cliを使って1Passwordに保存しているパスフレーズを取ってきたり](https://gist.github.com/samj/66a2e8c601d4ada405080a227935cb0a)、[Bitwarden cliを使って同じことをしたり](https://github.com/mrahbar/bitwarden-pinentry)、[WSLからpowershell.exeを呼び出すことでWindowsのCredential Managerにパスフレーズを保存したり](https://github.com/diablodale/pinentry-wsl-ps1)するpinentryがあります。

ただBitwarden cliはセッション情報を管理する必要があるのですが、これを平文で保存するとBitwardenに保存されている全ての情報の読み取り/書き込みが行えるためgpgの鍵を平文で保存するより危険です。しかしセッション情報を保存しないと毎回Bitwardenのパスワードを入力する必要があり(cliはデスクトップアプリと違いWindows Helloに対応していない)何の解決にもなりません。1Password cliはデスクトップアプリからデータを持ってこれる(=Windows Helloが使える)ようですが使っていないので…。あとWSLの1Password cliからできるかは分かりません。

pinentry-wsl-ps1はpowershellにモジュールをインストールしないといけなかったりでめんどくさいです。Linuxの環境はnixで管理しているのでコマンド1つで環境構築できるのですが、Windowsが絡むとそこは手動でやる必要がありできれば避けたいです。あとCredential Managerからパスフレーズを取得するときに何か認証などを求められるわけではなくPowerShellのコマンド1つで取得できるので本当に意味あるのかという疑問もあります。

## ssh-agentを使ってgpgのパスフレーズを暗号化する
ssh-agentはBitwardenのものをWSLから使えるので、これを使って暗号化したパスフレーズをファイルを保存しておいて、pinentryで復号化してgpg-agentに渡せば上手くいきそうです。しかしssh-agentはデータに署名をするためのもので、暗号化するためのものではありません。


しかしいいツールはないか探していると[sshcrypt](https://github.com/leighmcculloch/sshcrypt)という欲しいツールがありました(リポジトリはアーカイブ化されていますが一応使えます)。簡略化すると以下のような仕組みです(多分)

```
enc(X):
  Y=random_bytes()
  KEY=call_ssh_agent(Y) // ssh-agentを使ってYに署名
  X_ENC=encrypt(X, KEY)
  return (Y, X_ENC)

dec(Y, X_ENC):
  KEY=call_ssh_agent(Y)
  X=decrypt(X_ENC, KEY)
  return X
```

これを使って `echo -n "pass" | sshcrypt agent-encrypt > $XDG_CONFIG_HOME/pinentry-sshcrypt/passphrase` とパスフレーズを事前に保存しておき、以下の `pinentry` として使えるシェルスクリプトで復号化します。

```sh
echo "OK"
while IFS= read -r cmd; do
    case "$cmd" in
        "GETPIN")
            PASSPHRASE=$(sshcrypt agent-decrypt < "$XDG_CONFIG_HOME/pinentry-sshcrypt/passphrase")
            echo "D $PASSPHRASE"
            echo "OK"
            ;;
        "BYE")
            echo "OK"
            exit 0
            ;;
        *)
            echo "OK"
            ;;
    esac
done
```

これを適当に保存して実行権限をつけ `gpg-agent.conf` の `pinentry-program` に指定すれば動きます。Bitwardenのssh-agentを使っているならWSLを再起動したり、キャッシュがTTLに達するとWindowsのデスクトップ版Bitwardenが「sshキーへのアクセスが要求されたけどいい？」のような確認画面が出てきて、OKを押すとgpgが使えるようになります。

注意点としては `sshcrypt` は `SSH_AUTH_SOCK` に依存しているので起動順は `ssh-agent` -> `gpg-agent` にしましょう。また、複数のgpgキーがある場合、キーによってパスフレーズを変えるといったことはできません(`SETKEYINFO` コマンドでキーのIDが送られてくるのでこれ使えばできるとは思いますが…)。また、パスフレーズを使うときはいいですが、鍵に設定しなおす時は対応していないのでそういうときはpinentry-qtあたりを一時的に設定してください。
