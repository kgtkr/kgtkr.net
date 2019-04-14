import React from 'react';
import Link from 'gatsby-link';
import Layout from "../components/layout"
import SEO from "../components/seo"
import { rhythm, scale } from "../utils/typography"
import postToPath from "../utils/post-to-path"


const Tags = ({ pathContext, location, data }) => {
  const { posts, tagName } = pathContext;

  if (posts) {
    return (
      <Layout location={location} title={data.site.siteMetadata.title}>
        <SEO
          title={`Posts abount ${tagName}`}
          description={`Posts abount ${tagName}`}
        />
        <p
          style={{
            ...scale(-1 / 5),
            display: `block`,
            marginBottom: rhythm(1),
            marginTop: rhythm(-0.5),
          }}
        >
          <Link to="/tags">
            All Tags
        </Link>
        </p>
        <div>
          <span>
            Posts abount <strong>{tagName}</strong>
          </span>
          <ul>
            {posts.map(post => {
              return (
                <li key={postToPath(post)}>
                  <Link to={postToPath(post)}>
                    {post.frontmatter.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Layout>
    );
  }
};

export default Tags;

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
  }`