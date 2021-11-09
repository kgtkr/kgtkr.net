import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";
import Link from "next/link";

const About: NextPage = () => {
  return (
    <div>
      <Title title="About" />
      <h2>Projects</h2>
      <ul>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/BarrageLCL">BarrageLCL</Link>
            </strong>
          </div>
          <div>
            大学の授業の課題で提出した自作の弾幕生成DSL+簡単なシンタックスハイライトと補完機能付きの自作エディタ。Processing指定だったのでそれで作った(つらかった…)。
            <Link href="/blog/2020/09/16/ep-barrage-lcl">記事</Link>
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/anontown/anontown">Anontown</Link>
            </strong>
          </div>
          <div>
            名無し制の掲示板
            <Link href="https://anontown.com/">anontown.com</Link>
            で実際に使える。 技術スタック的な↓
            <br />
            <div>
              バックエンド:
              <br />
              Node.js/TypeScript/Docker/ApolloGraphQL/MongoDB/ElasticSearch
            </div>
            <div>
              フロントエンド: <br />
              TypeScript/ApolloGraphQL/React
            </div>
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/wasm-rs">wasm-rs</Link>
            </strong>
          </div>
          <div>
            Rust製のwasmインタプリタ。
            <Link href="/blog/2019/12/21/wasm-rs">記事</Link>
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/calc">calc</Link>
            </strong>
          </div>
          <div>
            色々な言語で有理数型作ってパーサー書いてCLI電卓作ってみようプロジェクト。言語の勉強用。
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/typepark">Typepark</Link>
            </strong>
          </div>
          <div>
            TypeScript3.0でタプル型強化された！？色々楽しいことできそうライブラリ化しようみたいなやつ。
            <br />
            型レベル関数が色々入ってる。
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/mhxx-switch-cis">
                MHXX Switch CIS
              </Link>
            </strong>
          </div>
          <div>
            MHXX
            Switch版のお守り一覧のスクショ画面読み込んでCSVデータ出力するやつ。Kotlin勉強ついでに作った。
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/cl8w">cl8w</Link>
            </strong>
          </div>
          <div>
            Haskell製の自作言語。
            <Link href="https://kgtkr.net/blog/2018/12/02/wasm-target-lang">
              記事
            </Link>
          </div>
        </li>
        <li>
          <div>
            <strong>
              <Link href="https://github.com/kgtkr/procon">procon</Link>
            </strong>
          </div>
          <div>AtCoderに提出したコード置き場。</div>
        </li>
      </ul>
      <h2>Languages</h2>
      <ul>
        <li>
          <div>
            <strong>TypeScript</strong>
          </div>
          <div>
            名無し制掲示板Anontownのフロントエンド/バックエンドに使用したり、typeparkというTypeScriptの型で遊ぶライブラリを作ったりしている。
            <br />
            最も書ける言語だが好きな言語ではない。
          </div>
        </li>
        <li>
          <div>
            <strong>Scala</strong>
          </div>
          <div>
            Anontownの初期バージョンでバックエンドに使用していた。その後TypeScriptで書き直したが現在再度Scalaでバックエンドを書き直している。
          </div>
        </li>
        <li>
          <div>
            <strong>Rust</strong>
          </div>
          <div>
            競プロで使ったり、自作のwasmインタプリタを作るのに使ったりした。
          </div>
        </li>
        <li>
          <div>
            <strong>Haskell</strong>
          </div>
          <div>自作言語cl8wの開発に使ったのと、たまに競プロで使っている。</div>
        </li>
        <li>other...</li>
      </ul>
      <h2>Accounts</h2>
      <ul>
        <li>
          <Link href="https://github.com/kgtkr">GitHub</Link>
        </li>
        <li>
          <Link href="https://twitter.com/kgtkr">Twitter</Link>
        </li>
        <li>
          <Link href="https://qiita.com/kgtkr">Qiita</Link>
        </li>
        <li>
          <Link href="https://mstdn.kgtkr.net/@tech">Mastodon</Link>
        </li>
        <li>
          <Link href="https://atcoder.jp/users/kgtkr">
            AtCoder(Highest:1249, 水)
          </Link>
        </li>
      </ul>
      <h2>Contacts</h2>
      <table>
        <tbody>
          <tr>
            <td>Email</td>
            <td>contact@kgtkr.net</td>
          </tr>
          <tr>
            <td>Discord</td>
            <td>tkr#9999</td>
          </tr>
          <tr>
            <td>Switch FC</td>
            <td>SW-2592-6241-1436</td>
          </tr>
          <tr>
            <td>PGP Public Key</td>
            <td>
              <Link href="/B30DBE9381E03D5DF30188C81F6EB9519F573241.txt">
                B30D BE93 81E0 3D5D F301 88C8 1F6E B951 9F57 3241
              </Link>
            </td>
          </tr>
        </tbody>
      </table>
      <h2>History</h2>
      <table>
        <tbody>
          <tr>
            <td>2000.11.06</td>
            <td>誕生</td>
          </tr>
          <tr>
            <td>2007.04-2016.03</td>
            <td>公立小中学校</td>
          </tr>
          <tr>
            <td>2016.04-2019.03</td>
            <td>福岡県立博多青松高校</td>
          </tr>
          <tr>
            <td>2019.05-現在</td>
            <td>HERP, Inc.(エンジニアインターン)</td>
          </tr>
          <tr>
            <td>2020.04-現在</td>
            <td>明治大学総合数理学部先端メディアサイエンス学科</td>
          </tr>
        </tbody>
      </table>
      <h2>このサイトについて</h2>
      <p>
        ソースコードはGitHubで公開しています
        <div>
          <Link href="https://github.com/kgtkr/kgtkr.net">kgtkr/kgtkr.net</Link>
        </div>
      </p>
    </div>
  );
};

export default About;
