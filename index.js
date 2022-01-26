require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')

const app = express()
const cors = require('cors')
const Twitter = require('twitter')
const Cache = require('./cache')
const {checkIfVerifiedAr, persistVerificationAr, signDocumentAr} = require("./arweave")

const util = require('util')

app.use(bodyParser.urlencoded({extended: true}))
app.use(cors())

const port = process.env.PORT || 8080
const TWEET_TEMPLATE = "I am verifying for @kongiscash: sig:"

const client = new Twitter({
  consumer_key: process.env.CONSUMER_KEY,
  consumer_secret: process.env.CONSUMER_SECRET,
  bearer_token: process.env.BEARER_TOKEN
})

const sigCache = new Cache()

app.get('/', (req, res) => {
  res.send('ok')
})

// post: include name, address (from MM), handle
app.post('/sign/:document', (req, res) => {
  const documentId = req.params.document
  const {
    name,
    address,
    handle,
    signature,
  } = req.body

  // did the user include a handle?
  if (handle) {
    // check if user is verified
    const promise = sigCache.has(handle) ?
      signDocumentAr(documentId, address, name, handle, signature, true) :
      checkIfVerifiedAr(handle, signature).then(result => {
        const verified = !!result
        return signDocumentAr(documentId, address, name, handle, signature, verified)
      })

    promise
      .then((data) => {
        console.log(`new signee: ${name}, @${handle}, ${address}`)
        res.json(data)
      })
      .catch(e => {
        console.log(`err @ /sign/:document : ${e}`)
        res.status(500)
      });
  } else {
    // pure metamask sig
    signDocumentAr(documentId, address, name, '', signature, false)
      .then((data) => res.json(data))
      .catch(e => {
        console.log(`err @ /sign/:document : ${e}`)
        res.status(500)
      })
  }
})

// post: include address (from MM)
app.post('/verify/:handle', (req, res) => {

  const handle = req.params.handle
  const {
    address: signature,
  } = req.body

  if (sigCache.has(handle)) {
    console.log(`already verified user: @${handle}`)
    const txId = sigCache.get(handle)
    res.json({ tx: txId })
    return
  }

  client.get('statuses/user_timeline', {
    screen_name: handle,
    include_rts: false,
    count: 5,
    tweet_mode: 'extended',
  }, (error, tweets, response) => {

    if (!error) {
      for (const tweet of tweets) {
        const parsedSignature = tweet.full_text.slice(TWEET_TEMPLATE.length).split(" ")[0];
        if (tweet.full_text.startsWith(TWEET_TEMPLATE) && (parsedSignature === signature)) {
          // check to see if already linked

          checkIfVerifiedAr(handle, signature)
            .then(result => {
              if (result) {
                // already linked
                console.log(`already verified user: @${handle}`)
                sigCache.set(handle, result)
                res.json({ tx: result })
              } else {
                // need to link
                persistVerificationAr(handle, signature)
                  .then((tx) => {
                    console.log(`new verified user: @${handle}, ${signature}`)
                    sigCache.set(handle, tx)
                    res.status(201).json(tx)
                  })
                  .catch(e => {
                    console.log(`err @ /verify/:handle : ${e}`)
                    res.status(500).send(JSON.stringify(e))
                  });
              }
            });
          return
        }
      }
      res.status(500).json({message: 'No matching Tweets found'})
    } else {
      console.log(util.inspect(response, {showHidden: false, depth: null, colors: true}))
      res.status(500).send({message: 'Twitter API error'})
    }
  })
})

app.listen(port, () => {
  console.log(`server started on port ${port}`)
})
