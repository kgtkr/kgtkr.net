import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=Open+Sans&display=optional"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP&display=optional"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Maru+Gothic:wght@500&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Code+Pro&display=swap"
          rel="stylesheet"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
