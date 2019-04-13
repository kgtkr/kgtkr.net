---
title: TypeScriptでScalaのcase classのcopyのような物を実装する(継承対応)
date: "2018-01-01T12:28:05.000Z"
description: ""
tags: ["typescript"]
---
# 初めに
継承が必要ない場合は他の方が書いた下記記事を参考にして下さい。
https://qiita.com/nwtgck/items/bbfd6e3ca16857eb9c34

# 必要な物
ts-copyable:上で紹介されていたnpmパッケージ
applyMixins関数:[ここ](https://www.typescriptlang.org/docs/handbook/mixins.html)から`utils.ts`にコピペしておいて下さい。export忘れずに。

# 実装の方針
mixinを使う。

# 実装
```ts
import Copyable, { PartialMap } from "ts-copyable";
import { applyMixins } from "./utils";

export abstract class Base<C extends Base<C>>{
  abstract readonly a: number;
  abstract readonly b: string;

  abstract copy(partial: Partial<Base<C>>): C;
  abstract mapCopy(partial: PartialMap<Base<C>>): C;

  addA(x: number): C {
    return this.mapCopy({ a: a => a + x })
  }

  setB(b: string): C {
    return this.copy({ b });
  }
}

export class Child extends Copyable<Child> implements Base<Child> {
  constructor(
    public readonly a: number,
    public readonly b: string,
    public readonly c: boolean) {
    super(Child);
  }

  addA: (x: number) => Child;
  setB: (b: string) => Child;

  addA2(x: number): Child {
    return this.addA(x).addA(x);
  }

  setC(c: boolean): Child {
    return this.copy({ c });
  }
}
applyMixins(Child, [Base]);
```

# 結論
Scala使いたい！
