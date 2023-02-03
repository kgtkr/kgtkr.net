import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";
import Link from "next/link";

const Projects: NextPage = () => {
  return (
    <div>
      <Title title="Projects" />
      <h1>Projects</h1>
      <h2>2022〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/wjit">wjit</a>
          <div>
            wasmで関数単位でjitする言語の実験的な実装.{" "}
            <Link href="/blog/2022/04/04/wasm-per-function-jit-language">
              記事
            </Link>
          </div>
        </li>
        <li>
          <a href="https://tegaki.fun">tegaki.fun</a>
          <div>
            研究室で作った手書き風の文章画像を生成するサービス.{" "}
            <a href="https://github.com/nkmr-lab/average-character-cloud-frontend">
              フロントエンド
            </a>{" "}
            <a href="https://github.com/nkmr-lab/average-character-cloud-backend">
              バックエンド
            </a>
          </div>
        </li>
      </ul>
      <h2>2021〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/processing-language-server">
            Processing Language Server
          </a>
          <div>
            <a href="https://github.com/kgtkr/processing-language-server-vscode">
              VSCode Client
            </a>{" "}
            ProcessingのLanguage Server.{" "}
            Processing同梱エディタの補完機能などを取り出してきてLSPを喋るようにした.{" "}
            <Link href="/blog/2021/11/06/processing-language-server">記事</Link>
          </div>
        </li>
      </ul>
      <h2>2020〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/BarrageLCL">BarrageLCL</a>
          <div>
            大学の授業の課題で提出した自作の弾幕生成DSL+簡単なシンタックスハイライトと補完機能付きの自作エディタ.
            Processing製.{" "}
            <Link href="/blog/2020/09/16/ep-barrage-lcl">記事</Link>
          </div>
        </li>
      </ul>
      <h2>2019〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/wasm-rs">wasm-rs</a>
          <div>
            Rust製のwasmインタプリタ.{" "}
            wasmバイナリをパースして1.0の仕様通りに実行する.{" "}
            <Link href="/blog/2019/12/21/wasm-rs">記事</Link>
          </div>
        </li>
        <li>
          <a href="https://github.com/kgtkr/typepark">Typepark</a>
          <div>
            TypeScript3.0でタプル型強化されたので型レベル関数を色々作ってみてライブラリ化したもの.{" "}
            <Link href="/blog/2018/10/02/typescript-3-tuples">関連記事</Link>
          </div>
        </li>
      </ul>
      <h2>2018〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/calc">calc</a>
          <div>
            色々な言語で有理数型とパーサを書いてCLI電卓を作ってみようプロジェクト.
            言語の勉強用. 現在8言語実装済み.
          </div>
        </li>
        <li>
          <a href="https://github.com/kgtkr/cl8w">cl8w</a>
          <div>
            Haskell製のwasmにコンパイルする簡単な自作言語.{" "}
            <a href="https://kgtkr.net/blog/2018/12/02/wasm-target-lang">
              記事
            </a>
          </div>
        </li>
      </ul>
      <h2>2017〜</h2>
      <ul>
        <li>
          <a href="https://github.com/kgtkr/procon">Procon</a>
          <div>AtCoderなどに提出したコード置き場。</div>
        </li>
        <li>
          <a href="https://github.com/kgtkr/mhxx-switch-cis">MHXX Switch CIS</a>
          <div>
            MHXX Switch版のお守り一覧のスクショを読み込んで,
            文字を抽出してCSVデータ出力するやつ. Kotlin勉強ついでに作った.
          </div>
        </li>
      </ul>
      <h2>2016〜</h2>
      <ul>
        <li>
          <a href="https://github.com/anontown/anontown">Anontown</a>
          <div>
            名無し制の掲示板. <a href="https://anontown.com/">公式サーバ</a>.
            技術スタック↓
            <div>
              バックエンド: Node.js / TypeScript / Apollo / MongoDB /
              ElasticSearch / Redis (PostgreSQLに移行中)
            </div>
            <div>フロントエンド: TypeScript/ Apollo / React</div>
          </div>
        </li>
      </ul>
    </div>
  );
};

export default Projects;
