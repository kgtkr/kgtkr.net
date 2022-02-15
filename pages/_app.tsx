import "../styles/globals.scss";
import type { AppProps } from "next/app";
import Link from "next/link";
import styles from "./_app.module.scss";
import Head from "next/head";

function App({ Component, pageProps, router }: AppProps) {
  return (
    <div className={styles.container}>
      <Head>
        <link rel="icon" href="/images/profile.png" type="image/png" />
      </Head>
      <header
        className={`${styles.header} ${
          router.asPath === "/" ? styles.homeHeader : ""
        }`}
      >
        <Link href="/">Tkr Blog</Link>
      </header>
      <Component {...pageProps} />
      <footer>© {new Date().getFullYear()}. All rights reserved.</footer>
    </div>
  );
}

export default App;
