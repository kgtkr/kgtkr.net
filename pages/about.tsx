import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";
import Link from "next/link";

const About: NextPage = () => {
  return (
    <div>
      <Title title="About" />
      <h2>Projects</h2>
      <Link href="/projects">作ったもの一覧</Link>
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
