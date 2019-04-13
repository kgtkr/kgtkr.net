import React from 'react';
import Link from 'gatsby-link';
import Layout from "../components/layout"
import SEO from "../components/seo"

const Tags = ({ pathContext, location, data }) => {
  const { posts, tagName } = pathContext;

  if (posts) {
    return (
      <Layout location={location} title={data.site.siteMetadata.title}>
        <SEO
          title={`Posts abount ${tagName}`}
          description={`Posts abount ${tagName}`}
        />
        <div>
          <span>
            Posts abount <strong>{tagName}</strong>:
          </span>
          <ul>
            {posts.map(post => {
              return (
                <li>
                  <Link to={post.fields.slug}>
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