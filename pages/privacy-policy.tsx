import React from "react";
import { NextPage } from "next";
import Title from "../components/Title";

const PrivacyPolicy: NextPage = () => {
  return (
    <div>
      <Title title="プライバシーポリシー" />
      <h1>プライバシーポリシー</h1>
      <ul>
        <li>
          当サイトではCookieを使用しています.
          Cookieはブラウザの設定から無効化することができます
        </li>
        <li>CookieはGoogle AnalyticsとGoogle Adsenseに使用されます.</li>
        <li>
          Google Adsense以下のことを行います.
          <ul>
            <li>
              Googleなどの第三者配信事業者がCookieを使用して,
              ユーザーがそのウェブサイトや他のウェブサイトに過去にアクセスした際の情報に基づいて広告を配信できます.
            </li>
            <li>
              Googleが広告Cookieを使用することにより,
              ユーザーがそのサイトや他のサイトにアクセスした際の情報に基づいて,
              Googleやそのパートナーが適切な広告をユーザーに表示できます。
            </li>
            <li>
              ユーザーは、
              <a href="https://adssettings.google.com/authenticated">
                広告設定
              </a>
              でパーソナライズ広告を無効にできます.
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );
};

export default PrivacyPolicy;
