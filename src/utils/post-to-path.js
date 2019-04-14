import * as moment from "moment-timezone";

export default function postToPath(post) {
  const date = moment(post.frontmatter.date).tz("UTC");
  const name = post.frontmatter.name;
  return `/blog/${date.format("YYYY/MM/DD")}/${name}`;
}