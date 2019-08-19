import React from "react"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import SEO from "../components/seo"

class AboutPage extends React.Component {
  render() {
    const { data } = this.props
    const siteTitle = data.site.siteMetadata.title

    return (
      <Layout location={this.props.location} title={siteTitle}>
        <SEO title="About" />
        <p>Web Developer</p>
        <h2>Languages</h2>
        <ul>
          <li>TypeScript</li>
          <li>Scala</li>
          <li>Rust</li>
          <li>Haskell</li>
          <li>other...</li>
        </ul>
        <h2>Projects</h2>
        <ul>
          <li>
            <a href="https://anontown.com/">Anontown</a>
          </li>
          <li>
            <a href="https://github.com/kgtkr/typepark">Typepark</a>
          </li>
          <li>
            <a href="https://github.com/kgtkr/mhxx-switch-cis">
              MHXX Switch CIS
            </a>
          </li>
          <li>
            <a href="https://github.com/kgtkr/cl8w">cl8w</a>
          </li>
        </ul>
        <h2>Accounts</h2>
        <ul>
          <li>
            <a href="https://github.com/kgtkr">GitHub</a>
          </li>
          <li>
            <a href="https://twitter.com/kgtkr">Twitter</a>
          </li>
          <li>
            <a href="https://qiita.com/kgtkr">Qiita</a>
          </li>
          <li>
            <a href="https://mstdn.kgtkr.net/@tech">Mastodon</a>
          </li>
          <li>
            <a href="https://beta.atcoder.jp/users/kgtkr">AtCoder</a>
          </li>
        </ul>
        <h2>Accounts2</h2>
        <table>
          <tbody>
            <tr>
              <td>Email</td>
              <td>kgtkr.jp@gmail.com</td>
            </tr>
            <tr>
              <td>Discord</td>
              <td>tkr#5445</td>
            </tr>
            <tr>
              <td>Switchフレコ</td>
              <td>SW-2592-6241-1436</td>
            </tr>
          </tbody>
        </table>
        <h2>Bio</h2>
        <p>
          Web開発を中心に言語実装したり競プロしたりしたりしている。言語自体にも興味があったり。関数型言語が好き。大学生になるのに失敗したので都内で
          <del>ニート</del>エンジニアバイトしながら浪人生しています。
          <br />
          <a href="https://github.com/kgtkr/calc">沢山の言語で電卓実装</a>
          みたいな事やってたり。
          <br />
          TypeScriptで型レベルプログラミングやったりも。
          <a href="https://github.com/kgtkr/typepark">Typepark</a>
          っていうライブラリにまとめ中。
          <br />
          <a href="https://github.com/anontown">Anontown</a>
          はbetter2ch(現5ch)みたいなノリで始めた掲示板プロジェクト。色々迷走したけど今はReact+Node.jsで落ち着いてる。早くGraphQL導入したい。
          <br />
          競プロゆるふわ。現在水色。ほぼほぼRustでやってます。Rustで何かプロジェクト作りたい。
          <br />
          最近は
          <a href="https://github.com/kgtkr/cl8w">
            Haskellでwasmで動く言語実装
          </a>
          した。
        </p>
      </Layout>
    )
  }
}

export default AboutPage

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
  }
`
