'use strict';

const cheerio    = require('cheerio');
const toMarkdown = require('to-markdown');
const YAML       = require('js-yaml');
const fs         = require('fs');

let filters              = {
  cleanup          : require('./cleanup')
}

let defaultYAMLString    = fs.readFileSync(`./templates/apple-news/article.yml`, 'utf8');

let htmlToBodyComponent = (html) => {
  let markdown = toMarkdown(html, {});
  return {
    role: "body",
    text: markdown,
    layout: "bodyLayout",
    textStyle: "bodyStyle",
    format: "markdown"
  }
}

let embedPlaceholderToComponent = (element) => {
  let url = element.attr("href");
  let role = element.attr("data-service");
  let idMatcher;

  if (url && role && ["twitter", "instagram", "youtube", "facebook"].include(role)) {
    if (role == "twitter") {
      role = "tweet";
      idMatcher = new RegExp("^(https?://twitter\\.com/([-a-zA-Z0-9+&@#%?=~_|!:,.;]+)/status(es){0,1}/(\\d+)/{0,1})", "i");
      url = url.match(idMatcher)[1];
      if (!url) {
        htmlToBodyComponent(element.html());
      }
    } else if (role == "youtube") {
      role = "embedwebvideo";
    } else if (role == "facebook") {
      role = "facebook_post";
    };

    return [{role: role, URL: url}];
  } else {
    return htmlToBodyComponent(element.html());
  }
}

let elementToComponent = (element) => {
  return new Promise((resolve, reject) => {
    let tagName = element.prop('tagName');
    if(tagName == 'IMG'){
      // convert image to figure component(s)
      resolve({
        role: "figure",
        URL: element.attr('src'),
        caption: (element.attr('alt') || element.attr('title'))
      });
      resolve({
        role: "caption",
        text: (element.attr('alt') || element.attr('title')),
        textStyle: "figcaptionStyle"
      });
    } else if (tagName == 'A') {
      if (element.hasClass('embed-placeholder') && element.attr('data-service') && element.attr('href')) {
        resolve(embedPlaceholderToComponent(element));
      } else {
        resolve(htmlToBodyComponent(element.html()));
      }
    } else {
      resolve(htmlToBodyComponent(element.html()));
    }

  })

}

// Just provide this an article.

module.exports = (article) => {
  return new Promise((resolve, reject) => {
    filters.cleanup(article.body)
      .then((html) => {

        let json = YAML.safeLoad(defaultYAMLString);

        json.identifier = article._id;
        json.title      = article.title;
        json.subtitle   = article.teaser;
        json.metadata   = {
          excerpt: article.teaser,
          thumbnailURL: article.assets[0].href
        };
        json.components = [
          {
            role: "title",
            layout: "titleLayout",
            text: article.title,
            textStyle: "titleStyle"
          },
          {
            role: "header",
            layout: "headerImageLayout",
            style: {
              fill: {
                type: "image",
                URL: article.assets[0].href,
                fillMode: "cover",
                verticalAlignment: "center"
              }
            }
          },
          {
            role: "author",
            layout: "authorLayout",
            text: article.byline,
            textStyle: "authorStyle"
          }
        ]

        let $          = cheerio.load(`<body>${article.body}</body>`);

        // Convert body elements to components.

        let promise = Promise.resolve();

        $('body > *').each((i, element) => {
          promise = promise
            .then(() => { return elementToComponent($(element)) })
            .then((component) => {
              json.components.push(component);
            })
            .catch((err) => {
              debugger
            })
        })

        promise.then(() => {
          debugger
          resolve(json);
        })

      })
      .catch((err) => {
        reject(err);
      })

  })
}