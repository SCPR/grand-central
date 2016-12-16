'use strict';

const request              = require('request');
const AppleNews            = require('apple-news');

const validator            = require('../lib/schema-validator');
const htmlToAppleJSON      = require('../lib/filters/apple-news');

module.exports = (secrets) => {

  let client   = new AppleNews({
    apiId: secrets.apiId,
    apiSecret: secrets.apiSecret
  });

  let post = (message) => {
      if(message.remoteId){ return put(message);}
      // A channel is going to mean something a little different in this case,
      // so, for now, I am ignoring the channel attribute from the message and
      // just sending to the default apple news publisher "channel".
      // let channel = message.MessageAttributes.channel.StringValue;

      return new Promise((resolve, reject) => {
        // validate the message body
        let validationResult = validator.validate(message.body, "/Article");

        if(validationResult.errors.length) {
          return resolve({
            code: 409,
            message: "There is a problem with the article.",
            body: validationResult.errors
          });
        }

        let article = message.body;

        htmlToAppleJSON(article)
          .then((json) => {

            client.createArticle({
              channelId: secrets.channels.kpcc,  // eventually this should come from the message
              article: json,
              isPreview: true
            }, (err, response, data) => {

              if(err){
                return resolve({
                  code: 409,
                  message: "Article rejected.",
                  body: err
                });
              }

              resolve({
                code: 201,
                message: "Article successfully created.",
                body: response,
                revision: response.revision,
                remoteId: response.id
              });

            });

          })
          .catch((err) => {
            reject(err);
          });
      });
    }

    let put = (message) => {
      if(!message.remoteId){ return post(message);}
      return new Promise((resolve, reject) => {
        // validate the message body
        let validationResult = validator.validate(message.body, "/Article");

        if(validationResult.errors.length) {
          return resolve({
            code: 409,
            message: "There is a problem with the article.",
            body: validationResult.errors
          });
        }

        let article = message.body;

        htmlToAppleJSON(article)
          .then((json) => {

            client.updateArticle({
              articleId: message.remoteId,
              article: json,
              revision: message.revision
            }, (err, response, data) => {

              if(err){
                return resolve({
                  code: 409,
                  message: "Article rejected.",
                  body: err
                });
              }

              resolve({
                code: 200,
                message: "Article successfully updated.",
                body: response,
                revision: response.revision,
                remoteId: response.id
              });

            });

          })
          .catch((err) => {
            reject(err);
          });
      });
    }

    let del = (message) => {
      debugger
      return new Promise((resolve, reject) => {
        // I'm guessing this might work.  lol
        client.deleteArticle({
          articleId: message.remoteId
        }, (err, response, data) => {
          if(err){
            return resolve({
              code: 409,
              message: "Article could not be deleted.",
              body: err
            });
          }
          resolve({
            code: 200,
            message: "Article successfully deleted.",
            body: response
          })

        })
      })
    }

  return {
    post: post,
    put: put,
    delete: del
  }

}