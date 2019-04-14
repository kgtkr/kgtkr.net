import React from 'react';
import Link from 'gatsby-link';
import Layout from "../components/layout"
import SEO from "../components/seo"

class TagsPage extends React.Component {
  render() {
    const { data } = this.props
    const siteTitle = data.site.siteMetadata.title
    const tags = Array.from(new Set(([]).concat(...this.props.data.allMarkdownRemark.edges.map(({ node }) => node.frontmatter.tags)))).sort();

    return (
      <Layout location={this.props.location} title={siteTitle}>
        <SEO
          title={"All tags"}
          description={"tags list"}
        />
        <div>
          <ul>
            {tags.map(tag => {
              return (
                <li key={tag}>
                  <Link to={`/tags/${tag}`}>
                    {tag}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Layout>
    )
  }
}

export default TagsPage

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(sort: { fields: [frontmatter___update], order: DESC }) {
      edges {
        node {
          frontmatter {
            tags
            lang
            otherLang
          }
        }
      }
    }
  }`