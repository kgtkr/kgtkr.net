---
title: Rustのcatch_unwindでスタックトレースを取得する
date: "2019-12-09T13:07:04.264Z"
update: "2019-12-09T13:07:04.264Z"
tags: ["rust"]
name: rust-panic-catch-get-stacktrace
lang: ja
otherLangs: []
---

Rustには`catch_unwind`という関数がありpanicをキャッチすることが出来ます。  
[Rustのパニック機構 - 簡潔なQ](https://qnighy.hatenablog.com/entry/2018/02/18/223000)

しかしここから得られるエラー情報がかなり少ないです。キャッチして得られるResultの`Error`型は`Box<dyn Any>`みたいな型ですが、これがほとんど`String`または`&str`となっており(今の所他の型を見ていませんが詳しい方教えて下さい)、確認した所スタックトレース情報やパニックが発生したソースの位置情報は入っていませんでした。例えば以下のコードは`panic test`と出力します。  

```rs
if let Err(e) = panic::catch_unwind(move || {
    panic!("panic test");
}) {
    println!("{}", any_to_string(&*e));
}

fn any_to_string(any: &dyn std::any::Any) -> String {
    if let Some(s) = any.downcast_ref::<String>() {
        s.clone()
    } else if let Some(s) = any.downcast_ref::<&str>() {
        s.to_string()
    } else {
        "Any".to_string()
    }
}
```

これではスタックトレース情報が取れないので`lazy_static`などと組み合わせて以下のようにしたら上手くいきました。


```rs
lazy_static! {
    pub static ref last_panic_info: RwLock<Option<(String, Backtrace)>> = { RwLock::new(None) };
}
```

```rs
  let default_hook = panic::take_hook();
  panic::set_hook(Box::new(move |panic_info| {
      *self::last_panic_info.write().unwrap() = Some((
          format!("{}", panic_info),
          Backtrace::capture(),
      ));
      default_hook(panic_info);
  }));

  if let Err(_) = panic::catch_unwind(move || {
      panic!("panic test");
  }) {
      let last = self::last_panic_info.read().unwrap();
      let last = last.as_ref().unwrap();
      println!("[catch panic]\ninfo: {}\nbacktrace: {}", last.0, last.1);
  }
```

`lazy_static`で最後のパニック情報を保存しておくグローバル変数を宣言して、`set_hook`でそこにパニック情報を保存しています。  
`set_hook`内で`Backtrace`を`capture`することでバックトレースも取得することが出来ます。  (`#![feature(backtrace)]`が必要です)。デフォルトの`hook`を一度避難させて再度呼び出したりもしています([Rustでデフォルトのパニック表示を損なわずにpanic時に行われる処理を増やす - ncaq](https://www.ncaq.net/2019/07/11/18/18/12/))  
これを環境変数`RUST_BACKTRACE=1`を設定して実行すると以下のように出力できます。

```
[catch panic]
info: panicked at 'panic test', src/main.rs:24:9
backtrace: stack backtrace:
   0: backtrace::backtrace::libunwind::trace
             at /Users/vsts/.cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.37/src/backtrace/libunwind.rs:88
      backtrace::backtrace::trace_unsynchronized
             at /Users/vsts/.cargo/registry/src/github.com-1ecc6299db9ec823/backtrace-0.3.37/src/backtrace/mod.rs:66
      std::backtrace::Backtrace::create
             at src/libstd/backtrace.rs:232
   1: std::backtrace::Backtrace::capture
             at src/libstd/backtrace.rs:207
   2: panic_test_rs::main::{{closure}}
             at src/main.rs:18
   3: std::panicking::rust_panic_with_hook
             at src/libstd/panicking.rs:473
   4: std::panicking::begin_panic
   5: panic_test_rs::main::{{closure}}
             at src/main.rs:24
   6: std::panicking::try::do_call
             at /rustc/fa0f7d0080d8e7e9eb20aa9cbf8013f96c81287f/src/libstd/panicking.rs:288
   7: __rust_maybe_catch_panic
             at src/libpanic_unwind/lib.rs:80
   8: std::panicking::try
             at /rustc/fa0f7d0080d8e7e9eb20aa9cbf8013f96c81287f/src/libstd/panicking.rs:267
   9: std::panic::catch_unwind
             at /rustc/fa0f7d0080d8e7e9eb20aa9cbf8013f96c81287f/src/libstd/panic.rs:396
  10: panic_test_rs::main
             at src/main.rs:23
  11: std::rt::lang_start::{{closure}}
             at /rustc/fa0f7d0080d8e7e9eb20aa9cbf8013f96c81287f/src/libstd/rt.rs:61
  12: std::rt::lang_start_internal::{{closure}}
             at src/libstd/rt.rs:48
      std::panicking::try::do_call
             at src/libstd/panicking.rs:288
  13: __rust_maybe_catch_panic
             at src/libpanic_unwind/lib.rs:80
  14: std::panicking::try
             at src/libstd/panicking.rs:267
      std::panic::catch_unwind
             at src/libstd/panic.rs:396
      std::rt::lang_start_internal
             at src/libstd/rt.rs:47
  15: std::rt::lang_start
             at /rustc/fa0f7d0080d8e7e9eb20aa9cbf8013f96c81287f/src/libstd/rt.rs:61
  16: <panic_test_rs::last_panic_info as core::ops::deref::Deref>::deref
```

ちなみに`RUST_BACKTRACE`を設定しないと以下のような出力になります。

```
[catch panic]
info: panicked at 'panic test', src/main.rs:24:9
backtrace: disabled backtrace
```
